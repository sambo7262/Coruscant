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
 *
 * Status mapping:
 *   - Network error / timeout / non-2xx  → offline
 *   - 200 + empty array                  → online
 *   - 200 + any item type Warning|Error  → warning (with healthWarnings in metrics)
 *   - 200 + only Ok|Notice items         → online
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

  try {
    const response = await axios.get(`${baseUrl}/api/${version}/health`, {
      headers: { 'X-Api-Key': apiKey },
      timeout: TIMEOUT_MS,
    })

    const items: Array<{ source: string; type: string; message: string; wikiUrl: string }> =
      response.data ?? []

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
        metrics: { healthWarnings },
      }
    }

    return {
      id: serviceId,
      name: serviceName,
      tier: 'status',
      status: 'online',
      configured: true,
      lastPollAt,
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
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
}
