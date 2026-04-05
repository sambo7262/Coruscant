import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

// Must set env vars BEFORE importing anything that reads them
process.env.DB_PATH = ':memory:'
process.env.ENCRYPTION_KEY_SEED = 'test-seed-for-settings-tests'

import { settingsRoutes } from '../routes/settings.js'
import { getDb } from '../db.js'

/**
 * Bootstrap the shared singleton DB with the service_config table.
 * The settings route uses getDb() which returns the singleton.
 * For tests we use :memory: (set above) and create tables manually.
 */
function bootstrapTestDb() {
  const db = getDb()
  db.run(`
    CREATE TABLE IF NOT EXISTS service_config (
      service_name TEXT PRIMARY KEY,
      base_url TEXT NOT NULL DEFAULT '',
      encrypted_api_key TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `)
}

describe('Settings API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    bootstrapTestDb()
    app = Fastify()
    await app.register(settingsRoutes)
    await app.ready()
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

  describe('POST /api/settings/:serviceId — preserve existing key on empty apiKey re-save', () => {
    it('preserves existing encrypted key when re-saving with empty apiKey (NAS / Plex re-save flow)', async () => {
      // Use radarr (arr adapter) — fails fast with ECONNREFUSED on a reserved port, no timeout
      // This tests the settings persistence logic without triggering a slow network timeout
      await app.inject({
        method: 'POST',
        url: '/api/settings/radarr',
        payload: { baseUrl: 'http://127.0.0.1:1', apiKey: 'secretapikey' },
      })

      // Verify key was saved
      const afterFirstSave = await app.inject({ method: 'GET', url: '/api/settings/radarr' })
      const firstBody = JSON.parse(afterFirstSave.body)
      expect(firstBody.hasApiKey).toBe(true)
      expect(firstBody.baseUrl).toBe('http://127.0.0.1:1')

      // Re-save with same URL but empty apiKey (simulates user clicking Save without re-entering the key)
      await app.inject({
        method: 'POST',
        url: '/api/settings/radarr',
        payload: { baseUrl: 'http://127.0.0.1:1', apiKey: '' },
      })

      // Key must still be preserved — not wiped to ''
      const afterResave = await app.inject({ method: 'GET', url: '/api/settings/radarr' })
      const resaveBody = JSON.parse(afterResave.body)
      expect(resaveBody.hasApiKey).toBe(true)
      expect(resaveBody.baseUrl).toBe('http://127.0.0.1:1')
    })
  })

  describe('GET /api/settings — list all services', () => {
    it('returns an array with all 11 known services', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBe(11)

      const serviceIds = body.map((s: { serviceName: string }) => s.serviceName)
      expect(serviceIds).toContain('radarr')
      expect(serviceIds).toContain('sonarr')
      expect(serviceIds).toContain('lidarr')
      expect(serviceIds).toContain('bazarr')
      expect(serviceIds).toContain('prowlarr')
      expect(serviceIds).toContain('readarr')
      expect(serviceIds).toContain('sabnzbd')
      expect(serviceIds).toContain('pihole')
      expect(serviceIds).toContain('plex')
      expect(serviceIds).toContain('nas')
      expect(serviceIds).toContain('unifi')
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
