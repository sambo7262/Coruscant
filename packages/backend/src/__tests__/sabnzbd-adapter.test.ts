import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { pollSabnzbd } from '../adapters/sabnzbd.js'

vi.mock('axios')

const mockAxios = vi.mocked(axios)

function makeQueueResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: 200,
    data: {
      queue: {
        status: 'Downloading',
        kbpersec: '10240',    // 10240 KB/s = 10 MB/s
        noofslots: 2,
        slots: [
          { status: 'Downloading', percentage: '45' },
        ],
        ...overrides,
      },
    },
  }
}

describe('pollSabnzbd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns online status and correct speed when downloading', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeQueueResponse())

    const result = await pollSabnzbd('http://localhost:8080', 'test-key')

    expect(result.status).toBe('online')
    expect(result.configured).toBe(true)
    expect(result.tier).toBe('activity')
    expect(result.id).toBe('sabnzbd')
    expect(result.name).toBe('SABnzbd')
    const metrics = result.metrics as Record<string, unknown>
    expect(metrics?.speedMBs).toBe(10)  // 10240 / 1024 = 10
  })

  it('returns warning status when a slot has Failed status', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(
      makeQueueResponse({ slots: [{ status: 'Failed', percentage: '0' }] })
    )

    const result = await pollSabnzbd('http://localhost:8080', 'test-key')

    expect(result.status).toBe('warning')
    expect(result.configured).toBe(true)
    const metrics = result.metrics as Record<string, unknown>
    expect(metrics?.hasFailedItems).toBe(true)
  })

  it('returns queueCount from noofslots', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeQueueResponse({ noofslots: 5 }))

    const result = await pollSabnzbd('http://localhost:8080', 'test-key')

    const metrics = result.metrics as Record<string, unknown>
    expect(metrics?.queueCount).toBe(5)
  })

  it('returns progressPercent from first slot percentage', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(
      makeQueueResponse({ slots: [{ status: 'Downloading', percentage: '73' }] })
    )

    const result = await pollSabnzbd('http://localhost:8080', 'test-key')

    const metrics = result.metrics as Record<string, unknown>
    expect(metrics?.progressPercent).toBe(73)
  })

  it('returns progressPercent 0 when no slots', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeQueueResponse({ slots: [] }))

    const result = await pollSabnzbd('http://localhost:8080', 'test-key')

    const metrics = result.metrics as Record<string, unknown>
    expect(metrics?.progressPercent).toBe(0)
  })

  it('returns offline status on network error', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await pollSabnzbd('http://localhost:8080', 'test-key')

    expect(result.status).toBe('offline')
    expect(result.configured).toBe(true)
  })

  it('includes sabStatus from queue status field', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeQueueResponse({ status: 'Paused' }))

    const result = await pollSabnzbd('http://localhost:8080', 'test-key')

    const metrics = result.metrics as Record<string, unknown>
    expect(metrics?.sabStatus).toBe('Paused')
  })

  it('uses mode=queue&output=json in request URL', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(makeQueueResponse())

    await pollSabnzbd('http://localhost:8080', 'my-api-key')

    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('mode=queue&output=json'),
      expect.any(Object)
    )
    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('apikey=my-api-key'),
      expect.any(Object)
    )
  })

  it('hasFailedItems is false when all slots are healthy', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(
      makeQueueResponse({ slots: [{ status: 'Downloading', percentage: '20' }] })
    )

    const result = await pollSabnzbd('http://localhost:8080', 'test-key')

    const metrics = result.metrics as Record<string, unknown>
    expect(metrics?.hasFailedItems).toBe(false)
  })
})
