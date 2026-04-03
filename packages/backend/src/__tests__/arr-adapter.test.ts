import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { pollArr } from '../adapters/arr.js'

vi.mock('axios')

const mockAxios = vi.mocked(axios)

describe('pollArr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns online status when health endpoint returns empty array', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ status: 200, data: [] })

    const result = await pollArr('radarr', 'Radarr', 'http://localhost:7878', 'test-key')

    expect(result.status).toBe('online')
    expect(result.configured).toBe(true)
    expect(result.id).toBe('radarr')
    expect(result.name).toBe('Radarr')
    expect(result.tier).toBe('status')
    expect(result.lastPollAt).toBeTruthy()
  })

  it('returns warning status when health items include type Warning', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: [
        { source: 'IndexerStatusCheck', type: 'Warning', message: 'Indexer unavailable', wikiUrl: '' },
      ],
    })

    const result = await pollArr('sonarr', 'Sonarr', 'http://localhost:8989', 'test-key')

    expect(result.status).toBe('warning')
    expect(result.configured).toBe(true)
  })

  it('returns warning status when health items include type Error', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: [
        { source: 'IndexerCheck', type: 'Error', message: 'No indexers configured', wikiUrl: '' },
      ],
    })

    const result = await pollArr('lidarr', 'Lidarr', 'http://localhost:8686', 'test-key')

    expect(result.status).toBe('warning')
    expect(result.configured).toBe(true)
  })

  it('returns online status when health items only include type Ok or Notice', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({
      status: 200,
      data: [
        { source: 'ApplicationLongTermStatusCheck', type: 'Ok', message: '', wikiUrl: '' },
        { source: 'SystemTimeCheck', type: 'Notice', message: 'NTP time drift minimal', wikiUrl: '' },
      ],
    })

    const result = await pollArr('prowlarr', 'Prowlarr', 'http://localhost:9696', 'test-key')

    expect(result.status).toBe('online')
    expect(result.configured).toBe(true)
  })

  it('returns offline status on network error (ECONNREFUSED)', async () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:7878')
    mockAxios.get = vi.fn().mockRejectedValue(err)

    const result = await pollArr('radarr', 'Radarr', 'http://localhost:7878', 'test-key')

    expect(result.status).toBe('offline')
    expect(result.configured).toBe(true)
  })

  it('returns offline status on 401 Unauthorized (per D-19)', async () => {
    const err = Object.assign(new Error('Request failed with status code 401'), {
      response: { status: 401 },
    })
    mockAxios.get = vi.fn().mockRejectedValue(err)

    const result = await pollArr('radarr', 'Radarr', 'http://localhost:7878', 'bad-key')

    expect(result.status).toBe('offline')
    expect(result.configured).toBe(true)
  })

  it('sends X-Api-Key header', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ status: 200, data: [] })

    await pollArr('radarr', 'Radarr', 'http://localhost:7878', 'my-api-key')

    expect(mockAxios.get).toHaveBeenCalledWith(
      'http://localhost:7878/api/v3/health',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Api-Key': 'my-api-key' }),
      })
    )
  })

  it('includes health warnings in metrics when status is warning', async () => {
    const warnings = [
      { source: 'IndexerStatusCheck', type: 'Warning', message: 'Indexer down', wikiUrl: '' },
    ]
    mockAxios.get = vi.fn().mockResolvedValue({ status: 200, data: warnings })

    const result = await pollArr('radarr', 'Radarr', 'http://localhost:7878', 'key')

    expect(result.metrics).toBeDefined()
    expect((result.metrics as Record<string, unknown>)?.healthWarnings).toHaveLength(1)
  })
})
