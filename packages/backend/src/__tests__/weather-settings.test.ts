import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'

// Must set env vars BEFORE any imports that read them
process.env.DB_PATH = ':memory:'

vi.mock('../adapters/weather.js', () => ({
  geocodeZip: vi.fn(),
  fetchWeatherData: vi.fn(),
}))

import { weatherSettingsRoutes } from '../routes/weather-settings.js'
import { getDb } from '../db.js'

// Access the raw better-sqlite3 client for parameterized test data setup
function getRawClient(): Database.Database {
  // The drizzle db wraps a better-sqlite3 instance — access via the session's client
  // We can get a new :memory: instance on the same shared DB_PATH=:memory: connection
  // but since DB_PATH=:memory: creates a singleton, we use getDb's underlying client
  // which is available via Drizzle's internal $client property
  const db = getDb() as unknown as { $client: Database.Database }
  return db.$client
}

function bootstrapTestDb() {
  const db = getDb()
  db.run(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
}

function clearKvStore() {
  const raw = getRawClient()
  raw.prepare('DELETE FROM kv_store').run()
}

function insertKv(key: string, value: string) {
  const raw = getRawClient()
  raw.prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, new Date().toISOString())
}

function getKv(key: string): string | undefined {
  const raw = getRawClient()
  const row = raw.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}

describe('weather settings route', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    bootstrapTestDb()
    app = Fastify()
    await app.register(weatherSettingsRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    clearKvStore()
  })

  describe('POST /api/settings/weather', () => {
    it('geocodes zip and stores weather.zip, weather.lat, weather.lon in kvStore', async () => {
      const { geocodeZip } = await import('../adapters/weather.js')
      vi.mocked(geocodeZip).mockResolvedValueOnce({
        latitude: 37.7749,
        longitude: -122.4194,
        name: 'San Francisco',
        timezone: 'America/Los_Angeles',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/weather',
        payload: { zip: '94102' },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.success).toBe(true)
      expect(body.location).toBe('San Francisco')
      expect(body.lat).toBe(37.7749)
      expect(body.lon).toBe(-122.4194)

      expect(getKv('weather.zip')).toBe('94102')
      expect(getKv('weather.lat')).toBe('37.7749')
      expect(getKv('weather.lon')).toBe('-122.4194')
    })

    it('returns success:false with error message when geocoding fails for invalid zip', async () => {
      const { geocodeZip } = await import('../adapters/weather.js')
      vi.mocked(geocodeZip).mockRejectedValueOnce(new Error('No location found for zip'))

      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/weather',
        payload: { zip: '00000' },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.success).toBe(false)
      expect(body.error).toBe('No location found for zip')
    })

    it('returns 400 when zip is missing from request body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/weather',
        payload: {},
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /api/settings/weather', () => {
    it('returns configured:true with zip when weather.zip exists in kvStore', async () => {
      insertKv('weather.zip', '94102')

      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/weather',
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.zip).toBe('94102')
      expect(body.configured).toBe(true)
    })

    it('returns configured:false with zip:null when no weather.zip in kvStore', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings/weather',
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.zip).toBeNull()
      expect(body.configured).toBe(false)
    })
  })
})
