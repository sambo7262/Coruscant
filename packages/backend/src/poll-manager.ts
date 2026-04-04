import type { DashboardSnapshot, ServiceStatus, NasStatus, PlexStream } from '@coruscant/shared'
import { pollArr } from './adapters/arr.js'
import { pollBazarr } from './adapters/bazarr.js'
import { pollSabnzbd } from './adapters/sabnzbd.js'

// Poll intervals (ms) — per D-20
const ARR_INTERVAL_MS = 45_000
const SABNZBD_INTERVAL_MS = 10_000

// Arr service metadata
const ARR_SERVICES: Record<string, { name: string }> = {
  radarr: { name: 'Radarr' },
  sonarr: { name: 'Sonarr' },
  lidarr: { name: 'Lidarr' },
  prowlarr: { name: 'Prowlarr' },
  readarr: { name: 'Readarr' },
}

// All managed service IDs
const ALL_SERVICE_IDS = [
  'radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd',
  'pihole', 'plex', 'nas',
]

// Stub NAS and streams — real data comes in later phases
const STUB_NAS: NasStatus = {
  cpu: 0,
  ram: 0,
  networkMbpsUp: 0,
  networkMbpsDown: 0,
  volumes: [],
}

const STUB_STREAMS: PlexStream[] = []

function makeUnconfigured(id: string): ServiceStatus {
  return {
    id,
    name: idToName(id),
    tier: idToTier(id),
    status: 'stale',
    configured: false,
    lastPollAt: new Date().toISOString(),
  }
}

function idToName(id: string): string {
  const names: Record<string, string> = {
    radarr: 'Radarr',
    sonarr: 'Sonarr',
    lidarr: 'Lidarr',
    bazarr: 'Bazarr',
    prowlarr: 'Prowlarr',
    readarr: 'Readarr',
    sabnzbd: 'SABnzbd',
    pihole: 'Pi-hole',
    plex: 'Plex',
    nas: 'NAS',
  }
  return names[id] ?? id
}

function idToTier(id: string): 'status' | 'activity' | 'rich' {
  if (id === 'sabnzbd') return 'activity'
  if (id === 'pihole' || id === 'plex' || id === 'nas') return 'rich'
  return 'status'
}

export class PollManager {
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private state: Map<string, ServiceStatus> = new Map()

  constructor() {
    // Initialize all services as unconfigured
    for (const id of ALL_SERVICE_IDS) {
      this.state.set(id, makeUnconfigured(id))
    }
  }

  /**
   * Start or restart polling for a service.
   * Pass null (or undefined) config to mark the service as unconfigured.
   * username is optional — used by NAS (DSM login); ignored by other services.
   */
  async reload(
    serviceId: string,
    config: { baseUrl: string; apiKey: string; username?: string } | null,
  ): Promise<void> {
    // Clear any existing timer
    const existing = this.timers.get(serviceId)
    if (existing !== undefined) {
      clearInterval(existing)
      this.timers.delete(serviceId)
    }

    // No config → mark unconfigured
    if (!config || !config.baseUrl) {
      this.state.set(serviceId, makeUnconfigured(serviceId))
      return
    }

    const { baseUrl, apiKey } = config

    // Poll function for this service
    const doPoll = async () => {
      try {
        let result: ServiceStatus

        if (serviceId === 'bazarr') {
          result = await pollBazarr(baseUrl, apiKey)
        } else if (serviceId === 'sabnzbd') {
          result = await pollSabnzbd(baseUrl, apiKey)
        } else if (ARR_SERVICES[serviceId]) {
          const meta = ARR_SERVICES[serviceId]!
          result = await pollArr(serviceId, meta.name, baseUrl, apiKey)
        } else {
          // Unknown service — no adapter yet (pihole, plex, nas in later phases)
          return
        }

        this.state.set(serviceId, result)
      } catch {
        // Adapter errors are captured inside each adapter — this shouldn't fire
      }
    }

    // Immediate first poll
    await doPoll()

    // Determine interval
    const intervalMs = serviceId === 'sabnzbd' ? SABNZBD_INTERVAL_MS : ARR_INTERVAL_MS

    const timer = setInterval(doPoll, intervalMs)
    this.timers.set(serviceId, timer)
  }

  /**
   * Returns a DashboardSnapshot from current cached state.
   * NAS, Plex, and Pi-hole remain stubs until Phase 4+.
   */
  getSnapshot(): DashboardSnapshot {
    return {
      services: [...this.state.values()],
      nas: STUB_NAS,
      streams: STUB_STREAMS,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Stop all polling timers (for graceful shutdown and tests).
   */
  stopAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer)
    }
    this.timers.clear()
  }
}

// Singleton instance used by the API routes
export const pollManager = new PollManager()
