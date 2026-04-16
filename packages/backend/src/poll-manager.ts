import type { DashboardSnapshot, ServiceStatus, NasStatus, PlexStream, PlexServerStats, ArrWebhookEvent, WeatherData, PiHealthStatus } from '@coruscant/shared'
import { eq } from 'drizzle-orm'
import { getDb } from './db.js'
import { kvStore } from './schema.js'
import { pollArr } from './adapters/arr.js'
import { pollBazarr } from './adapters/bazarr.js'
import { pollSabnzbd } from './adapters/sabnzbd.js'
import { pollPihole } from './adapters/pihole.js'
import { pollPiHealth } from './adapters/pi-health.js'
import { pollNas, checkNasImageUpdates } from './adapters/nas.js'
import { fetchPlexSessions, fetchPlexServerStats } from './adapters/plex.js'
import { pollUnifi, resetUnifiCache } from './adapters/unifi.js'

// Poll intervals (ms) — per D-01, D-02, D-27, D-28, D-24
export const ARR_INTERVAL_MS = 5_000              // D-27: 5 seconds
export const SABNZBD_INTERVAL_MS = 10_000         // D-28: 10 seconds (normal interval)
export const SABNZBD_BURST_MS = 1_000             // D-14: 1 second burst interval on grab event
export const PIHOLE_INTERVAL_MS = 60_000          // D-24: 60 seconds
export const NAS_INTERVAL_MS = 1_000              // D-01: 1 second (was 3_000)
export const PLEX_INTERVAL_MS = 5_000             // 5 second direct poll of PMS /status/sessions
export const UNIFI_INTERVAL_MS = 1_000            // D-01: 1 second — real-time throughput feel
export const PI_HEALTH_INTERVAL_MS = 30_000       // D-02: 30 seconds default
export const IMAGE_UPDATE_INTERVAL_MS = 15 * 60 * 1000      // 15 minutes

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
  'pihole', 'plex', 'nas', 'unifi',
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
    unifi: 'UniFi',
  }
  return names[id] ?? id
}

function idToTier(id: string): 'status' | 'activity' | 'rich' {
  if (id === 'sabnzbd') return 'activity'
  if (id === 'plex' || id === 'nas' || id === 'unifi') return 'rich'
  // pihole is 'status' tier so it co-renders with the arr media stack
  // in the two-column layout (media stack left, Pi-hole right)
  return 'status'
}

/**
 * Classify a raw arr eventType string into a normalized event category.
 * Exported for unit testing.
 */
export function classifyArrEvent(rawEventType: string): ArrWebhookEvent['eventCategory'] {
  switch (rawEventType.toLowerCase()) {
    case 'grab': return 'grab'
    case 'download': return 'download_complete'
    case 'health': return 'health_issue'
    case 'healthrestored': return 'health_restored'
    case 'applicationupdate': return 'update_available'
    default: return 'unknown'
  }
}

/**
 * Extract a display title from an arr webhook payload body.
 * Supports movie/series/artist/author structures and Prowlarr health messages.
 * Exported for unit testing.
 */
export function extractArrTitle(body: Record<string, unknown>): string | undefined {
  const movie = body.movie as Record<string, unknown> | undefined
  const series = body.series as Record<string, unknown> | undefined
  const artist = body.artist as Record<string, unknown> | undefined
  const author = body.author as Record<string, unknown> | undefined
  return (
    (typeof movie?.title === 'string' ? movie.title : undefined) ??
    (typeof series?.title === 'string' ? series.title : undefined) ??
    (typeof artist?.name === 'string' ? artist.name : undefined) ??
    (typeof author?.authorName === 'string' ? author.authorName : undefined) ??
    // D-08: Prowlarr health events include message field, e.g. "Indexer NZBGeek is unavailable"
    (typeof body.message === 'string' ? body.message : undefined) ??
    undefined
  )
}

export class PollManager {
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private state: Map<string, ServiceStatus> = new Map()

  // Live data — NAS metrics and Plex stream state (no stubs, real data from adapters)
  private nasData: NasStatus = { cpu: 0, ram: 0, networkMbpsUp: 0, networkMbpsDown: 0, volumes: [] }
  private plexStreams: PlexStream[] = []
  private plexServerStats: PlexServerStats | undefined = undefined
  private piHealthData: PiHealthStatus | undefined = undefined
  private plexConfig: { baseUrl: string; token: string } | null = null

  // Separate timer for Docker image update checks (12h interval, D-18)
  private imageUpdateTimer: ReturnType<typeof setInterval> | null = null

  // SSE broadcast subscribers — called by updatePlexState to push immediate snapshots
  private broadcastListeners: Array<() => void> = []

  // Arr event subscribers — called by handleArrEvent to push arr-event SSE messages
  private arrEventListeners: Array<(event: ArrWebhookEvent) => void> = []

  // SABnzbd burst poll state — activated on grab events, deactivated on download_complete
  private sabnzbdConfig: { baseUrl: string; apiKey: string } | null = null
  private burstPollActive: boolean = false


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
   * Register a callback to be invoked when an arr webhook event arrives.
   * Used by SSE route to push named arr-event messages to connected clients.
   * Returns an unsubscribe function.
   */
  onArrEvent(listener: (event: ArrWebhookEvent) => void): () => void {
    this.arrEventListeners.push(listener)
    return () => {
      const idx = this.arrEventListeners.indexOf(listener)
      if (idx !== -1) this.arrEventListeners.splice(idx, 1)
    }
  }

  /**
   * Called by the arr webhook route when an arr app posts a webhook event.
   * Classifies the event, logs it, broadcasts it to SSE clients, and activates
   * or deactivates SABnzbd burst polling based on event category.
   */
  handleArrEvent(service: string, body: Record<string, unknown>): void {
    const rawEventType = typeof body.eventType === 'string' ? body.eventType : 'unknown'
    const eventCategory = classifyArrEvent(rawEventType)
    const title = extractArrTitle(body)

    // D-03: Log via structured JSON (pollManager singleton has no fastify.log access)
    console.log(JSON.stringify({ level: 'info', service, eventCategory, rawEventType, title, msg: 'arr_webhook_received' }))

    const event: ArrWebhookEvent = { service, eventCategory, title, rawEventType }
    for (const listener of this.arrEventListeners) {
      try { listener(event) } catch { /* never crash on listener error */ }
    }

    // D-14: Activate burst poll on grab
    if (eventCategory === 'grab') {
      this.activateSabnzbdBurstPoll()
    }
    // D-15: Deactivate burst poll on download_complete
    if (eventCategory === 'download_complete') {
      this.deactivateSabnzbdBurstPoll()
    }
  }

  /**
   * Called by the Tautulli webhook route when a playback event arrives.
   * Updates Plex stream state and triggers an SSE snapshot push.
   * Backward-compatible: webhooks can still override stream state when Tautulli is running.
   * Primary data source is now the 5-second direct PMS poll in reload().
   */
  updatePlexState(streams: PlexStream[], serverStats?: PlexServerStats): void {
    this.plexStreams = streams
    // Only overwrite plexServerStats when a defined value is provided.
    // Tautulli webhooks call this with serverStats=undefined (no server-metrics payload);
    // preserving the last PMS-polled value prevents the stats block from flickering off
    // on every playback event.
    if (serverStats !== undefined) {
      this.plexServerStats = serverStats
    }
    // Trigger an immediate SSE push so clients see the update instantly
    this.broadcastSnapshot()
  }

  /**
   * Trigger an immediate re-poll of the Plex PMS session and stats endpoints.
   * Called by Tautulli webhook on PlaybackStart/Stop/Pause events to ensure
   * the SSE snapshot reflects current session state immediately. (D-06, D-07, D-08)
   */
  async triggerPlexRepoll(): Promise<void> {
    if (!this.plexConfig) return
    try {
      const { baseUrl, token } = this.plexConfig
      const { streams, totalBandwidthKbps } = await fetchPlexSessions(baseUrl, token)
      const stats = await fetchPlexServerStats(baseUrl, token, totalBandwidthKbps)
      this.updatePlexState(streams, stats)
    } catch {
      // Log but don't throw — fallback poll will catch it
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

    // Reset cached UniFi state (site ID, peaks) on any reconfiguration
    if (serviceId === 'unifi') {
      resetUnifiCache()
    }

    // No config → mark unconfigured
    if (!config || !config.baseUrl) {
      this.state.set(serviceId, makeUnconfigured(serviceId))
      // Clear Plex state when Plex config removed
      if (serviceId === 'plex') {
        this.plexStreams = []
        this.plexServerStats = undefined
        this.plexConfig = null
      }
      // Clear SABnzbd burst state when SABnzbd config removed
      if (serviceId === 'sabnzbd') {
        this.sabnzbdConfig = null
        this.burstPollActive = false
      }
      return
    }

    const { baseUrl, apiKey, username } = config

    // Cache SABnzbd config for burst poll access; reset burst state on reconfigure
    if (serviceId === 'sabnzbd') {
      this.sabnzbdConfig = { baseUrl, apiKey }
      this.burstPollActive = false  // Reset burst state on reconfigure
    }

    // Pi health — top-level field like NAS, not in services[] (D-01)
    if (serviceId === 'piHealth') {
      const doPollPiHealth = async () => {
        const result = await pollPiHealth(baseUrl)
        this.piHealthData = result
        this.broadcastSnapshot()
      }
      await doPollPiHealth()
      // Custom interval from kvStore, fallback to default 30s (D-02, D-11)
      let intervalMs = PI_HEALTH_INTERVAL_MS
      try {
        const db = getDb()
        const row = db.select().from(kvStore).where(eq(kvStore.key, 'piHealth.pollInterval')).get()
        if (row) {
          const parsed = parseInt(row.value, 10)
          if (parsed >= 5000) intervalMs = parsed
        }
      } catch { /* use default */ }
      const timer = setInterval(doPollPiHealth, intervalMs)
      this.timers.set('piHealth', timer)
      return
    }

    // Plex uses direct 5-second polling of PMS /status/sessions.
    if (serviceId === 'plex') {
      // Store config for polling
      this.plexConfig = { baseUrl, token: apiKey }

      // Mark plex as configured with stale status until first poll completes
      this.state.set(serviceId, {
        id: 'plex',
        name: 'Plex',
        tier: 'rich',
        status: 'stale',
        configured: true,
        lastPollAt: new Date().toISOString(),
      })

      const doPollPlex = async () => {
        try {
          const { streams, totalBandwidthKbps } = await fetchPlexSessions(baseUrl, apiKey)
          const serverStats = await fetchPlexServerStats(baseUrl, apiKey, totalBandwidthKbps)
          this.state.set('plex', {
            id: 'plex',
            name: 'Plex',
            tier: 'rich',
            status: 'online',
            configured: true,
            lastPollAt: new Date().toISOString(),
          })
          // updatePlexState sets plexStreams + plexServerStats and triggers broadcastSnapshot
          this.updatePlexState(streams, serverStats)
        } catch {
          // fetchPlexSessions and fetchPlexServerStats never throw — this is a safety net
          this.broadcastSnapshot()
        }
      }

      // Immediate first poll
      await doPollPlex()

      const timer = setInterval(doPollPlex, PLEX_INTERVAL_MS)
      this.timers.set('plex', timer)
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
          // NAS stores metrics in nasData and marks itself configured in state
          const nasResult = await pollNas(baseUrl, username ?? '', apiKey)
          this.nasData = { ...nasResult, imageUpdateAvailable: this.nasData.imageUpdateAvailable }
          // Mark NAS as configured and online in the service status map so
          // App.tsx derives nasConfigured = true and shows the live gauge strip.
          this.state.set('nas', {
            id: 'nas',
            name: 'NAS',
            tier: 'rich',
            status: 'online',
            configured: true,
            lastPollAt: new Date().toISOString(),
          })
          // Broadcast immediately so the SSE clients see the update without
          // waiting for the 5-second SSE interval.
          this.broadcastSnapshot()
          return
        } else if (serviceId === 'unifi') {
          result = await pollUnifi(baseUrl, apiKey)
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
    else if (serviceId === 'unifi') intervalMs = UNIFI_INTERVAL_MS
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
        const available = await checkNasImageUpdates()
        this.nasData = { ...this.nasData, imageUpdateAvailable: available }
      }

      // Initial check immediately
      checkImages().catch(() => {})

      // Repeat every 12 hours
      this.imageUpdateTimer = setInterval(() => { checkImages().catch(() => {}) }, IMAGE_UPDATE_INTERVAL_MS)
    }
  }

  /**
   * Activate 1-second burst polling for SABnzbd after a grab event (D-14).
   * No-op if SABnzbd is not configured or already in burst mode.
   */
  private activateSabnzbdBurstPoll(): void {
    if (!this.sabnzbdConfig) return  // SABnzbd not configured — nothing to burst
    if (this.burstPollActive) return  // Already in burst mode

    this.burstPollActive = true
    const existing = this.timers.get('sabnzbd')
    if (existing) { clearInterval(existing); this.timers.delete('sabnzbd') }

    const { baseUrl, apiKey } = this.sabnzbdConfig
    const doBurstPoll = async () => {
      try {
        const result = await pollSabnzbd(baseUrl, apiKey)
        this.state.set('sabnzbd', result)
        // D-15 fallback: queue-empty detection ends burst mode
        const metrics = result.metrics as Record<string, unknown> | undefined
        const queueCount = typeof metrics?.queueCount === 'number' ? metrics.queueCount : -1
        if (queueCount === 0) {
          this.deactivateSabnzbdBurstPoll()
        }
      } catch { /* adapter handles errors internally */ }
    }

    const timer = setInterval(doBurstPoll, SABNZBD_BURST_MS)  // D-14: 1-second burst interval
    this.timers.set('sabnzbd', timer)
  }

  /**
   * Deactivate burst polling for SABnzbd and restore normal interval (D-15).
   * No-op if not currently in burst mode.
   */
  deactivateSabnzbdBurstPoll(): void {
    if (!this.burstPollActive) return
    this.burstPollActive = false

    // Stop burst timer
    const existing = this.timers.get('sabnzbd')
    if (existing) { clearInterval(existing); this.timers.delete('sabnzbd') }

    // Restart at normal interval if config exists
    if (this.sabnzbdConfig) {
      const { baseUrl, apiKey } = this.sabnzbdConfig
      const doPoll = async () => {
        try {
          const result = await pollSabnzbd(baseUrl, apiKey)
          this.state.set('sabnzbd', result)
        } catch { /* adapter handles errors internally */ }
      }
      const timer = setInterval(doPoll, SABNZBD_INTERVAL_MS)
      this.timers.set('sabnzbd', timer)
    }
  }

  /**
   * Returns a DashboardSnapshot from current cached state.
   * Returns live NAS data, Plex streams, server stats, and weather data (no stubs).
   */
  getSnapshot(): DashboardSnapshot {
    const db = getDb()
    const weatherRow = db.select().from(kvStore).where(eq(kvStore.key, 'weather.current')).get()
    const weather: WeatherData | null = weatherRow ? JSON.parse(weatherRow.value) as WeatherData : null

    return {
      services: [...this.state.values()],
      nas: this.nasData,
      streams: this.plexStreams,
      plexServerStats: this.plexServerStats,
      weather,
      piHealth: this.piHealthData,
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

    this.burstPollActive = false
  }
}

// Singleton instance used by the API routes
export const pollManager = new PollManager()
