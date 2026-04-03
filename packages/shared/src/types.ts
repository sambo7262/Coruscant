// Shared types between backend and frontend.
// Populated in Phase 2; extended in Phase 3 with configured flag and typed metrics.

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

export interface NasStatus {
  cpu: number    // percent
  ram: number    // percent
  volumes: NasVolume[]
}

export interface PlexStream {
  user: string
  title: string
  year?: number
  season?: number
  episode?: number
  progressPercent: number
  quality: string       // e.g. '1080p'
  transcode: boolean    // true = transcoding, false = direct play
}

export interface DashboardSnapshot {
  services: ServiceStatus[]
  nas: NasStatus
  streams: PlexStream[]
  timestamp: string // ISO 8601
}

export interface SabnzbdMetrics {
  speedMBs: number
  queueCount: number
  progressPercent: number
  hasFailedItems: boolean
  sabStatus: string
}

export interface ArrHealthWarning {
  source: string
  type: 'Ok' | 'Notice' | 'Warning' | 'Error'
  message: string
  wikiUrl: string
}
