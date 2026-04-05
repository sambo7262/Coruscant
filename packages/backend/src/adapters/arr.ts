import axios from 'axios'
import type { ServiceStatus } from '@coruscant/shared'

const TIMEOUT_MS = 5_000

// Radarr and Sonarr use /api/v3; Lidarr, Prowlarr, Readarr use /api/v1
const API_VERSION: Record<string, string> = {
  radarr: 'v3',
  sonarr: 'v3',
  lidarr: 'v1',
  prowlarr: 'v1',
  readarr: 'v1',
}

/**
 * Shared arr adapter for Radarr, Sonarr, Lidarr, Prowlarr, and Readarr.
 * Calls /api/{version}/health — version is per-service (v3 for Radarr/Sonarr, v1 for the rest).
 * Also calls /api/{version}/queue in parallel to emit download activity metrics.
 *
 * Status mapping:
 *   - Network error / timeout / non-2xx  → offline
 *   - 200 + empty array                  → online
 *   - 200 + any item type Warning|Error  → warning (with healthWarnings in metrics)
 *   - 200 + only Ok|Notice items         → online
 *
 * Queue failure is non-fatal — metrics fall back to queue:0, downloading:false,
 * activeDownloads:0 so the service status is unaffected.
 *
 * Does NOT apply to Bazarr — Bazarr uses a different endpoint.
 */
export async function pollArr(
  serviceId: string,
  serviceName: string,
  baseUrl: string,
  apiKey: string,
): Promise<ServiceStatus> {
  const lastPollAt = new Date().toISOString()
  const version = API_VERSION[serviceId] ?? 'v1'
  const headers = { 'X-Api-Key': apiKey }

  const [healthResult, queueResult] = await Promise.allSettled([
    axios.get(`${baseUrl}/api/${version}/health`, { headers, timeout: TIMEOUT_MS }),
    axios.get(`${baseUrl}/api/${version}/queue`, {
      headers,
      timeout: TIMEOUT_MS,
      params: { page: 1, pageSize: 1 },
    }),
  ])

  // Health check failure → offline
  if (healthResult.status === 'rejected') {
    const reason = healthResult.reason instanceof Error
      ? healthResult.reason.message
      : String(healthResult.reason)
    return {
      id: serviceId,
      name: serviceName,
      tier: 'status',
      status: 'offline',
      configured: true,
      lastPollAt,
      metrics: { error: reason },
    }
  }

  // Extract queue metrics — graceful fallback on failure
  let queueCount = 0
  let downloading = false
  let activeDownloads = 0

  if (queueResult.status === 'fulfilled') {
    const queueData = queueResult.value.data as {
      totalRecords?: number
      records?: Array<{ status: string }>
    }
    queueCount = queueData.totalRecords ?? 0
    const records = queueData.records ?? []
    activeDownloads = records.filter((r) => r.status === 'downloading').length
    downloading = activeDownloads > 0
  }

  const items: Array<{ source: string; type: string; message: string; wikiUrl: string }> =
    healthResult.value.data ?? []

  const hasIssues = items.some(
    (item) => item.type === 'Warning' || item.type === 'Error',
  )

  if (hasIssues) {
    const healthWarnings = items.filter(
      (item) => item.type === 'Warning' || item.type === 'Error',
    )
    return {
      id: serviceId,
      name: serviceName,
      tier: 'status',
      status: 'warning',
      configured: true,
      lastPollAt,
      metrics: { healthWarnings, queue: queueCount, downloading, activeDownloads },
    }
  }

  return {
    id: serviceId,
    name: serviceName,
    tier: 'status',
    status: 'online',
    configured: true,
    lastPollAt,
    metrics: { queue: queueCount, downloading, activeDownloads },
  }
}
