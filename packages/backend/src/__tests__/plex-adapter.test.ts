import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { fetchPlexSessions, fetchPlexServerStats } from '../adapters/plex.js'

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

    expect(result.streams).toHaveLength(1)
    expect(result.streams[0].title).toBe('Inception')
    expect(result.streams[0].user).toBe('alice')
    expect(result.streams[0].deviceName).toBe('Apple TV')
    expect(result.streams[0].year).toBe(2010)
    expect(result.streams[0].quality).toBe('1080')
    expect(result.streams[0].transcode).toBe(false)
    expect(result.streams[0].progressPercent).toBe(0)
  })

  it('formats TV episode title as grandparentTitle - title', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([makeEpisodeItem()]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams).toHaveLength(1)
    expect(result.streams[0].title).toBe('Breaking Bad - Pilot')
    expect(result.streams[0].season).toBe(1)
    expect(result.streams[0].episode).toBe(1)
    expect(result.streams[0].transcode).toBe(false)
  })

  it('formats music track title as grandparentTitle - title', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([makeTrackItem()]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams).toHaveLength(1)
    expect(result.streams[0].title).toBe('Queen - Bohemian Rhapsody')
    expect(result.streams[0].deviceName).toBe('Plexamp on iPhone')
  })

  it('sets transcode=true when TranscodeSession is present', async () => {
    const item = makeMovieItem({ TranscodeSession: { videoDecision: 'transcode' } })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([item]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams[0].transcode).toBe(true)
  })

  it('sets transcode=false when TranscodeSession is absent (Direct Play)', async () => {
    const item = makeMovieItem() // no TranscodeSession
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([item]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams[0].transcode).toBe(false)
  })

  it('returns empty streams for empty Metadata array (idle state)', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams).toEqual([])
    expect(result.totalBandwidthKbps).toBe(0)
  })

  it('returns empty streams when Metadata key is missing from MediaContainer', async () => {
    // makeSessionsResponse with no argument omits Metadata
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse())

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams).toEqual([])
    expect(result.totalBandwidthKbps).toBe(0)
  })

  it('returns empty streams on network error — never throws', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')
    expect(result.streams).toEqual([])
    expect(result.totalBandwidthKbps).toBe(0)
  })

  it('maps Player.title to deviceName', async () => {
    const item = makeMovieItem({ Player: { title: 'Samsung TV' } })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([item]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams[0].deviceName).toBe('Samsung TV')
  })

  it('uses Unknown quality when Media is absent', async () => {
    const item = makeMovieItem({ Media: undefined })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([item]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams[0].quality).toBe('Unknown')
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

    expect(result.streams).toHaveLength(1)
    expect(result.streams[0].mediaType).toBe('audio')
    expect(result.streams[0].albumName).toBe('A Night at the Opera')
    expect(result.streams[0].trackTitle).toBe('Bohemian Rhapsody')
    expect(result.streams[0].quality).toBe('FLAC 1411k')
    expect(result.streams[0].season).toBeUndefined()
    expect(result.streams[0].episode).toBeUndefined()
  })

  it('sets mediaType=video for movie type with no album/track fields', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([makeMovieItem()]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams[0].mediaType).toBe('video')
    expect(result.streams[0].albumName).toBeUndefined()
    expect(result.streams[0].trackTitle).toBeUndefined()
  })

  it('formats audio quality as codec uppercase without bitrate when bitrate absent', async () => {
    const trackItem = makeTrackItem({
      parentTitle: 'Some Album',
      Media: [{ audioCodec: 'aac' }],
    })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([trackItem]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.streams[0].quality).toBe('AAC')
  })

  it('sums Session.bandwidth across all streams for totalBandwidthKbps', async () => {
    const item1 = makeMovieItem({ Session: { bandwidth: 3000 } })
    const item2 = makeEpisodeItem({ Session: { bandwidth: 2000 } })
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([item1, item2]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.totalBandwidthKbps).toBe(5000)
  })

  it('returns totalBandwidthKbps=0 when sessions have no Session.bandwidth', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeSessionsResponse([makeMovieItem()]))

    const result = await fetchPlexSessions('http://plex:32400', 'TOKEN')

    expect(result.totalBandwidthKbps).toBe(0)
  })
})

describe('fetchPlexServerStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeStatisticsResponse(entries?: unknown[]) {
    return {
      status: 200,
      data: {
        MediaContainer: {
          ...(entries !== undefined ? { StatisticsResources: entries } : {}),
        },
      },
    }
  }

  it('returns PlexServerStats from first StatisticsResources entry (happy path)', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(
      makeStatisticsResponse([
        { timeAt: 1712345678, cpuPercentage: 12.5, physMemMB: 512, totalPhysMemMB: 2048 },
      ])
    )

    const result = await fetchPlexServerStats('http://plex:32400', 'TOKEN', 5000)

    expect(result).toEqual({
      processCpuPercent: 12.5,
      processRamPercent: 25.0,
      bandwidthMbps: 5,
    })
  })

  it('uses only the first entry (most recent) when multiple entries present', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(
      makeStatisticsResponse([
        { timeAt: 1712345678, cpuPercentage: 30.0, physMemMB: 1024, totalPhysMemMB: 4096 },
        { timeAt: 1712345600, cpuPercentage: 10.0, physMemMB: 256, totalPhysMemMB: 4096 },
      ])
    )

    const result = await fetchPlexServerStats('http://plex:32400', 'TOKEN', 0)

    expect(result?.processCpuPercent).toBe(30.0)
    expect(result?.processRamPercent).toBe(25.0)
  })

  it('returns undefined when StatisticsResources array is empty', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeStatisticsResponse([]))

    const result = await fetchPlexServerStats('http://plex:32400', 'TOKEN', 0)

    expect(result).toBeUndefined()
  })

  it('returns undefined when StatisticsResources key is missing', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeStatisticsResponse())

    const result = await fetchPlexServerStats('http://plex:32400', 'TOKEN', 0)

    expect(result).toBeUndefined()
  })

  it('returns undefined on network error — never throws', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await fetchPlexServerStats('http://plex:32400', 'TOKEN', 0)

    expect(result).toBeUndefined()
  })

  it('returns bandwidthMbps=0 when sessionBandwidthKbps is 0', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(
      makeStatisticsResponse([
        { timeAt: 1712345678, cpuPercentage: 5.0, physMemMB: 100, totalPhysMemMB: 1000 },
      ])
    )

    const result = await fetchPlexServerStats('http://plex:32400', 'TOKEN', 0)

    expect(result?.bandwidthMbps).toBe(0)
  })

  it('rounds processRamPercent to 1 decimal place', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(
      makeStatisticsResponse([
        { timeAt: 1712345678, cpuPercentage: 10.0, physMemMB: 333, totalPhysMemMB: 1000 },
      ])
    )

    const result = await fetchPlexServerStats('http://plex:32400', 'TOKEN', 0)

    // 333/1000 * 100 = 33.3
    expect(result?.processRamPercent).toBe(33.3)
  })

  it('passes correct URL with timespan=6 and X-Plex-Token', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(
      makeStatisticsResponse([
        { timeAt: 1712345678, cpuPercentage: 5.0, physMemMB: 100, totalPhysMemMB: 1000 },
      ])
    )

    await fetchPlexServerStats('http://plex:32400', 'MY_TOKEN', 0)

    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/statistics/resources?timespan=6&X-Plex-Token=MY_TOKEN'),
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    )
  })
})
