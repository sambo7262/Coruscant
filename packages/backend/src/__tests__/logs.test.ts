import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

// Must be set before imports that call getDb()
process.env.DB_PATH = ':memory:'
process.env.ENCRYPTION_KEY_SEED = 'test-seed-logs'

import { initDb, getDb } from '../db.js'
import { appLogs, kvStore } from '../schema.js'
import { logRoutes } from '../routes/logs.js'
import { settingsRoutes } from '../routes/settings.js'

function seedLogs() {
  const db = getDb()
  const now = new Date()
  const entries = [
    { timestamp: new Date(now.getTime() - 1000).toISOString(), level: 'info', service: 'system', message: 'startup', payload: null },
    { timestamp: new Date(now.getTime() - 2000).toISOString(), level: 'warn', service: 'nas', message: 'disk low', payload: null },
    { timestamp: new Date(now.getTime() - 3000).toISOString(), level: 'error', service: 'nas', message: 'disk full', payload: null },
    { timestamp: new Date(now.getTime() - 4000).toISOString(), level: 'info', service: 'plex', message: 'stream started', payload: null },
  ]
  for (const e of entries) {
    db.insert(appLogs).values(e).run()
  }
}

describe('Log API routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    initDb()
    app = Fastify({ logger: false })
    await app.register(logRoutes)
    await app.register(settingsRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    getDb().delete(appLogs).run()
    getDb().delete(kvStore).run()
  })

  describe('GET /api/logs', () => {
    it('returns entries with correct structure', async () => {
      seedLogs()
      const res = await app.inject({ method: 'GET', url: '/api/logs' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body).toHaveProperty('entries')
      expect(body).toHaveProperty('total')
      expect(Array.isArray(body.entries)).toBe(true)
      expect(body.total).toBe(4)
      const entry = body.entries[0]
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('timestamp')
      expect(entry).toHaveProperty('level')
      expect(entry).toHaveProperty('service')
      expect(entry).toHaveProperty('message')
    })

    it('filters to warn+error when level=warn', async () => {
      seedLogs()
      const res = await app.inject({ method: 'GET', url: '/api/logs?level=warn' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      for (const entry of body.entries) {
        expect(['warn', 'error']).toContain(entry.level)
      }
      expect(body.total).toBe(2)
    })

    it('filters to error only when level=error', async () => {
      seedLogs()
      const res = await app.inject({ method: 'GET', url: '/api/logs?level=error' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      for (const entry of body.entries) {
        expect(entry.level).toBe('error')
      }
      expect(body.total).toBe(1)
    })

    it('filters by service when service=nas', async () => {
      seedLogs()
      const res = await app.inject({ method: 'GET', url: '/api/logs?service=nas' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      for (const entry of body.entries) {
        expect(entry.service).toBe('nas')
      }
      expect(body.total).toBe(2)
    })

    it('returns all entries when level=all', async () => {
      seedLogs()
      const res = await app.inject({ method: 'GET', url: '/api/logs?level=all' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.total).toBe(4)
    })
  })

  describe('POST /api/logs/purge', () => {
    it('deletes all entries when olderThanDays=0', async () => {
      seedLogs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/logs/purge',
        payload: { olderThanDays: 0 },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body).toHaveProperty('deleted')
      expect(typeof body.deleted).toBe('number')
      expect(body.deleted).toBeGreaterThan(0)

      const remaining = getDb().select().from(appLogs).all()
      expect(remaining.length).toBe(0)
    })

    it('returns deleted: 0 when no entries match', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/logs/purge',
        payload: { olderThanDays: 365 },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.deleted).toBe(0)
    })
  })

  describe('GET /api/logs/export', () => {
    it('returns Content-Disposition header with JSON attachment', async () => {
      seedLogs()
      const res = await app.inject({ method: 'GET', url: '/api/logs/export' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-disposition']).toMatch(/attachment/)
      expect(res.headers['content-disposition']).toMatch(/coruscant-logs-\d{4}-\d{2}-\d{2}\.json/)
    })

    it('returns a JSON array of log entries', async () => {
      seedLogs()
      const res = await app.inject({ method: 'GET', url: '/api/logs/export' })
      const body = JSON.parse(res.body)
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(4)
    })

    it('filters by level in export', async () => {
      seedLogs()
      const res = await app.inject({ method: 'GET', url: '/api/logs/export?level=error' })
      const body = JSON.parse(res.body)
      expect(Array.isArray(body)).toBe(true)
      for (const entry of body) {
        expect(entry.level).toBe('error')
      }
    })
  })

  describe('GET /api/settings/logs-retention', () => {
    it('returns default retentionDays=7 when not set', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings/logs-retention' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.retentionDays).toBe(7)
    })
  })

  describe('POST /api/settings/logs-retention', () => {
    it('persists retentionDays=14 and returns success', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/logs-retention',
        payload: { retentionDays: 14 },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.success).toBe(true)
      expect(body.retentionDays).toBe(14)

      // Verify it persisted
      const getRes = await app.inject({ method: 'GET', url: '/api/settings/logs-retention' })
      const getBody = JSON.parse(getRes.body)
      expect(getBody.retentionDays).toBe(14)
    })

    it('returns 400 for out-of-range retentionDays', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/logs-retention',
        payload: { retentionDays: 0 },
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 for retentionDays > 365', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/logs-retention',
        payload: { retentionDays: 366 },
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
