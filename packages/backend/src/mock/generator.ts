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
    // status tier — dot matrix for arr services
    {
      id: 'radarr',
      name: 'Radarr',
      tier: 'status',
      status: 'online',
      lastPollAt: nowIso,
      metrics: { queueCount: 5, monitoredCount: 12 },
    },
    {
      id: 'sonarr',
      name: 'Sonarr',
      tier: 'status',
      status: 'online',
      lastPollAt: nowIso,
      metrics: { queueCount: 8, monitoredCount: 20 },
    },
    {
      id: 'lidarr',
      name: 'Lidarr',
      tier: 'status',
      status: 'warning',
      lastPollAt: nowIso,
      metrics: { queueCount: 2, monitoredCount: 6 },
    },
    {
      id: 'bazarr',
      name: 'Bazarr',
      tier: 'status',
      status: 'offline',
      lastPollAt: nowIso,
      metrics: { queueCount: 0, monitoredCount: 4 },
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
