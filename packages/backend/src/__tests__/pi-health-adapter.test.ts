import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')

const mockAxios = vi.mocked(axios)

const HEALTHY_RESPONSE = {
  data: {
    cpu_temp_c: 52.1,
    cpu_percent: 15.3,
    throttled: false,
    throttled_flags: [],
    mem_used_mb: 410,
    mem_total_mb: 856,
    wifi_rssi_dbm: -45,
    wifi_link_quality: '70/70',
    nas_latency_ms: 2.1,
    sd_free_gb: 12.5,
    uptime_hours: 168.5,
    display_on: true,
  },
}

describe('pollPiHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: returns full PiHealthStatus with all 12 fields mapped from snake_case to camelCase', async () => {
    mockAxios.get = vi.fn().mockResolvedValue(HEALTHY_RESPONSE)

    const { pollPiHealth } = await import('../adapters/pi-health.js')
    const result = await pollPiHealth('http://192.168.86.233:7575')

    expect(result.cpuTempC).toBe(52.1)
    expect(result.cpuPercent).toBe(15.3)
    expect(result.throttled).toBe(false)
    expect(result.throttledFlags).toEqual([])
    expect(result.memUsedMb).toBe(410)
    expect(result.memTotalMb).toBe(856)
    expect(result.wifiRssiDbm).toBe(-45)
    expect(result.wifiLinkQuality).toBe('70/70')
    expect(result.nasLatencyMs).toBe(2.1)
    expect(result.sdFreeGb).toBe(12.5)
    expect(result.uptimeHours).toBe(168.5)
    expect(result.displayOn).toBe(true)
    expect(result.severity).toBe('normal')
    expect(result.lastPollAt).toBeDefined()
    expect(new Date(result.lastPollAt).toISOString()).toBe(result.lastPollAt)
  })

  it('Test 2: returns stale severity when endpoint is unreachable', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const { pollPiHealth } = await import('../adapters/pi-health.js')
    const result = await pollPiHealth('http://192.168.86.233:7575')

    expect(result.severity).toBe('stale')
    expect(result.lastPollAt).toBeDefined()
  })

  it('Test 9: Pi offline does NOT set severity to critical -- sets stale per D-07/D-09', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const { pollPiHealth } = await import('../adapters/pi-health.js')
    const result = await pollPiHealth('http://192.168.86.233:7575')

    expect(result.severity).not.toBe('critical')
    expect(result.severity).toBe('stale')
  })
})

describe('deriveSeverity', () => {
  it('Test 3: returns critical when throttled_flags contains under-voltage', async () => {
    const { deriveSeverity } = await import('../adapters/pi-health.js')
    const result = deriveSeverity({
      throttled_flags: ['under-voltage'],
      mem_used_mb: 400,
      mem_total_mb: 856,
      wifi_rssi_dbm: -45,
    })
    expect(result).toBe('critical')
  })

  it('Test 4: returns critical when throttled_flags contains currently-throttled', async () => {
    const { deriveSeverity } = await import('../adapters/pi-health.js')
    const result = deriveSeverity({
      throttled_flags: ['currently-throttled'],
      mem_used_mb: 400,
      mem_total_mb: 856,
      wifi_rssi_dbm: -45,
    })
    expect(result).toBe('critical')
  })

  it('Test 5: returns warning when throttled_flags contains arm-freq-capped', async () => {
    const { deriveSeverity } = await import('../adapters/pi-health.js')
    const result = deriveSeverity({
      throttled_flags: ['arm-freq-capped'],
      mem_used_mb: 400,
      mem_total_mb: 856,
      wifi_rssi_dbm: -45,
    })
    expect(result).toBe('warning')
  })

  it('Test 6: returns warning when mem_used_mb/mem_total_mb > 0.9', async () => {
    const { deriveSeverity } = await import('../adapters/pi-health.js')
    const result = deriveSeverity({
      throttled_flags: [],
      mem_used_mb: 800,
      mem_total_mb: 856,
      wifi_rssi_dbm: -45,
    })
    expect(result).toBe('warning')
  })

  it('Test 7: returns warning when wifi_rssi_dbm < -70', async () => {
    const { deriveSeverity } = await import('../adapters/pi-health.js')
    const result = deriveSeverity({
      throttled_flags: [],
      mem_used_mb: 400,
      mem_total_mb: 856,
      wifi_rssi_dbm: -75,
    })
    expect(result).toBe('warning')
  })

  it('Test 8: returns normal when no flags and metrics are healthy', async () => {
    const { deriveSeverity } = await import('../adapters/pi-health.js')
    const result = deriveSeverity({
      throttled_flags: [],
      mem_used_mb: 400,
      mem_total_mb: 856,
      wifi_rssi_dbm: -45,
    })
    expect(result).toBe('normal')
  })
})
