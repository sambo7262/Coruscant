import type { DashboardSnapshot, ServiceStatus, NasStatus, PlexStream } from '@coruscant/shared'

const TEN_MINUTES_MS = 10 * 60 * 1000

export function generateMockSnapshot(): DashboardSnapshot {
  const now = new Date()
  const nowIso = now.toISOString()
  const staleTime = new Date(now.getTime() - TEN_MINUTES_MS).toISOString()

  const services: ServiceStatus[] = [
    // status tier
    { id: 'radarr', name: 'Radarr', tier: 'status', status: 'online', lastPollAt: nowIso },
    { id: 'sonarr', name: 'Sonarr', tier: 'status', status: 'online', lastPollAt: nowIso },
    { id: 'lidarr', name: 'Lidarr', tier: 'status', status: 'warning', lastPollAt: nowIso },
    { id: 'bazarr', name: 'Bazarr', tier: 'status', status: 'offline', lastPollAt: nowIso },
    // activity tier
    { id: 'sabnzbd', name: 'SABnzbd', tier: 'activity', status: 'online', lastPollAt: nowIso },
    // rich tier
    { id: 'pihole', name: 'Pi-hole', tier: 'rich', status: 'online', lastPollAt: nowIso },
    { id: 'plex', name: 'Plex', tier: 'rich', status: 'online', lastPollAt: nowIso },
    // stale entry: lastPollAt is 10 minutes ago to trigger the stale indicator
    { id: 'nas-detail', name: 'NAS Detail', tier: 'rich', status: 'stale', lastPollAt: staleTime },
  ]

  const nas: NasStatus = {
    cpu: 10 + Math.random() * 5,
    ram: 40 + Math.random() * 3,
    volumes: [
      {
        name: '/vol1',
        usedPercent: 67,
        tempC: 41 + Math.random() * 2,
      },
    ],
  }

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
