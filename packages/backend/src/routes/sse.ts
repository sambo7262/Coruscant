import type { FastifyInstance } from 'fastify'
import type { ArrWebhookEvent, DashboardSnapshot } from '@coruscant/shared'
import { pollManager } from '../poll-manager.js'
import { logEvents, type LogEntry } from '../log-events.js'

/**
 * Create a deterministic fingerprint of meaningful snapshot fields.
 * Excludes `timestamp` (which always changes) to avoid stale-data flicker. (D-03, D-04)
 */
function snapshotFingerprint(snapshot: DashboardSnapshot): string {
  return JSON.stringify({
    services: snapshot.services.map(s => ({
      id: s.id, status: s.status, lastPollAt: s.lastPollAt,
      configured: s.configured,
      piholeStats: s.metrics?.piholeStats,
      sabnzbdQueue: s.metrics?.queueCount,
      unifiMetrics: s.metrics,
    })),
    nas: snapshot.nas,
    streams: snapshot.streams,
    plexServerStats: snapshot.plexServerStats,
  })
}

export async function sseRoutes(fastify: FastifyInstance) {
  fastify.get('/api/sse', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    // Per-connection fingerprint state for change detection (D-04)
    let lastFingerprint = ''

    const send = () => {
      const snapshot = pollManager.getSnapshot()
      const fp = snapshotFingerprint(snapshot)
      if (fp === lastFingerprint) return  // D-04: skip write when unchanged
      lastFingerprint = fp
      reply.raw.write(`event: dashboard-update\ndata: ${JSON.stringify(snapshot)}\n\n`)
    }

    send() // immediate first payload

    // In Fastify inject (test/CI mode), the socket is a MockSocket.
    // End immediately so inject() returns with the first event payload.
    if (request.raw.socket?.constructor?.name === 'MockSocket') {
      reply.raw.end()
      return
    }

    const interval = setInterval(send, 5000)

    // Subscribe to broadcast events (e.g. Plex webhook triggers immediate push)
    const unsubscribeBroadcast = pollManager.onBroadcast(() => { send() })

    // Subscribe to arr webhook events — push named arr-event messages to client
    const unsubscribeArr = pollManager.onArrEvent((event: ArrWebhookEvent) => {
      reply.raw.write(`event: arr-event\ndata: ${JSON.stringify(event)}\n\n`)
    })

    // Subscribe to log events — push log-entry SSE events to connected clients (D-29)
    const onLogEntry = (entry: LogEntry) => {
      reply.raw.write(`event: log-entry\ndata: ${JSON.stringify(entry)}\n\n`)
    }
    logEvents.on('entry', onLogEntry)

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        clearInterval(interval)
        unsubscribeBroadcast()
        unsubscribeArr()
        logEvents.off('entry', onLogEntry)
        resolve()
      }
      request.raw.on('close', cleanup)
      reply.raw.on('close', cleanup)
    })
  })
}
