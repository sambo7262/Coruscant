import axios from 'axios'
import type { PiHealthStatus } from '@coruscant/shared'

const TIMEOUT_MS = 10_000

/**
 * Derive severity from raw Pi health data.
 * Exported for unit testing.
 *
 * Rules (per D-04/D-05/D-06):
 * - under-voltage or currently-throttled in throttled_flags = critical
 * - arm-freq-capped in throttled_flags = warning
 * - mem_used_mb / mem_total_mb > 0.9 = warning
 * - wifi_rssi_dbm < -70 (and not 0) = warning
 * - Raw temperature does NOT affect severity (D-04/D-08)
 */
export function deriveSeverity(data: Record<string, unknown>): 'normal' | 'warning' | 'critical' {
  // Check throttle flags for critical conditions
  const flags = Array.isArray(data.throttled_flags) ? data.throttled_flags : []
  for (const flag of flags) {
    if (typeof flag === 'string') {
      if (flag === 'under-voltage' || flag === 'currently-throttled') {
        return 'critical'
      }
    }
  }

  // Check throttle flags for warning conditions
  for (const flag of flags) {
    if (typeof flag === 'string' && flag === 'arm-freq-capped') {
      return 'warning'
    }
  }

  // Check memory usage > 90%
  const memUsed = typeof data.mem_used_mb === 'number' ? data.mem_used_mb : 0
  const memTotal = typeof data.mem_total_mb === 'number' ? data.mem_total_mb : 1
  if (memTotal > 0 && (memUsed / memTotal) > 0.9) {
    return 'warning'
  }

  // Check WiFi signal strength < -70 dBm (ignore 0 which means no WiFi data)
  const rssi = typeof data.wifi_rssi_dbm === 'number' ? data.wifi_rssi_dbm : 0
  if (rssi !== 0 && rssi < -70) {
    return 'warning'
  }

  return 'normal'
}

/**
 * Poll Pi health Flask endpoint and return typed PiHealthStatus.
 * Never throws — returns stale severity on error (per D-09/D-10).
 */
export async function pollPiHealth(baseUrl: string): Promise<PiHealthStatus> {
  const lastPollAt = new Date().toISOString()

  try {
    const response = await axios.get(`${baseUrl}/health`, { timeout: TIMEOUT_MS })
    const data = response.data as Record<string, unknown>

    const severity = deriveSeverity(data)

    return {
      cpuTempC: typeof data.cpu_temp_c === 'number' ? data.cpu_temp_c : undefined,
      cpuPercent: typeof data.cpu_percent === 'number' ? data.cpu_percent : undefined,
      throttled: typeof data.throttled === 'boolean' ? data.throttled : undefined,
      throttledFlags: Array.isArray(data.throttled_flags) ? data.throttled_flags as string[] : undefined,
      memUsedMb: typeof data.mem_used_mb === 'number' ? data.mem_used_mb : undefined,
      memTotalMb: typeof data.mem_total_mb === 'number' ? data.mem_total_mb : undefined,
      wifiRssiDbm: typeof data.wifi_rssi_dbm === 'number' ? data.wifi_rssi_dbm : undefined,
      wifiLinkQuality: typeof data.wifi_link_quality === 'string' ? data.wifi_link_quality : undefined,
      nasLatencyMs: typeof data.nas_latency_ms === 'number' ? data.nas_latency_ms : undefined,
      sdFreeGb: typeof data.sd_free_gb === 'number' ? data.sd_free_gb : undefined,
      uptimeHours: typeof data.uptime_hours === 'number' ? data.uptime_hours : undefined,
      displayOn: typeof data.display_on === 'boolean' ? data.display_on : undefined,
      severity,
      lastPollAt,
    }
  } catch {
    // Per D-07/D-09: Pi offline returns 'stale', never throws
    return {
      severity: 'stale',
      lastPollAt,
    }
  }
}
