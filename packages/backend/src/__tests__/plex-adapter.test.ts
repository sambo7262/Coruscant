import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { fetchPlexSessions } from '../adapters/plex.js'

vi.mock('axios')

const mockAxios = vi.mocked(axios)

function makeSessionsResponse(metadata?: unknown[]) {
  return {
    status: 200,
    data: {
      MediaContainer: {
        ...(metadata !== undefined ? { Metadata: metadata } : {}),
      },
    },
  }
}

function makeMovieItem(overrides: Record<string, unknown> = {}) {
  return {
    type: 'movie',
    title: 'Inception',
    year: 2010,
    User: { title: 'alice' },
    Player: { title: 'Apple TV' },
    Media: [{ videoResolution: '1080' }],
    ...overrides,
  }
}

function makeEpisodeItem(overrides: Record<string, unknown> = {}) {
  return {
    type: 'episode',
    title: 'Pilot',
    grandparentTitle: 'Breaking Bad',
    parentIndex: 1,
    index: 1,
    User: { title: 'bob' },
    Player: { title: 'Chrome' },
    Media: [{ videoResolution: '720' }],
    ...overrides,
  }
}

function makeTrackItem(overrides: Record<string, unknown> = {}) {
  return {
    type: 'track',
    title: 'Bohemian Rhapsody',
    grandparentTitle: 'Queen',
    User: { title: 'charlie' },
    Player: { title: 'Plexamp on iPhone' },
    Media: [{}],
    ...overrides,
  }
}

describe('fetchPlexSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a PlexStream for a movie with bare title and transcode=false (direct play)', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([makeMovieItem()]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Inception')
    expect(result[0].user).toBe('alice')
    expect(result[0].deviceName).toBe('Apple TV')
    expect(result[0].year).toBe(2010)
    expect(result[0].quality).toBe('1080')
    expect(result[0].transcode).toBe(false)
    expect(result[0].progressPercent).toBe(0)
  })

  it('formats TV episode title as grandparentTitle - title', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([makeEpisodeItem()]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Breaking Bad - Pilot')
    expect(result[0].season).toBe(1)
    expect(result[0].episode).toBe(1)
    expect(result[0].transcode).toBe(false)
  })

  it('formats music track title as grandparentTitle - title', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([makeTrackItem()]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Queen - Bohemian Rhapsody')
    expect(result[0].deviceName).toBe('Plexamp on iPhone')
  })

  it('sets transcode=true when TranscodeSession is present', async () => {
    const item = makeMovieItem({ TranscodeSession: { videoDecision: 'transcode' } })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([item]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result[0].transcode).toBe(true)
  })

  it('sets transcode=false when TranscodeSession is absent (Direct Play)', async () => {
    const item = makeMovieItem() // no TranscodeSession
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([item]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result[0].transcode).toBe(false)
  })

  it('returns [] for empty Metadata array (idle state)', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result).toEqual([])
  })

  it('returns [] when Metadata key is missing from MediaContainer', async () => {
    // makeSessionsResponse with no argument omits Metadata
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse())

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result).toEqual([])
  })

  it('returns [] on network error — never throws', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(fetchPlexSessions('http://plex:32400', 'TOKEN')).resolves.toEqual([])
  })

  it('maps Player.title to deviceName', async () => {
    const item = makeMovieItem({ Player: { title: 'Samsung TV' } })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([item]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result[0].deviceName).toBe('Samsung TV')
  })

  it('uses Unknown quality when Media is absent', async () => {
    const item = makeMovieItem({ Media: undefined })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([item]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result[0].quality).toBe('Unknown')
  })

  it('passes Accept: application/json and X-Plex-Token in request', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([]))

    await fetchPlexSessions('http://plex:32400', 'MY_TOKEN')

    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('X-Plex-Token=MY_TOKEN'),
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    )
  })

  it('sets mediaType=audio for track type with codec quality and album/track fields', async () => {
    const trackItem = makeTrackItem({
      parentTitle: 'A Night at the Opera',
      Media: [{ audioCodec: 'flac', bitrate: 1411 }],
    })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([trackItem]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('audio')
    expect(result[0].albumName).toBe('A Night at the Opera')
    expect(result[0].trackTitle).toBe('Bohemian Rhapsody')
    expect(result[0].quality).toBe('FLAC 1411k')
    expect(result[0].season).toBeUndefined()
    expect(result[0].episode).toBeUndefined()
  })

  it('sets mediaType=video for movie type with no album/track fields', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([makeMovieItem()]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result[0].mediaType).toBe('video')
    expect(result[0].albumName).toBeUndefined()
    expect(result[0].trackTitle).toBeUndefined()
  })

  it('formats audio quality as codec uppercase without bitrate when bitrate absent', async () => {
    const trackItem = makeTrackItem({
      parentTitle: 'Some Album',
      Media: [{ audioCodec: 'aac' }],
    })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([trackItem]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result[0].quality).toBe('AAC')
  })
})
