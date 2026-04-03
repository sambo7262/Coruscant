import { describe, it, expect, afterAll } from 'vitest'
import Fastify from 'fastify'
import { healthRoutes } from '../routes/health.js'

// Use in-memory SQLite for tests — override DB_PATH
process.env.DB_PATH = ':memory:'

describe('GET /health', () => {
  const fastify = Fastify()

  afterAll(async () => {
    await fastify.close()
  })

  it('returns status ok and db connected', async () => {
    await fastify.register(healthRoutes)
    await fastify.ready()

    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.status).toBe('ok')
    expect(body.db).toBe('connected')
    expect(body.timestamp).toBeDefined()
  })
})
