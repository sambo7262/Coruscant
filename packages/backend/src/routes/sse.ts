import type { FastifyInstance } from 'fastify'
import { generateMockSnapshot } from '../mock/generator.js'

export async function sseRoutes(fastify: FastifyInstance) {
  fastify.get('/api/sse', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const send = () => {
      const snapshot = generateMockSnapshot()
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

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        clearInterval(interval)
        resolve()
      }
      request.raw.on('close', cleanup)
      reply.raw.on('close', cleanup)
    })
  })
}
