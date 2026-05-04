process.env.DB_PATH = ':memory:'

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { initDb, getDb } from '../db.js'
import { metricsHistory } from '../schema.js'
import { metricsRoutes, clearMetricsCache } from '../routes/metrics.js'

describe('/api/metrics/history cache (PERF-02)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    initDb()
    app = Fastify({ logger: false })
    await app.register(metricsRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    // Clear cache and metrics table, then seed known data
    clearMetricsCache()
    const db = getDb()
    db.delete(metricsHistory).run()

    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      db.insert(metricsHistory).values({
        timestamp: new Date(now - i * 60_000).toISOString(),
        service: 'nas',
        metrics: JSON.stringify({ cpu: 50 + i, ram: 60 }),
      }).run()
    }
  })

  it('returns data on first call (cache miss)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/history?service=nas&window=24h',
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.service).toBe('nas')
    expect(body.window).toBe('24h')
    expect(body.points.length).toBeGreaterThan(0)
  })

  it('returns cached result on second call within TTL', async () => {
    // First call — populates cache
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/metrics/history?service=nas&window=24h',
    })
    const body1 = JSON.parse(res1.body)

    // Add more data to DB (should NOT appear in cached response)
    const db = getDb()
    db.insert(metricsHistory).values({
      timestamp: new Date().toISOString(),
      service: 'nas',
      metrics: JSON.stringify({ cpu: 99, ram: 99 }),
    }).run()

    // Second call — should return same cached result
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/metrics/history?service=nas&window=24h',
    })
    const body2 = JSON.parse(res2.body)

    expect(body2.points.length).toBe(body1.points.length)
  })

  it('different cache keys do not collide', async () => {
    // Seed pihole data
    const db = getDb()
    db.insert(metricsHistory).values({
      timestamp: new Date().toISOString(),
      service: 'pihole',
      metrics: JSON.stringify({ queriesPerSecond: 5 }),
    }).run()

    const nasRes = await app.inject({
      method: 'GET',
      url: '/api/metrics/history?service=nas&window=24h',
    })
    const piholeRes = await app.inject({
      method: 'GET',
      url: '/api/metrics/history?service=pihole&window=24h',
    })

    const nasBody = JSON.parse(nasRes.body)
    const piholeBody = JSON.parse(piholeRes.body)

    expect(nasBody.service).toBe('nas')
    expect(piholeBody.service).toBe('pihole')
    // Points are different because data is different
    expect(nasBody.points).not.toEqual(piholeBody.points)
  })

  it('rejects invalid window parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/history?service=nas&window=1y',
    })
    expect(res.statusCode).toBe(400)
  })
})
