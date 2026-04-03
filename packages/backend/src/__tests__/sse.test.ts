import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { sseRoutes } from '../routes/sse.js'

describe('GET /api/sse', () => {
  const fastify = Fastify()

  beforeAll(async () => {
    await fastify.register(sseRoutes)
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  it('returns status 200 with Content-Type text/event-stream', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/sse',
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')
  })

  it('returns Cache-Control: no-cache header', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/sse',
    })

    expect(response.headers['cache-control']).toBe('no-cache')
  })

  it('returns X-Accel-Buffering: no header (Synology DSM Nginx proxy)', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/sse',
    })

    expect(response.headers['x-accel-buffering']).toBe('no')
  })

  it('response body contains event: dashboard-update text', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/sse',
    })

    expect(response.body).toContain('event: dashboard-update')
  })

  it('response body contains valid JSON after data: prefix that parses to a DashboardSnapshot', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/sse',
    })

    // Extract data line: find "data: {...}"
    const dataMatch = response.body.match(/^data: (.+)$/m)
    expect(dataMatch).not.toBeNull()

    const parsed = JSON.parse(dataMatch![1])
    expect(parsed).toHaveProperty('services')
    expect(parsed).toHaveProperty('nas')
    expect(parsed).toHaveProperty('streams')
    expect(parsed).toHaveProperty('timestamp')
  })
})
