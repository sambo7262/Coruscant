import type { FastifyInstance } from 'fastify'
import type { PlexStream, PlexServerStats } from '@coruscant/shared'
import { pollManager } from '../poll-manager.js'

// In-memory session map — keyed by Tautulli session_key
// Persists for the lifetime of the server process
const activeSessions = new Map<string, PlexStream>()

// Event values that indicate a stream has ended.
// Tautulli may send these directly or via {action} variable substitution.
const STOP_EVENTS = new Set(['stop', 'on_stop', 'watched'])

interface TautulliPayload {
  event?: string
  session_key?: string
  user?: string
  title?: string
  grandparent_title?: string
  parent_media_index?: number
  media_index?: number
  year?: number
  progress_percent?: number
  quality_profile?: string
  transcode_decision?: string
  stream_bandwidth?: number
  player?: string
  plex_server_cpu?: number
  plex_server_ram?: number
}

/**
 * Tautulli webhook plugin — registers POST /api/webhooks/tautulli
 *
 * Receives Tautulli playback events and maintains in-memory Plex stream state.
 * This is the ONLY way Plex data enters the system — no Plex poll timer exists (per D-25).
 *
 * No authentication required — LAN-only deployment (per project constraints).
 * The endpoint runs behind Tailscale/LAN only and is not exposed to the internet.
 */
export async function tautulliWebhookRoutes(fastify: FastifyInstance) {
  // Accept empty JSON bodies — Tautulli sends Content-Type: application/json
  // with no body when the JSON Data template is not configured. Fastify would
  // otherwise reject these with FST_ERR_CTP_EMPTY_JSON_BODY before the handler runs.
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

  fastify.post('/api/webhooks/tautulli', async (request, reply) => {
    const body = request.body as TautulliPayload | null | undefined

    // Accept any payload — Tautulli variable substitution may not work in all
    // configurations (e.g. {action} sent literally). We infer intent from the
    // payload rather than requiring a specific event string.
    // Empty body (no JSON template configured) → 200 OK, nothing to process.
    if (!body || Object.keys(body).length === 0) {
      return reply.code(200).send({ success: true, note: 'empty payload — no action taken' })
    }

    const sessionKey = body.session_key ?? `anon-${Date.now()}`
    const event = body.event ?? ''

    // A session_key with no title/player means a stop signal in some Tautulli configs
    const isStop = STOP_EVENTS.has(event) || (body.session_key !== undefined && !body.title && !body.player)

    if (isStop) {
      // Remove stream from active sessions
      activeSessions.delete(sessionKey)
    } else {
      // playback.started, playback.paused, playback.resumed — upsert stream entry
      const stream: PlexStream = {
        user: body.user ?? 'Unknown',
        // grandparent_title (show name) takes precedence over title for TV episodes
        title: body.grandparent_title || body.title || 'Unknown',
        // Maps Tautulli 'player' field to PlexStream.deviceName (Warning 1 in plan)
        deviceName: body.player ?? 'Unknown',
        year: body.year,
        season: body.parent_media_index,
        episode: body.media_index,
        progressPercent: body.progress_percent ?? 0,
        quality: body.quality_profile ?? 'unknown',
        transcode: body.transcode_decision === 'transcode',
      }
      activeSessions.set(sessionKey, stream)
    }

    // Extract optional PlexServerStats if Tautulli includes server metrics in payload
    let serverStats: PlexServerStats | undefined
    if (body.plex_server_cpu !== undefined || body.plex_server_ram !== undefined) {
      serverStats = {
        processCpuPercent: body.plex_server_cpu ?? 0,
        processRamPercent: body.plex_server_ram ?? 0,
        bandwidthMbps: body.stream_bandwidth !== undefined
          ? body.stream_bandwidth / 1000  // kbps to Mbps
          : 0,
      }
    }

    // Update PollManager and trigger SSE push
    const streams = [...activeSessions.values()]
    pollManager.updatePlexState(streams, serverStats)

    return reply.code(200).send({ success: true })
  })
}
