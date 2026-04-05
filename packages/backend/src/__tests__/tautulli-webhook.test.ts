import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import type { PlexStream, PlexServerStats } from '@coruscant/shared'

// Mock pollManager to capture updatePlexState calls
vi.mock('../poll-manager.js', () => {
  const updatePlexState = vi.fn()
  const pollManager = { updatePlexState }
  return { pollManager }
})

describe('tautulliWebhookRoutes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    app = Fastify({ logger: false })
    const { tautulliWebhookRoutes } = await import('../routes/tautulli-webhook.js')
    await app.register(tautulliWebhookRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('POST with play event adds stream to plexStreams and returns 200', async () => {
    const { pollManager } = await import('../poll-manager.js')

    const payload = {
      event: 'play',
      session_key: 'session-001',
      user: 'alice',
      title: 'Inception',
      grandparent_title: '',
      year: 2010,
      progress_percent: 5,
      quality_profile: '1080p',
      transcode_decision: 'direct play',
      stream_bandwidth: 8000,
      player: 'Apple TV',
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/tautulli',
      payload,
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(true)

    expect(pollManager.updatePlexState).toHaveBeenCalledOnce()
    const [streams] = (pollManager.updatePlexState as ReturnType<typeof vi.fn>).mock.calls[0] as [PlexStream[], PlexServerStats | undefined]
    expect(streams).toHaveLength(1)
    expect(streams[0].user).toBe('alice')
    expect(streams[0].title).toBe('Inception')
    expect(streams[0].deviceName).toBe('Apple TV')
    expect(streams[0].transcode).toBe(false)
    expect(streams[0].quality).toBe('1080p')
  })

  it('POST with stop event removes stream from plexStreams', async () => {
    const { pollManager } = await import('../poll-manager.js')

    // First add a stream
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/tautulli',
      payload: {
        event: 'play',
        session_key: 'session-002',
        user: 'bob',
        title: 'The Matrix',
        grandparent_title: '',
        year: 1999,
        progress_percent: 20,
        quality_profile: '4K',
        transcode_decision: 'transcode',
        stream_bandwidth: 40000,
        player: 'Chrome',
      },
    })

    // Now stop it
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/tautulli',
      payload: {
        event: 'stop',
        session_key: 'session-002',
        user: 'bob',
        title: 'The Matrix',
        grandparent_title: '',
        year: 1999,
        progress_percent: 85,
        quality_profile: '4K',
        transcode_decision: 'transcode',
        stream_bandwidth: 0,
        player: 'Chrome',
      },
    })

    expect(response.statusCode).toBe(200)

    // Last call should have empty streams (session removed)
    const calls = (pollManager.updatePlexState as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = calls[calls.length - 1] as [PlexStream[], PlexServerStats | undefined]
    expect(lastCall[0]).toHaveLength(0)
  })

  it('POST with pause event updates stream state (keeps stream visible)', async () => {
    const { pollManager } = await import('../poll-manager.js')

    // Add stream first
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/tautulli',
      payload: {
        event: 'play',
        session_key: 'session-003',
        user: 'charlie',
        title: 'Breaking Bad',
        grandparent_title: 'Breaking Bad',
        parent_media_index: 1,
        media_index: 3,
        progress_percent: 30,
        quality_profile: '1080p',
        transcode_decision: 'direct play',
        stream_bandwidth: 8000,
        player: 'Roku',
      },
    })

    // Pause
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/tautulli',
      payload: {
        event: 'pause',
        session_key: 'session-003',
        user: 'charlie',
        title: 'Breaking Bad',
        grandparent_title: 'Breaking Bad',
        parent_media_index: 1,
        media_index: 3,
        progress_percent: 45,
        quality_profile: '1080p',
        transcode_decision: 'direct play',
        stream_bandwidth: 8000,
        player: 'Roku',
      },
    })

    expect(response.statusCode).toBe(200)

    // Stream should still be present after pause
    const calls = (pollManager.updatePlexState as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = calls[calls.length - 1] as [PlexStream[], PlexServerStats | undefined]
    expect(lastCall[0]).toHaveLength(1)
    expect(lastCall[0][0].progressPercent).toBe(45)
  })

  it('returns 200 for empty body (no JSON template configured in Tautulli)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/tautulli',
      payload: {},
    })

    expect(response.statusCode).toBe(200)
  })

  it('correctly maps Tautulli payload fields to PlexStream type including deviceName from player', async () => {
    const { pollManager } = await import('../poll-manager.js')

    const payload = {
      event: 'play',
      session_key: 'session-tv-001',
      user: 'diana',
      title: 'Pilot',
      grandparent_title: 'The Sopranos',
      parent_media_index: 1,
      media_index: 1,
      year: 1999,
      progress_percent: 15,
      quality_profile: '720p',
      transcode_decision: 'transcode',
      stream_bandwidth: 5000,
      player: 'Samsung TV',
    }

    await app.inject({
      method: 'POST',
      url: '/api/webhooks/tautulli',
      payload,
    })

    const [streams] = (pollManager.updatePlexState as ReturnType<typeof vi.fn>).mock.calls[0] as [PlexStream[], PlexServerStats | undefined]
    const stream = streams[0]

    // Verify all field mappings
    expect(stream.user).toBe('diana')
    expect(stream.title).toBe('The Sopranos') // grandparent_title takes precedence
    expect(stream.deviceName).toBe('Samsung TV') // maps from player (Warning 1)
    expect(stream.season).toBe(1) // parent_media_index
    expect(stream.episode).toBe(1) // media_index
    expect(stream.year).toBe(1999)
    expect(stream.progressPercent).toBe(15)
    expect(stream.quality).toBe('720p')
    expect(stream.transcode).toBe(true) // transcode_decision === 'transcode'
  })
})
