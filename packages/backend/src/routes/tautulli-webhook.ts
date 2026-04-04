import type { FastifyInstance } from 'fastify'
import type { PlexStream, PlexServerStats } from '@coruscant/shared'
import { pollManager } from '../poll-manager.js'

// In-memory session map — keyed by Tautulli session_key
// Persists for the lifetime of the server process
const activeSessions = new Map<string, PlexStream>()

const SUPPORTED_EVENTS = new Set([
  'playback.started',
  'playback.paused',
  'playback.resumed',
  'playback.stopped',
])

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
  fastify.post('/api/webhooks/tautulli', async (request, reply) => {
    const body = request.body as TautulliPayload | null | undefined

    // Validate required fields
    if (!body || !body.event) {
      return reply.code(400).send({ error: 'Missing event field in webhook payload' })
    }

    if (!SUPPORTED_EVENTS.has(body.event)) {
      return reply.code(400).send({ error: `Unsupported event type: ${body.event}` })
    }

    const sessionKey = body.session_key ?? `anon-${Date.now()}`
    const event = body.event

    if (event === 'playback.stopped') {
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
