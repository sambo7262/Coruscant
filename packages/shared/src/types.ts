// Shared types between backend and frontend.
// Populated in Phase 2.

export interface ServiceStatus {
  id: string          // e.g. 'radarr'
  name: string
  tier: 'status' | 'activity' | 'rich'
  status: 'online' | 'offline' | 'warning' | 'stale'
  lastPollAt: string  // ISO 8601
  metrics?: Record<string, unknown> // populated by Phase 3+
}

export interface NasStatus {
  cpu: number    // percent
  ram: number    // percent
  volumes: { name: string; usedPercent: number; tempC?: number }[]
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
