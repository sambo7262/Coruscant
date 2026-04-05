import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')

const mockAxios = vi.mocked(axios)

// Reset session cache between tests by re-importing the module with vi.isolateModules
// We use vi.resetModules in beforeEach to clear session singletons
describe('pollPihole', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns online status with metrics when all endpoints return valid data and blocking=enabled', async () => {
    // Auth POST
    mockAxios.post = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        session: {
          sid: 'test-sid-123',
          validity: 1800,
        },
      },
    })

    mockAxios.get = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        // /api/stats/summary
        status: 200,
        data: {
          queries: { total: 12000, blocked: 3000, percent_blocked: 25, frequency: 8.3 },
          gravity: { domains_being_blocked: 150000 },
        },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        // /api/dns/blocking
        status: 200,
        data: { blocking: 'enabled' },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        // /api/info/system
        status: 200,
        data: {
          system: {
            cpu: { load: [0.5, 0.6, 0.7] },
            memory: { ram: { used: 512 * 1024 * 1024, total: 1024 * 1024 * 1024 } },
          },
        },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        // /api/stats/query_types
        status: 200,
        data: {
          types: {
            'A (IPv4)': 8000,
            'AAAA (IPv6)': 2000,
            'HTTPS': 2000,
          },
        },
      }))

    const { pollPihole } = await import('../adapters/pihole.js')
    const result = await pollPihole('http://pihole.local', 'password123')

    expect(result.status).toBe('online')
    expect(result.id).toBe('pihole')
    expect(result.name).toBe('Pi-hole')
    expect(result.tier).toBe('status')
    expect(result.configured).toBe(true)
    expect(result.metrics).toBeDefined()

    const metrics = result.metrics as Record<string, unknown>
    expect(metrics.blockingActive).toBe(true)
    expect(metrics.queriesPerMinute).toBe(8.3)
    expect(metrics.totalQueriesDay).toBe(12000)
    expect(metrics.totalBlockedDay).toBe(3000)
    expect(metrics.percentBlocked).toBe(25)
    expect(metrics.domainsBlocked).toBe(150000)
  })

  it('returns warning status when blocking=disabled (amber LED per D-05)', async () => {
    mockAxios.post = vi.fn().mockResolvedValue({
      status: 200,
      data: { session: { sid: 'test-sid-456', validity: 1800 } },
    })

    mockAxios.get = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: {
          queries: { total: 5000, blocked: 0, percent_blocked: 0, frequency: 3.0 },
          gravity: { domains_being_blocked: 100000 },
        },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: { blocking: 'disabled' },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: {
          system: {
            cpu: { load: [0.2] },
            memory: { ram: { used: 256 * 1024 * 1024, total: 1024 * 1024 * 1024 } },
          },
        },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: { types: {} },
      }))

    const { pollPihole } = await import('../adapters/pihole.js')
    const result = await pollPihole('http://pihole.local', 'password123')

    expect(result.status).toBe('warning')
    const metrics = result.metrics as Record<string, unknown>
    expect(metrics.blockingActive).toBe(false)
  })

  it('returns offline status on network error / timeout', async () => {
    mockAxios.post = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 192.168.1.1:80'))

    const { pollPihole } = await import('../adapters/pihole.js')
    const result = await pollPihole('http://pihole.local', 'password123')

    expect(result.status).toBe('offline')
    expect(result.configured).toBe(true)
    expect(result.metrics).toBeDefined()
  })

  it('re-authenticates (calls /api/auth again) when a 401 is received, then retries', async () => {
    let callCount = 0
    mockAxios.post = vi.fn().mockResolvedValue({
      status: 200,
      data: { session: { sid: 'fresh-sid-789', validity: 1800 } },
    })

    mockAxios.get = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount <= 4) {
        // First set of 4 requests (parallel) → 401
        const err = Object.assign(new Error('Request failed with status code 401'), {
          response: { status: 401 },
        })
        return Promise.reject(err)
      }
      // Retry calls succeed
      if (callCount === 5) {
        return Promise.resolve({
          status: 200,
          data: {
            queries: { total: 1000, blocked: 100, percent_blocked: 10, frequency: 2.0 },
            gravity: { domains_being_blocked: 50000 },
          },
        })
      }
      if (callCount === 6) {
        return Promise.resolve({ status: 200, data: { blocking: 'enabled' } })
      }
      if (callCount === 7) {
        return Promise.resolve({
          status: 200,
          data: {
            system: {
              cpu: { load: [0.1] },
              memory: { ram: { used: 100 * 1024 * 1024, total: 1024 * 1024 * 1024 } },
            },
          },
        })
      }
      return Promise.resolve({ status: 200, data: { types: {} } })
    })

    const { pollPihole } = await import('../adapters/pihole.js')
    const result = await pollPihole('http://pihole.local', 'password123')

    // Should have called post twice (initial auth + re-auth after 401)
    expect(mockAxios.post).toHaveBeenCalledTimes(2)
    expect(result.status).toBe('online')
  })

  it('includes queryTypes in metrics as Record<string,number> from /api/stats/query_types (per D-06)', async () => {
    mockAxios.post = vi.fn().mockResolvedValue({
      status: 200,
      data: { session: { sid: 'sid-qt', validity: 1800 } },
    })

    const mockQueryTypes = {
      'A (IPv4)': 5000,
      'AAAA (IPv6)': 1500,
      'HTTPS': 800,
    }

    mockAxios.get = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: {
          queries: { total: 7300, blocked: 1200, percent_blocked: 16.4, frequency: 5.1 },
          gravity: { domains_being_blocked: 120000 },
        },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: { blocking: 'enabled' },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: {
          system: {
            cpu: { load: [0.3] },
            memory: { ram: { used: 300 * 1024 * 1024, total: 1024 * 1024 * 1024 } },
          },
        },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: { types: mockQueryTypes },
      }))

    const { pollPihole } = await import('../adapters/pihole.js')
    const result = await pollPihole('http://pihole.local', 'password123')

    expect(result.status).toBe('online')
    const metrics = result.metrics as Record<string, unknown>
    expect(metrics.queryTypes).toBeDefined()
    const queryTypes = metrics.queryTypes as Record<string, number>
    expect(queryTypes['A (IPv4)']).toBe(5000)
    expect(queryTypes['AAAA (IPv6)']).toBe(1500)
    expect(queryTypes['HTTPS']).toBe(800)
  })
})
