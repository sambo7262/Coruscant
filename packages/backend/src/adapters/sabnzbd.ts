import axios from 'axios'
import type { ServiceStatus, SabnzbdMetrics } from '@coruscant/shared'

const TIMEOUT_MS = 10_000

interface SabnzbdSlot {
  status: string
  percentage?: string
}

interface SabnzbdQueue {
  status: string
  kbpersec: string    // string from API, e.g. "10240"
  noofslots: number
  slots?: SabnzbdSlot[]
}

interface SabnzbdResponse {
  queue: SabnzbdQueue
}

/**
 * SABnzbd adapter — polls /api?mode=queue&output=json.
 *
 * Status mapping:
 *   - Network error                 → offline
 *   - Any slot.status === 'Failed'  → warning (amber, per SVCACT-02)
 *   - Otherwise                     → online
 *
 * Metrics follow SabnzbdMetrics shape from shared types.
 */
export async function pollSabnzbd(baseUrl: string, apiKey: string): Promise<ServiceStatus> {
  const lastPollAt = new Date().toISOString()

  try {
    const response = await axios.get<SabnzbdResponse>(
      `${baseUrl}/api?mode=queue&output=json&apikey=${apiKey}`,
      { timeout: TIMEOUT_MS },
    )

    const queue = response.data.queue

    const speedMBs = parseFloat(queue.kbpersec) / 1024
    const queueCount = queue.noofslots
    const slots = queue.slots ?? []
    const firstActiveSlot = slots.find((s) => s.status !== 'Failed')
    const progressPercent = firstActiveSlot?.percentage != null
      ? parseFloat(firstActiveSlot.percentage)
      : 0
    const hasFailedItems = slots.some((s) => s.status === 'Failed')
    const sabStatus = queue.status

    const metrics: SabnzbdMetrics = {
      speedMBs,
      queueCount,
      progressPercent,
      hasFailedItems,
      sabStatus,
    }

    const serviceStatus = hasFailedItems ? 'warning' : 'online'

    return {
      id: 'sabnzbd',
      name: 'SABnzbd',
      tier: 'activity',
      status: serviceStatus,
      configured: true,
      lastPollAt,
      metrics: metrics as unknown as Record<string, unknown>,
    }
  } catch {
    return {
      id: 'sabnzbd',
      name: 'SABnzbd',
      tier: 'activity',
      status: 'offline',
      configured: true,
      lastPollAt,
    }
  }
}
