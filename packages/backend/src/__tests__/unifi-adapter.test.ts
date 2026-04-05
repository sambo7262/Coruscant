import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')

const mockAxios = vi.mocked(axios)

// Mock data fixtures
const sitesResponse = {
  data: { data: [{ siteId: 'abc123', internalId: 'default', name: 'Default' }] },
}

const devicesResponse = {
  data: {
    data: [
      {
        macAddress: '00:11:22',
        model: 'UDM-Pro',
        name: 'Gateway',
        state: 'online',
        uptime: 1209600,
        features: {},
      },
      {
        macAddress: '33:44:55',
        model: 'U6-Pro',
        name: 'Office AP',
        state: 'online',
        uptime: 86400,
        features: { access_point: { num_sta: 15 } },
      },
      {
        macAddress: '66:77:88',
        model: 'USW-24-PoE',
        name: 'Main Switch',
        state: 'online',
        uptime: 604800,
        features: {},
      },
    ],
  },
}

const clientsResponse = {
  data: { totalCount: 42, data: [] },
}

const statHealthResponse = {
  data: {
    data: [
      {
        subsystem: 'wan',
        'tx_bytes-r': 1250000,
        'rx_bytes-r': 8750000,
        status: 'ok',
      },
    ],
  },
}

describe('UniFi adapter', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('pollUnifi happy path returns ServiceStatus with status:online, clientCount=42, wanTxMbps, wanRxMbps, healthStatus=online, devices array', async () => {
    mockAxios.get = vi.fn()
      .mockResolvedValueOnce(sitesResponse)        // GET /sites
      .mockResolvedValueOnce(devicesResponse)      // GET /devices
      .mockResolvedValueOnce(clientsResponse)      // GET /clients
      .mockResolvedValueOnce(statHealthResponse)   // GET stat/health

    const { pollUnifi, resetUnifiCache } = await import('../adapters/unifi.js')
    resetUnifiCache()
    const result = await pollUnifi('https://unifi.local', 'test-api-key')

    expect(result.status).toBe('online')
    expect(result.id).toBe('unifi')
    expect(result.name).toBe('UniFi')
    expect(result.tier).toBe('rich')
    expect(result.configured).toBe(true)

    const metrics = result.metrics as Record<string, unknown>
    expect(metrics.clientCount).toBe(42)
    expect(typeof metrics.wanTxMbps).toBe('number')
    expect(typeof metrics.wanRxMbps).toBe('number')
    expect(metrics.healthStatus).toBe('online')
    expect(Array.isArray(metrics.devices)).toBe(true)
    const devices = metrics.devices as unknown[]
    expect(devices.length).toBe(3)
  })

  it('pollUnifi sends X-API-KEY header on all axios calls', async () => {
    mockAxios.get = vi.fn()
      .mockResolvedValueOnce(sitesResponse)
      .mockResolvedValueOnce(devicesResponse)
      .mockResolvedValueOnce(clientsResponse)
      .mockResolvedValueOnce(statHealthResponse)

    const { pollUnifi, resetUnifiCache } = await import('../adapters/unifi.js')
    resetUnifiCache()
    await pollUnifi('https://unifi.local', 'my-secret-key')

    const calls = (mockAxios.get as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.length).toBeGreaterThanOrEqual(3)
    for (const call of calls) {
      const config = call[1] as { headers?: Record<string, string> }
      expect(config?.headers?.['X-API-KEY']).toBe('my-secret-key')
    }
  })

  it('pollUnifi returns status:offline with no throw when axios rejects (network error)', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))

    const { pollUnifi, resetUnifiCache } = await import('../adapters/unifi.js')
    resetUnifiCache()

    let threw = false
    let result
    try {
      result = await pollUnifi('https://unifi.local', 'key')
    } catch {
      threw = true
    }

    expect(threw).toBe(false)
    expect(result!.status).toBe('offline')
    expect(result!.id).toBe('unifi')
  })

  it('pollUnifi returns wanTxMbps=null and wanRxMbps=null when stat/health call returns 401', async () => {
    mockAxios.get = vi.fn()
      .mockResolvedValueOnce(sitesResponse)
      .mockResolvedValueOnce(devicesResponse)
      .mockResolvedValueOnce(clientsResponse)
      .mockRejectedValueOnce(Object.assign(new Error('401'), { response: { status: 401 } }))

    const { pollUnifi, resetUnifiCache } = await import('../adapters/unifi.js')
    resetUnifiCache()
    const result = await pollUnifi('https://unifi.local', 'key')

    const metrics = result.metrics as Record<string, unknown>
    expect(metrics.wanTxMbps).toBeNull()
    expect(metrics.wanRxMbps).toBeNull()
  })

  it('computeHealthStatus returns offline when a gateway device (UDM-Pro) has state offline', async () => {
    const { computeHealthStatus } = await import('../adapters/unifi.js')
    const result = computeHealthStatus([
      { macAddress: '00:11:22', model: 'UDM-Pro', name: 'GW', state: 'offline', uptime: 0, clientCount: 0 },
    ])
    expect(result).toBe('offline')
  })

  it('computeHealthStatus returns warning when AP (U6-Pro) is offline but gateway is online', async () => {
    const { computeHealthStatus } = await import('../adapters/unifi.js')
    const result = computeHealthStatus([
      { macAddress: '00:11:22', model: 'UDM-Pro', name: 'GW', state: 'online', uptime: 0, clientCount: 0 },
      { macAddress: '33:44:55', model: 'U6-Pro', name: 'AP', state: 'offline', uptime: 0, clientCount: 0 },
    ])
    expect(result).toBe('warning')
  })

  it('computeHealthStatus returns online when all devices are online', async () => {
    const { computeHealthStatus } = await import('../adapters/unifi.js')
    const result = computeHealthStatus([
      { macAddress: '00:11:22', model: 'UDM-Pro', name: 'GW', state: 'online', uptime: 0, clientCount: 0 },
      { macAddress: '33:44:55', model: 'U6-Pro', name: 'AP', state: 'online', uptime: 0, clientCount: 0 },
    ])
    expect(result).toBe('online')
  })

  it('computeHealthStatus returns offline when no gateways exist', async () => {
    const { computeHealthStatus } = await import('../adapters/unifi.js')
    const result = computeHealthStatus([
      { macAddress: '33:44:55', model: 'U6-Pro', name: 'AP', state: 'online', uptime: 0, clientCount: 0 },
    ])
    expect(result).toBe('offline')
  })

  it('classifyModel: UDM-Pro=gateway, USW-24-PoE=switch, U6-Pro=ap, UnknownDevice=unknown', async () => {
    const { classifyModel } = await import('../adapters/unifi.js')
    expect(classifyModel('UDM-Pro')).toBe('gateway')
    expect(classifyModel('USW-24-PoE')).toBe('switch')
    expect(classifyModel('U6-Pro')).toBe('ap')
    expect(classifyModel('UnknownDevice')).toBe('unknown')
  })

  it('classifyModel handles UDR variant as gateway', async () => {
    const { classifyModel } = await import('../adapters/unifi.js')
    expect(classifyModel('UDR')).toBe('gateway')
  })

  it('classifyModel handles UAP, UAL, UAE variants as ap', async () => {
    const { classifyModel } = await import('../adapters/unifi.js')
    expect(classifyModel('UAP-AC-Pro')).toBe('ap')
    expect(classifyModel('UAE-AC-M')).toBe('ap')
  })

  it('formatUptime(1209600) returns 14d 0h; formatUptime(18000) returns 5h; formatUptime(0) returns 0h', async () => {
    const { formatUptime } = await import('../adapters/unifi.js')
    expect(formatUptime(1209600)).toBe('14d 0h')
    expect(formatUptime(18000)).toBe('5h')
    expect(formatUptime(0)).toBe('0h')
  })

  it('resolveSiteId caches result and only calls GET /sites once across multiple pollUnifi invocations', async () => {
    mockAxios.get = vi.fn()
      .mockResolvedValueOnce(sitesResponse)      // first: GET /sites
      .mockResolvedValue(devicesResponse)        // all subsequent device/client/health calls

    // Override to return proper sequential responses
    mockAxios.get = vi.fn()
      .mockResolvedValueOnce(sitesResponse)
      .mockResolvedValueOnce(devicesResponse)
      .mockResolvedValueOnce(clientsResponse)
      .mockResolvedValueOnce(statHealthResponse)
      // second poll - no sites call
      .mockResolvedValueOnce(devicesResponse)
      .mockResolvedValueOnce(clientsResponse)
      .mockResolvedValueOnce(statHealthResponse)

    const { pollUnifi, resetUnifiCache } = await import('../adapters/unifi.js')
    resetUnifiCache()

    await pollUnifi('https://unifi.local', 'key')
    await pollUnifi('https://unifi.local', 'key')

    const calls = (mockAxios.get as ReturnType<typeof vi.fn>).mock.calls
    const sitesCalls = calls.filter((c: unknown[]) => (c[0] as string).includes('/sites') && !(c[0] as string).includes('/devices') && !(c[0] as string).includes('/clients'))
    expect(sitesCalls.length).toBe(1)
  })

  it('resetUnifiCache clears cachedSiteId so next poll re-resolves site', async () => {
    mockAxios.get = vi.fn()
      .mockResolvedValueOnce(sitesResponse)
      .mockResolvedValueOnce(devicesResponse)
      .mockResolvedValueOnce(clientsResponse)
      .mockResolvedValueOnce(statHealthResponse)
      .mockResolvedValueOnce(sitesResponse)      // second poll after reset — calls /sites again
      .mockResolvedValueOnce(devicesResponse)
      .mockResolvedValueOnce(clientsResponse)
      .mockResolvedValueOnce(statHealthResponse)

    const { pollUnifi, resetUnifiCache } = await import('../adapters/unifi.js')
    resetUnifiCache()

    await pollUnifi('https://unifi.local', 'key')
    resetUnifiCache()
    await pollUnifi('https://unifi.local', 'key')

    const calls = (mockAxios.get as ReturnType<typeof vi.fn>).mock.calls
    const sitesCalls = calls.filter((c: unknown[]) => (c[0] as string).includes('/sites') && !(c[0] as string).includes('/devices') && !(c[0] as string).includes('/clients'))
    expect(sitesCalls.length).toBe(2)
  })

  it('WAN bytes-to-Mbps conversion: tx_bytes-r=125000 produces wanTxMbps=1.0', async () => {
    const singleWanResponse = {
      data: {
        data: [
          { subsystem: 'wan', 'tx_bytes-r': 125000, 'rx_bytes-r': 0, status: 'ok' },
        ],
      },
    }

    mockAxios.get = vi.fn()
      .mockResolvedValueOnce(sitesResponse)
      .mockResolvedValueOnce(devicesResponse)
      .mockResolvedValueOnce(clientsResponse)
      .mockResolvedValueOnce(singleWanResponse)

    const { pollUnifi, resetUnifiCache } = await import('../adapters/unifi.js')
    resetUnifiCache()
    const result = await pollUnifi('https://unifi.local', 'key')

    const metrics = result.metrics as Record<string, unknown>
    expect(metrics.wanTxMbps).toBe(1.0)
  })

  it('peak tracking: after polling with txMbps=10 then txMbps=5, peakTxMbps is still 10', async () => {
    const highWanResponse = {
      data: {
        data: [
          { subsystem: 'wan', 'tx_bytes-r': 1250000, 'rx_bytes-r': 0, status: 'ok' },  // 10 Mbps
        ],
      },
    }
    const lowWanResponse = {
      data: {
        data: [
          { subsystem: 'wan', 'tx_bytes-r': 625000, 'rx_bytes-r': 0, status: 'ok' },   // 5 Mbps
        ],
      },
    }

    mockAxios.get = vi.fn()
      .mockResolvedValueOnce(sitesResponse)
      .mockResolvedValueOnce(devicesResponse)
      .mockResolvedValueOnce(clientsResponse)
      .mockResolvedValueOnce(highWanResponse)
      // second poll
      .mockResolvedValueOnce(devicesResponse)
      .mockResolvedValueOnce(clientsResponse)
      .mockResolvedValueOnce(lowWanResponse)

    const { pollUnifi, resetUnifiCache } = await import('../adapters/unifi.js')
    resetUnifiCache()

    await pollUnifi('https://unifi.local', 'key')
    const result2 = await pollUnifi('https://unifi.local', 'key')

    const metrics = result2.metrics as Record<string, unknown>
    expect(metrics.peakTxMbps).toBe(10)
  })
})
