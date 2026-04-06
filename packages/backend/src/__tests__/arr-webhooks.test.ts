import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

// Mock pollManager to capture handleArrEvent calls
vi.mock('../poll-manager.js', () => {
  const handleArrEvent = vi.fn()
  const pollManager = { handleArrEvent }
  return { pollManager }
})

describe('arrWebhookRoutes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    app = Fastify({ logger: false })
    const { arrWebhookRoutes } = await import('../routes/arr-webhooks.js')
    await app.register(arrWebhookRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('POST /api/webhooks/radarr with Grab payload returns 200 and calls handleArrEvent', async () => {
    const { pollManager } = await import('../poll-manager.js')

    const payload = { eventType: 'Grab', movie: { title: 'The Dark Knight' } }

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/radarr',
      payload,
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(pollManager.handleArrEvent).toHaveBeenCalledOnce()
    expect(pollManager.handleArrEvent).toHaveBeenCalledWith('radarr', payload)
  })

  it('POST /api/webhooks/sonarr with Download payload returns 200 and calls handleArrEvent', async () => {
    const { pollManager } = await import('../poll-manager.js')

    const payload = { eventType: 'Download', series: { title: 'Severance' }, episodes: [{ episodeNumber: 8, seasonNumber: 2 }] }

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/sonarr',
      payload,
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(pollManager.handleArrEvent).toHaveBeenCalledOnce()
    expect(pollManager.handleArrEvent).toHaveBeenCalledWith('sonarr', payload)
  })

  it('POST /api/webhooks/prowlarr with Health payload returns 200', async () => {
    const { pollManager } = await import('../poll-manager.js')

    const payload = { eventType: 'Health', message: 'Indexer NZBGeek is unavailable', type: 'IndexerStatusCheck' }

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/prowlarr',
      payload,
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(pollManager.handleArrEvent).toHaveBeenCalledOnce()
    expect(pollManager.handleArrEvent).toHaveBeenCalledWith('prowlarr', payload)
  })

  it('POST /api/webhooks/radarr with empty body returns 200 with note: empty payload and does NOT call handleArrEvent', async () => {
    const { pollManager } = await import('../poll-manager.js')

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/radarr',
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(body.note).toBe('empty payload')
    expect(pollManager.handleArrEvent).not.toHaveBeenCalled()
  })

  it('POST /api/webhooks/radarr with unknown eventType Rename returns 200 and calls handleArrEvent', async () => {
    const { pollManager } = await import('../poll-manager.js')

    const payload = { eventType: 'Rename', movie: { title: 'Inception' } }

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/radarr',
      payload,
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)
    expect(pollManager.handleArrEvent).toHaveBeenCalledOnce()
    expect(pollManager.handleArrEvent).toHaveBeenCalledWith('radarr', payload)
  })

  it('All 7 service endpoints are registered and return 200', async () => {
    const services = ['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd']

    for (const service of services) {
      const response = await app.inject({
        method: 'POST',
        url: `/api/webhooks/${service}`,
        payload: { eventType: 'Test' },
      })
      expect(response.statusCode).toBe(200, `Expected 200 for /api/webhooks/${service}`)
    }
  })
})

describe('classifyArrEvent and extractArrTitle', () => {
  let classifyArrEvent: (raw: string) => string
  let extractArrTitle: (body: Record<string, unknown>) => string | undefined
  let SABNZBD_BURST_MS: number
  let SABNZBD_INTERVAL_MS: number

  beforeAll(async () => {
    const actual = await vi.importActual('../poll-manager.js') as Record<string, unknown>
    classifyArrEvent = actual.classifyArrEvent as (raw: string) => string
    extractArrTitle = actual.extractArrTitle as (body: Record<string, unknown>) => string | undefined
    SABNZBD_BURST_MS = actual.SABNZBD_BURST_MS as number
    SABNZBD_INTERVAL_MS = actual.SABNZBD_INTERVAL_MS as number
  })

  it('classifyArrEvent Grab returns grab', () => {
    expect(classifyArrEvent('Grab')).toBe('grab')
  })

  it('classifyArrEvent Download returns download_complete', () => {
    expect(classifyArrEvent('Download')).toBe('download_complete')
  })

  it('classifyArrEvent Health returns health_issue', () => {
    expect(classifyArrEvent('Health')).toBe('health_issue')
  })

  it('classifyArrEvent ApplicationUpdate returns update_available', () => {
    expect(classifyArrEvent('ApplicationUpdate')).toBe('update_available')
  })

  it('classifyArrEvent Rename returns unknown', () => {
    expect(classifyArrEvent('Rename')).toBe('unknown')
  })

  it('classifyArrEvent Test returns unknown', () => {
    expect(classifyArrEvent('Test')).toBe('unknown')
  })

  it('extractArrTitle returns movie title', () => {
    expect(extractArrTitle({ movie: { title: 'The Dark Knight' } })).toBe('The Dark Knight')
  })

  it('extractArrTitle returns series title', () => {
    expect(extractArrTitle({ series: { title: 'Severance' } })).toBe('Severance')
  })

  it('extractArrTitle returns artist name', () => {
    expect(extractArrTitle({ artist: { name: 'Radiohead' } })).toBe('Radiohead')
  })

  it('extractArrTitle returns author authorName', () => {
    expect(extractArrTitle({ author: { authorName: 'Andy Weir' } })).toBe('Andy Weir')
  })

  it('extractArrTitle returns message for Prowlarr health events', () => {
    expect(extractArrTitle({ message: 'Indexer NZBGeek is unavailable' })).toBe('Indexer NZBGeek is unavailable')
  })

  it('extractArrTitle returns undefined for empty body', () => {
    expect(extractArrTitle({})).toBeUndefined()
  })

  it('SABNZBD_BURST_MS equals 1000', () => {
    expect(SABNZBD_BURST_MS).toBe(1000)
  })

  it('SABNZBD_INTERVAL_MS equals 10000', () => {
    expect(SABNZBD_INTERVAL_MS).toBe(10000)
  })
})
