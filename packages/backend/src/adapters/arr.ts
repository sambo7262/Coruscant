import axios from 'axios'
import type { ServiceStatus } from '@coruscant/shared'

const TIMEOUT_MS = 5_000

/**
 * Shared arr adapter for Radarr, Sonarr, Lidarr, Prowlarr, and Readarr.
 * Calls /api/v3/health and maps the response to a ServiceStatus.
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

  try {
    const response = await axios.get(`${baseUrl}/api/v3/health`, {
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
  } catch {
    return {
      id: serviceId,
      name: serviceName,
      tier: 'status',
      status: 'offline',
      configured: true,
      lastPollAt,
    }
  }
}
