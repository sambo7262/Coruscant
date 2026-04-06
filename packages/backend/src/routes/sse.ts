import type { FastifyInstance } from 'fastify'
import type { ArrWebhookEvent } from '@coruscant/shared'
import { pollManager } from '../poll-manager.js'

export async function sseRoutes(fastify: FastifyInstance) {
  fastify.get('/api/sse', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const send = () => {
      const snapshot = pollManager.getSnapshot()
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

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        clearInterval(interval)
        unsubscribeBroadcast()
        unsubscribeArr()
        resolve()
      }
      request.raw.on('close', cleanup)
      reply.raw.on('close', cleanup)
    })
  })
}
