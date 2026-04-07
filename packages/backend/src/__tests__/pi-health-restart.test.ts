import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'

// Must set env vars BEFORE any imports that read them
process.env.DB_PATH = ':memory:'

// Mock ssh2 Client — execHandler is set per-test to control SSH behavior
let execHandler: ((cmd: string, cb: (err: Error | null, stream: unknown) => void) => void) | null = null
let connectBehavior: 'ready' | 'error' = 'ready'
let connectError: Error | null = null

vi.mock('ssh2', () => {
  return {
    Client: vi.fn().mockImplementation(function (this: unknown) {
      const handlers: Record<string, (...args: unknown[]) => void> = {}
      const instance = {
        on(event: string, cb: (...args: unknown[]) => void) {
          handlers[event] = cb
          return instance
        },
        connect(_opts: unknown) {
          if (connectBehavior === 'error' && handlers['error']) {
            handlers['error'](connectError ?? new Error('Connection failed'))
          } else if (handlers['ready']) {
            handlers['ready']()
          }
        },
        exec(cmd: string, cb: (err: Error | null, stream: unknown) => void) {
          if (execHandler) {
            execHandler(cmd, cb)
          } else {
            cb(new Error('No exec handler configured'), null)
          }
        },
        end() {},
      }
      return instance
    }),
  }
})

import { piHealthRestartRoutes } from '../routes/pi-health-restart.js'
import { getDb } from '../db.js'

function getRawClient(): Database.Database {
  const db = getDb() as unknown as { $client: Database.Database }
  return db.$client
}

function bootstrapTestDb() {
  getDb()
  const raw = getRawClient()
  raw.prepare(`
    CREATE TABLE IF NOT EXISTS service_config (
      service_name TEXT PRIMARY KEY NOT NULL,
      base_url TEXT NOT NULL DEFAULT '',
      encrypted_api_key TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `).run()
}

function clearServiceConfig() {
  const raw = getRawClient()
  raw.prepare('DELETE FROM service_config').run()
}

function insertPiHealthConfig(baseUrl: string, username: string) {
  const raw = getRawClient()
  raw.prepare(
    'INSERT OR REPLACE INTO service_config (service_name, base_url, encrypted_api_key, username, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('piHealth', baseUrl, '', username, 1, new Date().toISOString())
}

describe('pi-health restart route', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    bootstrapTestDb()
    app = Fastify()
    await app.register(piHealthRestartRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    clearServiceConfig()
    execHandler = null
    connectBehavior = 'ready'
    connectError = null
  })

  it('returns failure when password is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/pi-health/restart',
      payload: { password: '' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(false)
    expect(body.message).toBe('Password is required')
  })

  it('returns failure when password is missing from body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/pi-health/restart',
      payload: {},
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(false)
    expect(body.message).toBe('Password is required')
  })

  it('returns failure when pi health is not configured', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/pi-health/restart',
      payload: { password: 'secret123' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(false)
    expect(body.message).toBe('Pi health not configured')
  })

  it('returns failure when username contains shell metacharacters', async () => {
    insertPiHealthConfig('http://192.168.86.233:7575', 'admin;rm -rf /')

    const res = await app.inject({
      method: 'POST',
      url: '/api/pi-health/restart',
      payload: { password: 'secret123' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(false)
    expect(body.message).toBe('Invalid SSH username in config')
  })

  it('returns success when SSH exec exits with code 0', async () => {
    insertPiHealthConfig('http://192.168.86.233:7575', 'pi')

    execHandler = (_cmd: string, cb: (err: Error | null, stream: unknown) => void) => {
      const streamHandlers: Record<string, (...args: unknown[]) => void> = {}
      const stream = {
        on(event: string, handler: (...args: unknown[]) => void) {
          streamHandlers[event] = handler
          return stream
        },
        stderr: {
          on(_event: string, _handler: (...args: unknown[]) => void) {
            return stream.stderr
          },
        },
      }
      cb(null, stream)
      // Simulate close with exit code 0
      if (streamHandlers['close']) {
        streamHandlers['close'](0)
      }
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/pi-health/restart',
      payload: { password: 'secret123' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.message).toBe('Service restarted successfully')
  })

  it('returns failure when SSH exec exits with non-zero code', async () => {
    insertPiHealthConfig('http://192.168.86.233:7575', 'pi')

    execHandler = (_cmd: string, cb: (err: Error | null, stream: unknown) => void) => {
      const streamHandlers: Record<string, (...args: unknown[]) => void> = {}
      const stderrHandlers: Record<string, (...args: unknown[]) => void> = {}
      const stream = {
        on(event: string, handler: (...args: unknown[]) => void) {
          streamHandlers[event] = handler
          return stream
        },
        stderr: {
          on(event: string, handler: (...args: unknown[]) => void) {
            stderrHandlers[event] = handler
            return stream.stderr
          },
        },
      }
      cb(null, stream)
      // Send stderr then close with non-zero
      if (stderrHandlers['data']) {
        stderrHandlers['data'](Buffer.from('permission denied'))
      }
      if (streamHandlers['close']) {
        streamHandlers['close'](1)
      }
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/pi-health/restart',
      payload: { password: 'secret123' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(false)
    expect(body.message).toBe('permission denied')
  })
})
