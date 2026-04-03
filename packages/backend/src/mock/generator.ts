import type { DashboardSnapshot, ServiceStatus, NasStatus, PlexStream } from '@coruscant/shared'

const TEN_MINUTES_MS = 10 * 60 * 1000

export function generateMockSnapshot(): DashboardSnapshot {
  const now = new Date()
  const nowIso = now.toISOString()
  const staleTime = new Date(now.getTime() - TEN_MINUTES_MS).toISOString()

  // NAS drive temps: typical range is 86–104°F for a spinning NAS disk
  const driveTemp1F = Math.round(88 + Math.random() * 8)   // ~88–96°F
  const driveTemp2F = Math.round(90 + Math.random() * 10)  // ~90–100°F

  const nas: NasStatus = {
    cpu: 10 + Math.random() * 5,
    ram: 40 + Math.random() * 3,
    volumes: [
      {
        name: 'TheRock',
        usedPercent: 67,
        tempF: driveTemp1F,
        tempC: Math.round((driveTemp1F - 32) * 5 / 9),
      },
      {
        name: 'TheRock2',
        usedPercent: 34,
        tempF: driveTemp2F,
        tempC: Math.round((driveTemp2F - 32) * 5 / 9),
      },
    ],
  }

  const services: ServiceStatus[] = [
    // status tier — arr services (simplified card: status LED + download indicator)
    {
      id: 'radarr',
      name: 'Radarr',
      tier: 'status',
      status: 'online',
      lastPollAt: nowIso,
      metrics: {
        // card face fields
        downloading: true,
        activeDownloads: 1,
        downloadQuality: '1080p',
        downloadProgress: 45,
        // detail page fields
        queue: 3,
        monitored: 1240,
        librarySize: '4.2 TB',
        missing: 12,
        attentionItems: [
          { type: 'manual_import', name: 'Movie.Title.2024.mkv' },
          { type: 'manual_import', name: 'Another.Movie.mkv' },
        ],
      },
    },
    {
      id: 'sonarr',
      name: 'Sonarr',
      tier: 'status',
      status: 'online',
      lastPollAt: nowIso,
      metrics: {
        downloading: false,
        activeDownloads: 0,
        downloadQuality: '',
        downloadProgress: 0,
        queue: 8,
        monitored: 342,
        librarySize: '6.1 TB',
        missing: 5,
        attentionItems: [],
      },
    },
    {
      id: 'lidarr',
      name: 'Lidarr',
      tier: 'status',
      status: 'warning',
      lastPollAt: nowIso,
      metrics: {
        downloading: false,
        activeDownloads: 0,
        downloadQuality: '',
        downloadProgress: 0,
        queue: 2,
        monitored: 180,
        librarySize: '320 GB',
        missing: 8,
        attentionItems: [],
      },
    },
    {
      id: 'bazarr',
      name: 'Bazarr',
      tier: 'status',
      status: 'offline',
      lastPollAt: nowIso,
      metrics: {
        downloading: false,
        activeDownloads: 0,
        downloadQuality: '',
        downloadProgress: 0,
        activeSubtitleGrabs: 0,
        queue: 0,
        monitored: 4,
        librarySize: '—',
        missing: 0,
        attentionItems: [],
      },
    },
    // activity tier
    {
      id: 'sabnzbd',
      name: 'SABnzbd',
      tier: 'activity',
      status: 'online',
      lastPollAt: nowIso,
      metrics: { speedMBs: 12.4, queueCount: 3, progressPercent: 65 },
    },
    // rich tier
    {
      id: 'pihole',
      name: 'Pi-hole',
      tier: 'rich',
      status: 'online',
      lastPollAt: nowIso,
      metrics: { blockedPercent: 34.2, totalQueries: 48291 },
    },
    {
      id: 'plex',
      name: 'Plex',
      tier: 'rich',
      status: 'online',
      lastPollAt: nowIso,
      metrics: { activeStreams: 2, maxStreams: 5 },
    },
    // stale entry: lastPollAt is 10 minutes ago to trigger the stale indicator
    {
      id: 'nas-detail',
      name: 'NAS',
      tier: 'rich',
      status: 'stale',
      lastPollAt: staleTime,
      metrics: { cpu: nas.cpu, ram: nas.ram, diskPercent: 67, tempF: nas.volumes[0]?.tempF ?? 91 },
    },
  ]

  const streams: PlexStream[] = [
    {
      user: 'sambo',
      title: 'Succession',
      season: 4,
      episode: 3,
      progressPercent: 42,
      quality: '1080p',
      transcode: true,
    },
    {
      user: 'guest',
      title: 'Oppenheimer',
      year: 2023,
      progressPercent: 78,
      quality: '4K',
      transcode: false,
    },
  ]

  return {
    services,
    nas,
    streams,
    timestamp: nowIso,
  }
}
