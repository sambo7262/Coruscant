import type { DashboardSnapshot, ServiceStatus, NasStatus, PlexStream, PlexServerStats } from '@coruscant/shared'
import { pollArr } from './adapters/arr.js'
import { pollBazarr } from './adapters/bazarr.js'
import { pollSabnzbd } from './adapters/sabnzbd.js'
import { pollPihole } from './adapters/pihole.js'
import { pollNas, checkNasImageUpdates } from './adapters/nas.js'

// Poll intervals (ms) — per D-27, D-28, D-24, D-26
const ARR_INTERVAL_MS = 5_000       // D-27: 5 seconds (was 45_000)
const SABNZBD_INTERVAL_MS = 10_000  // D-28: 10 seconds (unchanged)
const PIHOLE_INTERVAL_MS = 60_000   // D-24: 60 seconds
const NAS_INTERVAL_MS = 3_000       // D-26: 3 seconds
const IMAGE_UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000 // D-18: 2x per day (12 hours)

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

  // Live data — NAS metrics and Plex stream state (no stubs, real data from adapters)
  private nasData: NasStatus = { cpu: 0, ram: 0, networkMbpsUp: 0, networkMbpsDown: 0, volumes: [] }
  private plexStreams: PlexStream[] = []
  private plexServerStats: PlexServerStats | undefined = undefined

  // Separate timer for Docker image update checks (12h interval, D-18)
  private imageUpdateTimer: ReturnType<typeof setInterval> | null = null

  // SSE broadcast subscribers — called by updatePlexState to push immediate snapshots
  private broadcastListeners: Array<() => void> = []

  constructor() {
    // Initialize all services as unconfigured
    for (const id of ALL_SERVICE_IDS) {
      this.state.set(id, makeUnconfigured(id))
    }
  }

  /**
   * Register a callback to be invoked when broadcastSnapshot() is called.
   * Used by SSE route to push immediate updates on Plex events.
   * Returns an unsubscribe function.
   */
  onBroadcast(listener: () => void): () => void {
    this.broadcastListeners.push(listener)
    return () => {
      const idx = this.broadcastListeners.indexOf(listener)
      if (idx !== -1) this.broadcastListeners.splice(idx, 1)
    }
  }

  /**
   * Trigger an immediate SSE push to all connected clients.
   * Called internally by updatePlexState after Tautulli webhook events.
   */
  broadcastSnapshot(): void {
    for (const listener of this.broadcastListeners) {
      try {
        listener()
      } catch {
        // Never let a broadcast error crash the manager
      }
    }
  }

  /**
   * Called by the Tautulli webhook route when a playback event arrives.
   * Updates Plex stream state and triggers an SSE snapshot push.
   * This is the ONLY way Plex data enters the system — there is no Plex poll timer.
   */
  updatePlexState(streams: PlexStream[], serverStats?: PlexServerStats): void {
    this.plexStreams = streams
    this.plexServerStats = serverStats
    // Trigger an immediate SSE push so clients see the update instantly
    this.broadcastSnapshot()
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
      // Clear Plex state when Plex config removed
      if (serviceId === 'plex') {
        this.plexStreams = []
        this.plexServerStats = undefined
      }
      return
    }

    const { baseUrl, apiKey, username } = config

    // Plex uses Tautulli webhooks — no polling timer.
    // Store config acknowledged (so test-connection works), but skip setInterval.
    if (serviceId === 'plex') {
      // Mark plex as configured (not unconfigured) with stale status until webhook arrives
      this.state.set(serviceId, {
        id: 'plex',
        name: 'Plex',
        tier: 'rich',
        status: 'stale',
        configured: true,
        lastPollAt: new Date().toISOString(),
      })
      return
    }

    // Poll function for this service
    const doPoll = async () => {
      try {
        let result: ServiceStatus

        if (serviceId === 'bazarr') {
          result = await pollBazarr(baseUrl, apiKey)
        } else if (serviceId === 'sabnzbd') {
          result = await pollSabnzbd(baseUrl, apiKey)
        } else if (serviceId === 'pihole') {
          result = await pollPihole(baseUrl, apiKey)
        } else if (serviceId === 'nas') {
          // NAS doesn't produce a ServiceStatus entry — stores data directly in nasData
          const nasResult = await pollNas(baseUrl, username ?? '', apiKey)
          this.nasData = nasResult
          return
        } else if (ARR_SERVICES[serviceId]) {
          const meta = ARR_SERVICES[serviceId]!
          result = await pollArr(serviceId, meta.name, baseUrl, apiKey)
        } else {
          // Unknown service — skip
          return
        }

        this.state.set(serviceId, result)
      } catch {
        // Adapter errors are captured inside each adapter — this shouldn't fire
      }
    }

    // Immediate first poll
    await doPoll()

    // Determine poll interval — plex has no timer (handled above with early return)
    let intervalMs: number
    if (serviceId === 'sabnzbd') intervalMs = SABNZBD_INTERVAL_MS
    else if (serviceId === 'pihole') intervalMs = PIHOLE_INTERVAL_MS
    else if (serviceId === 'nas') intervalMs = NAS_INTERVAL_MS
    else intervalMs = ARR_INTERVAL_MS

    const timer = setInterval(doPoll, intervalMs)
    this.timers.set(serviceId, timer)

    // For NAS: also set up the separate 12-hour image update check (D-18)
    if (serviceId === 'nas') {
      // Clear any existing image update timer
      if (this.imageUpdateTimer) {
        clearInterval(this.imageUpdateTimer)
        this.imageUpdateTimer = null
      }

      const checkImages = async () => {
        const available = await checkNasImageUpdates(baseUrl, username ?? '', apiKey)
        this.nasData = { ...this.nasData, imageUpdateAvailable: available }
      }

      // Initial check immediately
      checkImages().catch(() => {})

      // Repeat every 12 hours
      this.imageUpdateTimer = setInterval(() => { checkImages().catch(() => {}) }, IMAGE_UPDATE_INTERVAL_MS)
    }
  }

  /**
   * Returns a DashboardSnapshot from current cached state.
   * Returns live NAS data, Plex streams, and server stats (no stubs).
   */
  getSnapshot(): DashboardSnapshot {
    return {
      services: [...this.state.values()],
      nas: this.nasData,
      streams: this.plexStreams,
      plexServerStats: this.plexServerStats,
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

    if (this.imageUpdateTimer) {
      clearInterval(this.imageUpdateTimer)
      this.imageUpdateTimer = null
    }
  }
}

// Singleton instance used by the API routes
export const pollManager = new PollManager()
