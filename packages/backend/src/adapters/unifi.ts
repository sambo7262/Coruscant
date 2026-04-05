import axios from 'axios'
import https from 'node:https'
import type { ServiceStatus, UnifiDevice, UnifiMetrics } from '@coruscant/shared'

const TIMEOUT_MS = 10_000
// UniFi controllers use self-signed certs — same pattern as Plex adapter
const httpsAgent = new https.Agent({ rejectUnauthorized: false })
const PEAK_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours

// Module-level cache
let cachedSiteId: string | null = null
let peakTxMbps = 0
let peakRxMbps = 0
let peakResetTimer: ReturnType<typeof setTimeout> | null = null

function schedulePeakReset(): void {
  if (peakResetTimer !== null) {
    clearTimeout(peakResetTimer)
  }
  peakResetTimer = setTimeout(() => {
    peakTxMbps = 0
    peakRxMbps = 0
    schedulePeakReset()
  }, PEAK_WINDOW_MS)
  // Allow Node.js to exit even if this timer is pending
  if (peakResetTimer.unref) {
    peakResetTimer.unref()
  }
}

// Initialize peak reset timer at module load
schedulePeakReset()

/**
 * Reset module-level cache. Call between tests or when credentials change.
 */
export function resetUnifiCache(): void {
  cachedSiteId = null
  peakTxMbps = 0
  peakRxMbps = 0
}

/**
 * Classify UniFi device model into device type category.
 * Per D-06 device type classification.
 */
export function classifyModel(model: string): 'gateway' | 'switch' | 'ap' | 'unknown' {
  const m = model.toUpperCase()
  if (m.startsWith('UDM') || m.startsWith('UDMP') || m.startsWith('UDR')) return 'gateway'
  if (m.startsWith('USW')) return 'switch'
  if (m.startsWith('U6') || m.startsWith('UAP') || m.startsWith('UAL') || m.startsWith('UAE')) return 'ap'
  return 'unknown'
}

/**
 * Compute overall health status using gateway-first rollup logic (per D-05).
 * - RED if no gateways exist
 * - RED if any gateway is offline
 * - AMBER if non-gateway device is offline but all gateways are online
 * - GREEN if all devices are online
 */
export function computeHealthStatus(devices: UnifiDevice[]): 'online' | 'warning' | 'offline' {
  const gateways = devices.filter(d => classifyModel(d.model) === 'gateway')
  const others = devices.filter(d => classifyModel(d.model) !== 'gateway')
  if (gateways.length === 0 || gateways.some(d => d.state !== 'online')) return 'offline'
  if (others.some(d => d.state !== 'online')) return 'warning'
  return 'online'
}

/**
 * Format uptime in seconds to human-readable string.
 * Examples: 1209600 → '14d 0h', 18000 → '5h', 0 → '0h'
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

/**
 * Resolve the default site ID from the UniFi API.
 * Caches result in module-level variable to avoid repeated calls.
 * Matches internalId === 'default' first, then name === 'default', then sites[0].
 */
async function resolveSiteId(baseUrl: string, apiKey: string): Promise<string> {
  if (cachedSiteId !== null) {
    return cachedSiteId
  }

  const response = await axios.get(`${baseUrl}/proxy/network/integration/v1/sites`, {
    headers: { 'X-API-KEY': apiKey },
    timeout: TIMEOUT_MS,
    httpsAgent,
  })

  const sites: Array<{ siteId: string; internalId: string; name: string }> =
    response.data?.data ?? []

  if (sites.length === 0) {
    throw new Error('UniFi API returned no sites')
  }

  const defaultById = sites.find(s => s.internalId === 'default')
  const defaultByName = sites.find(s => s.name.toLowerCase() === 'default')
  const site = defaultById ?? defaultByName ?? sites[0]

  cachedSiteId = site.siteId
  return cachedSiteId
}

/**
 * Poll UniFi controller for network device status, client counts, and WAN throughput.
 *
 * Authentication: X-API-KEY header (static API token — no session cookies).
 *
 * Makes 4 requests:
 *   1. GET /proxy/network/integration/v1/sites — resolve default siteId (cached)
 *   2. GET /proxy/network/integration/v1/sites/{siteId}/devices — device list
 *   3. GET /proxy/network/integration/v1/sites/{siteId}/clients — client count
 *   4. GET /proxy/network/api/s/default/stat/health — WAN throughput (optional, 401-tolerant)
 *
 * Status mapping (per D-05 gateway-first rollup):
 *   - All gateways online, all others online → 'online'
 *   - All gateways online, non-gateway offline → 'warning'
 *   - Any gateway offline or no gateways → 'offline'
 *   - Network error → 'offline'
 */
export async function pollUnifi(baseUrl: string, apiKey: string): Promise<ServiceStatus> {
  const lastPollAt = new Date().toISOString()

  try {
    const siteId = await resolveSiteId(baseUrl, apiKey)

    const headers = { 'X-API-KEY': apiKey }
    const opts = { headers, timeout: TIMEOUT_MS, httpsAgent }

    const [devicesRes, clientsRes, statHealthRes] = await Promise.all([
      axios.get(`${baseUrl}/proxy/network/integration/v1/sites/${siteId}/devices`, opts),
      axios.get(`${baseUrl}/proxy/network/integration/v1/sites/${siteId}/clients`, opts),
      // Wrap stat/health in its own try/catch — 401 returns null instead of failing the poll
      axios
        .get(`${baseUrl}/proxy/network/api/s/default/stat/health`, opts)
        .catch(() => null),
    ])

    // Parse devices
    const rawDevices: Array<{
      macAddress: string
      model: string
      name: string
      state: string
      uptime?: number
      features?: { access_point?: { num_sta?: number } }
    }> = devicesRes.data?.data ?? []

    const devices: UnifiDevice[] = rawDevices.map(d => ({
      macAddress: d.macAddress,
      model: d.model,
      name: d.name,
      state: d.state,
      uptime: d.uptime ?? 0,
      clientCount: d.features?.access_point?.num_sta ?? 0,
    }))

    // Parse client count
    const clientCount: number = clientsRes.data?.totalCount ?? 0

    // Parse WAN throughput from stat/health — field names use hyphens, must use bracket notation
    let wanTxMbps: number | null = null
    let wanRxMbps: number | null = null

    if (statHealthRes !== null) {
      const statData: Array<Record<string, unknown>> = statHealthRes.data?.data ?? []
      const wan = statData.find(s => s.subsystem === 'wan')
      if (wan) {
        const txBytesPerSec = wan['tx_bytes-r'] as number | undefined
        const rxBytesPerSec = wan['rx_bytes-r'] as number | undefined
        wanTxMbps = txBytesPerSec !== undefined ? txBytesPerSec / 125_000 : null
        wanRxMbps = rxBytesPerSec !== undefined ? rxBytesPerSec / 125_000 : null
      }
    }

    // Update rolling peaks
    if (wanTxMbps !== null && wanTxMbps > peakTxMbps) peakTxMbps = wanTxMbps
    if (wanRxMbps !== null && wanRxMbps > peakRxMbps) peakRxMbps = wanRxMbps

    const healthStatus = computeHealthStatus(devices)

    const metrics: UnifiMetrics = {
      clientCount,
      wanTxMbps,
      wanRxMbps,
      peakTxMbps,
      peakRxMbps,
      devices,
      healthStatus,
    }

    return {
      id: 'unifi',
      name: 'UniFi',
      tier: 'rich',
      status: healthStatus,
      configured: true,
      lastPollAt,
      metrics: metrics as unknown as Record<string, unknown>,
    }
  } catch (err) {
    console.error('[unifi] poll failed:', err instanceof Error ? err.message : String(err))
    return {
      id: 'unifi',
      name: 'UniFi',
      tier: 'rich',
      status: 'offline',
      configured: true,
      lastPollAt,
    }
  }
}
