import type { FastifyInstance } from 'fastify'
import { pollManager, classifyArrEvent, extractArrTitle } from '../poll-manager.js'

// All arr-compatible services that can send webhooks to Coruscant
const ARR_SERVICES = ['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd'] as const

/**
 * Detect whether a Health webhook body is about an indexer being unavailable.
 * Radarr/Sonarr/Lidarr/Readarr all run independent health checks that fire a
 * "Health" event whenever any configured indexer is unreachable — so a single
 * indexer outage produces simultaneous webhooks from every arr that uses it.
 *
 * When this returns true, the webhook route remaps the broadcast event's
 * `service` field to 'prowlarr' so the frontend flashes only the indexer hub
 * (Prowlarr) instead of every tile in the media stack.
 *
 * Heuristic: inspect the `type` field (e.g. IndexerLongTermStatusCheck,
 * IndexerStatusCheck) and the `message` field (e.g. "Indexers unavailable...")
 * for the substring "indexer" (case-insensitive). This is intentionally loose
 * so it catches both the long-term and short-term status checks across all
 * arr variants without hard-coding every known type string.
 */
function isIndexerHealthIssue(body: Record<string, unknown>): boolean {
  const rawEventType = typeof body.eventType === 'string' ? body.eventType.toLowerCase() : ''
  if (rawEventType !== 'health') return false
  const type = typeof body.type === 'string' ? body.type.toLowerCase() : ''
  const message = typeof body.message === 'string' ? body.message.toLowerCase() : ''
  return type.includes('indexer') || message.includes('indexer')
}

/**
 * Arr webhook routes plugin — registers POST /api/webhooks/:service for all arr services.
 *
 * Receives arr application webhook events and forwards them to PollManager
 * for classification, logging, SSE broadcast, and SABnzbd burst poll activation.
 *
 * No authentication required — LAN-only deployment (per project constraints).
 * The endpoints run behind Tailscale/LAN only and are not exposed to the internet.
 */
export async function arrWebhookRoutes(fastify: FastifyInstance) {
  // Accept empty JSON bodies — some arr apps may POST with Content-Type: application/json
  // but no body (e.g. test notifications). Fastify would otherwise reject these
  // with FST_ERR_CTP_EMPTY_JSON_BODY before the handler runs.
  // Note: Fastify scopes content type parsers per plugin registration — no conflict
  // with the identical parser in tautulli-webhook.ts (Pitfall 1 in plan research).
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const str = body as string
    if (!str || str.trim() === '') {
      done(null, {})
      return
    }
    try {
      done(null, JSON.parse(str))
    } catch (err) {
      done(err as Error, undefined)
    }
  })

  for (const service of ARR_SERVICES) {
    // GET handler — two modes:
    //   (1) Bazarr real events: GET /api/webhooks/bazarr?path=/data/media/tv/Show/Season%201
    //       Bazarr's custom-URL notification sends subtitle-download completions as GET
    //       with the media path in a query param. Parse the path into a title and forward
    //       to pollManager.handleArrEvent so the UI gets an SSE broadcast + log entry.
    //   (2) Reachability probes from any arr app Test button: return a 200 health payload.
    fastify.get(`/api/webhooks/${service}`, async (request, reply) => {
      const query = request.query as Record<string, string | undefined>

      if (service === 'bazarr' && typeof query.path === 'string' && query.path.length > 0) {
        const decodedPath = query.path
        const segments = decodedPath.split('/').filter(Boolean)

        // Parse "/data/media/tv/<Show>/Season <N>[/<Episode>]" or
        //       "/data/media/movies/<Movie>"
        const tvIdx = segments.indexOf('tv')
        const moviesIdx = segments.indexOf('movies')

        let title: string
        // NOTE: eventType is set to 'Download' (not 'SubtitleDownload') so that
        // classifyArrEvent returns 'download_complete' — the frontend AppHeader
        // ticker and ServiceCard glow both early-return on eventCategory === 'unknown',
        // so a category is required for Bazarr events to surface in the UI.
        // rawEventType is preserved for log clarity via a separate field below.
        const body: Record<string, unknown> = { eventType: 'Download' }

        if (tvIdx >= 0 && segments.length > tvIdx + 1) {
          const showTitle = segments[tvIdx + 1]
          const seasonSeg = segments[tvIdx + 2]
          title = seasonSeg && seasonSeg.startsWith('Season')
            ? `${showTitle} · ${seasonSeg}`
            : showTitle
          body.series = { title }
        } else if (moviesIdx >= 0 && segments.length > moviesIdx + 1) {
          title = segments[moviesIdx + 1]
          body.movie = { title }
        } else {
          title = segments[segments.length - 1] || decodedPath
          body.series = { title }
        }

        const now = new Date()
        const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`
        fastify.log.info(
          { service: 'webhook' },
          `${service} | SubtitleDownload | ${title} | ${ts}`
        )

        pollManager.handleArrEvent(service, body)

        return reply.code(200).send({ success: true, title })
      }

      // Reachability probe (Test button / browser hit / no path query)
      return reply.code(200).send({
        success: true,
        service,
        method: service === 'bazarr' ? 'GET?path=...' : 'POST',
        message: service === 'bazarr'
          ? 'Bazarr webhook endpoint. Real events use GET with ?path=<media path>.'
          : `${service} webhook endpoint. Real events use POST with JSON body.`
      })
    })

    fastify.post(`/api/webhooks/${service}`, async (request, reply) => {
      const body = request.body as Record<string, unknown> | null | undefined

      // Empty body — arr app sent a test notification or has no payload configured
      if (!body || Object.keys(body).length === 0) {
        return reply.code(200).send({ success: true, note: 'empty payload' })
      }

      // Structured webhook log — D-16 format: "service | eventType | title | HH:MM MM/DD/YYYY"
      // service field set to 'webhook' (not service.toUpperCase()) so log viewer filter
      // shows a single 'webhook' category covering all arr services (D-15)
      const eventType = classifyArrEvent((body.eventType as string) || '')
      const title = extractArrTitle(body) || 'unknown'
      const now = new Date()
      const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`

      // Indexer-health remap: when any arr app fires a Health webhook about an
      // indexer being unavailable, attribute the broadcast to 'prowlarr' so the
      // frontend flashes only the indexer hub. The log line preserves the
      // originating service for debugging.
      const broadcastService = isIndexerHealthIssue(body) ? 'prowlarr' : service
      if (broadcastService !== service) {
        fastify.log.info(
          { service: 'webhook', remap: { from: service, to: broadcastService } },
          `${service} | ${eventType} | ${title} | ${ts} [remapped to prowlarr — indexer health]`
        )
      } else {
        fastify.log.info(
          { service: 'webhook' },
          `${service} | ${eventType} | ${title} | ${ts}`
        )
      }

      // Forward to PollManager for classification, SSE broadcast, and burst poll
      pollManager.handleArrEvent(broadcastService, body)

      return reply.code(200).send({ success: true })
    })
  }
}
