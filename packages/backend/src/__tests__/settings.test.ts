import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { settingsRoutes } from '../routes/settings.js'
import { createDb } from '../db.js'

// Isolated in-memory SQLite for settings tests
process.env.DB_PATH = ':memory:'
process.env.ENCRYPTION_KEY_SEED = 'test-seed-for-settings-tests'

/**
 * Create a Fastify instance with settings routes registered and
 * the service_config table created in-memory (no migrations needed).
 */
async function buildApp(): Promise<FastifyInstance> {
  const db = createDb(':memory:')
  db.run(`
    CREATE TABLE IF NOT EXISTS service_config (
      service_name TEXT PRIMARY KEY,
      base_url TEXT NOT NULL DEFAULT '',
      encrypted_api_key TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `)

  const fastify = Fastify()
  await fastify.register(settingsRoutes)
  await fastify.ready()
  return fastify
}

describe('Settings API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/settings/:serviceId — unconfigured service', () => {
    it('returns default empty values for an unknown service', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings/radarr' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.serviceName).toBe('radarr')
      expect(body.baseUrl).toBe('')
      expect(body.hasApiKey).toBe(false)
      expect(body.enabled).toBe(false)
    })

    it('returns 400 for an invalid serviceId', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings/minecraft' })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /api/settings/:serviceId — save config', () => {
    it('returns ok:true after saving a valid config', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/radarr',
        payload: { baseUrl: 'http://localhost:7878', apiKey: 'abc123' },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.ok).toBe(true)
    })

    it('returns 400 for an invalid serviceId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/minecraft',
        payload: { baseUrl: 'http://localhost:1234', apiKey: 'key' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /api/settings/:serviceId — after save', () => {
    it('returns baseUrl and hasApiKey=true but never the plaintext apiKey', async () => {
      // Save first
      await app.inject({
        method: 'POST',
        url: '/api/settings/sonarr',
        payload: { baseUrl: 'http://localhost:8989', apiKey: 'supersecret' },
      })

      const res = await app.inject({ method: 'GET', url: '/api/settings/sonarr' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)

      expect(body.serviceName).toBe('sonarr')
      expect(body.baseUrl).toBe('http://localhost:8989')
      expect(body.hasApiKey).toBe(true)
      expect(body.enabled).toBe(true)

      // CRITICAL: plaintext API key must never appear in response
      expect(body.apiKey).toBeUndefined()
      expect(body.encryptedApiKey).toBeUndefined()
      expect(JSON.stringify(body)).not.toContain('supersecret')
    })
  })

  describe('POST /api/settings/:serviceId — disable service', () => {
    it('disables service when both baseUrl and apiKey are empty', async () => {
      // First save a config
      await app.inject({
        method: 'POST',
        url: '/api/settings/lidarr',
        payload: { baseUrl: 'http://localhost:8686', apiKey: 'mykey' },
      })

      // Now disable it
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings/lidarr',
        payload: { baseUrl: '', apiKey: '' },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).ok).toBe(true)
    })
  })

  describe('GET /api/settings — list all services', () => {
    it('returns an array with all 7 known services', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(7)

      const serviceIds = body.map((s: { serviceName: string }) => s.serviceName)
      expect(serviceIds).toContain('radarr')
      expect(serviceIds).toContain('sonarr')
      expect(serviceIds).toContain('lidarr')
      expect(serviceIds).toContain('bazarr')
      expect(serviceIds).toContain('prowlarr')
      expect(serviceIds).toContain('readarr')
      expect(serviceIds).toContain('sabnzbd')
    })

    it('never includes plaintext API keys in list response', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings' })
      const body = JSON.parse(res.body)
      for (const svc of body) {
        expect(svc.apiKey).toBeUndefined()
        expect(svc.encryptedApiKey).toBeUndefined()
      }
    })
  })
})
