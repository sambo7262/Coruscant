import type { FastifyInstance } from 'fastify'
import { pollManager, classifyArrEvent, extractArrTitle } from '../poll-manager.js'

// All arr-compatible services that can send webhooks to Coruscant
const ARR_SERVICES = ['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd'] as const

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
    fastify.post(`/api/webhooks/${service}`, async (request, reply) => {
      const body = request.body as Record<string, unknown> | null | undefined

      // Empty body — arr app sent a test notification or has no payload configured
      if (!body || Object.keys(body).length === 0) {
        return reply.code(200).send({ success: true, note: 'empty payload' })
      }

      // Structured webhook log — [WEBHOOK] SERVICE -> event_type -> "title" (D-13 ISSUE-11)
      const eventType = classifyArrEvent((body.eventType as string) || '')
      const title = extractArrTitle(body) || 'unknown'
      fastify.log.info(
        { service: service.toUpperCase() },
        `[WEBHOOK] ${service.toUpperCase()} -> ${eventType} -> "${title}"`
      )

      // Forward to PollManager for classification, SSE broadcast, and burst poll
      pollManager.handleArrEvent(service, body)

      return reply.code(200).send({ success: true })
    })
  }
}
