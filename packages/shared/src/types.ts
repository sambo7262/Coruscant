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

export interface DashboardSnapshot {
  services: ServiceStatus[]
  nas: NasStatus
  streams: PlexStream[]
  plexServerStats?: PlexServerStats  // optional — populated when Plex is configured
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
