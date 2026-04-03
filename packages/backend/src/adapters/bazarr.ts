import axios from 'axios'
import type { ServiceStatus } from '@coruscant/shared'

const TIMEOUT_MS = 10_000

/**
 * Bazarr-specific adapter.
 * Uses /api/system/status?apikey= (query param auth, not header).
 * Bazarr has no health-warning equivalent — it's always online or offline.
 */
export async function pollBazarr(baseUrl: string, apiKey: string): Promise<ServiceStatus> {
  const lastPollAt = new Date().toISOString()

  try {
    await axios.get(`${baseUrl}/api/system/status`, {
      params: { apikey: apiKey },
      timeout: TIMEOUT_MS,
    })

    return {
      id: 'bazarr',
      name: 'Bazarr',
      tier: 'status',
      status: 'online',
      configured: true,
      lastPollAt,
    }
  } catch {
    return {
      id: 'bazarr',
      name: 'Bazarr',
      tier: 'status',
      status: 'offline',
      configured: true,
      lastPollAt,
    }
  }
}
