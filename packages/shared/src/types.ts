// Shared types between backend and frontend.
// Populated in Phase 2; extended in Phase 3 with configured flag and typed metrics.
// Extended in Phase 4 with rich service types (NasDisk, NasFan, NasDockerStats, PlexServerStats).

export interface ServiceStatus {
  id: string          // e.g. 'radarr'
  name: string
  tier: 'status' | 'activity' | 'rich'
  status: 'online' | 'offline' | 'warning' | 'stale'
  lastPollAt: string  // ISO 8601
  configured?: boolean // false = not yet set up via Settings; omit = legacy/mock
  metrics?: Record<string, unknown> // populated by Phase 3+
}

export interface NasVolume {
  name: string
  usedPercent: number
  tempC?: number
  tempF?: number
}

export interface NasDisk {
  id: string
  name: string
  tempC: number
  readBytesPerSec?: number
  writeBytesPerSec?: number
}

export interface NasFan {
  id: string
  rpm: number
}

export interface NasDockerStats {
  cpuPercent: number
  ramPercent: number
}

export interface NasStatus {
  cpu: number             // percent (user + system + other)
  ram: number             // percent
  networkMbpsUp: number   // megabits per second upload
  networkMbpsDown: number // megabits per second download
  cpuTempC?: number       // optional — from system temperature field
  name?: string           // optional — DSM server_name (e.g. "TheRock")
  volumes: NasVolume[]
  disks?: NasDisk[]       // optional — only if DSM returns data
  fans?: NasFan[]         // optional — only if DSM returns fan data
  docker?: NasDockerStats // optional — only if DSM returns docker stats
  imageUpdateAvailable?: boolean // optional — from 2x/day check
}

export interface PlexStream {
  user: string
  title: string
  deviceName: string        // device/player name (e.g., "Apple TV", "Chrome")
  year?: number
  season?: number
  episode?: number
  progressPercent: number
  quality: string           // e.g. '1080p' for video; 'FLAC 1411k' for audio
  transcode: boolean        // true = transcoding, false = direct play
  mediaType?: 'audio' | 'video'  // derived from Plex item.type
  albumName?: string             // for audio: item.parentTitle (album name)
  trackTitle?: string            // for audio: item.title (track title)
  state?: 'playing' | 'paused' | 'buffering'  // from Plex session attribute
}

export interface PlexServerStats {
  processCpuPercent: number
  processRamPercent: number
  bandwidthMbps: number
}

export interface WeatherData {
  temp_f: number
  wmo_code: number
  fetched_at: string  // ISO 8601
  timezone?: string   // IANA timezone from geocoding (e.g. "America/New_York")
}

export interface PiHealthStatus {
  cpuTempC?: number
  cpuPercent?: number
  throttled?: boolean
  throttledFlags?: string[]
  memUsedMb?: number
  memTotalMb?: number
  wifiRssiDbm?: number
  wifiLinkQuality?: string
  nasLatencyMs?: number
  sdFreeGb?: number
  uptimeHours?: number
  displayOn?: boolean
  severity: 'normal' | 'warning' | 'critical' | 'stale'
  lastPollAt: string
}

export interface DashboardSnapshot {
  services: ServiceStatus[]
  nas: NasStatus
  streams: PlexStream[]
  plexServerStats?: PlexServerStats  // optional — populated when Plex is configured
  weather?: WeatherData | null  // null = not configured; undefined = not yet loaded
  piHealth?: PiHealthStatus  // optional — populated when Pi health is configured (top-level per D-01)
  timestamp: string // ISO 8601
}

export interface SabnzbdMetrics {
  speedMBs: number
  queueCount: number
  progressPercent: number
  hasFailedItems: boolean
  sabStatus: string
  currentFilename?: string   // display name of active download NZB
  timeLeft?: string          // formatted time remaining e.g. '0:04:32'
}

export interface ArrHealthWarning {
  source: string
  type: 'Ok' | 'Notice' | 'Warning' | 'Error'
  message: string
  wikiUrl: string
}

export interface UnifiDevice {
  macAddress: string
  model: string
  name: string
  state: string          // 'online' | 'offline' | 'pendingAdoption' | etc.
  uptime: number         // seconds (integer)
  clientCount: number    // from features.access_point.num_sta or 0
}

export interface UnifiMetrics {
  clientCount: number         // from /clients totalCount
  wanTxMbps: number | null    // null if stat/health unavailable
  wanRxMbps: number | null
  peakTxMbps: number          // kv_store-persisted high-water mark for bar scaling (D-38)
  peakRxMbps: number
  peakClients?: number        // kv_store-persisted high-water mark for client bar gauge (D-39)
  devices: UnifiDevice[]
  healthStatus: 'online' | 'warning' | 'offline'  // derived from D-05 rollup
}

export interface ArrWebhookEvent {
  service: string          // 'radarr' | 'sonarr' | 'lidarr' | 'bazarr' | 'prowlarr' | 'readarr' | 'sabnzbd'
  eventCategory: 'grab' | 'download_complete' | 'health_issue' | 'update_available' | 'unknown'
  title?: string           // content title for ticker display
  rawEventType: string     // original eventType from arr payload, for logging
}
