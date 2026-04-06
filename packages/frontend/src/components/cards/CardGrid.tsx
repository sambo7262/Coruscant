import type { DashboardSnapshot, ArrWebhookEvent, NasStatus } from '@coruscant/shared'
import { ServiceCard, MediaStackRow } from './ServiceCard.js'

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr'])

// Download-active arr services (have activeDownloads/downloadProgress in metrics)
const DOWNLOAD_ARR_IDS = ['radarr', 'sonarr', 'lidarr']

// Ordered columns for the arr tile (D-09, D-12)
const LEFT_COL_IDS = ['radarr', 'sonarr', 'lidarr']
const RIGHT_COL_IDS = ['prowlarr', 'bazarr', 'readarr']

interface CardGridProps {
  snapshot: DashboardSnapshot | null
  lastArrEvent?: ArrWebhookEvent | null
  nasStatus?: NasStatus | null
}

/** Clean NZB/torrent filename into a human-readable title.
 *  "Movie.Name.2024.1080p.WEB-DL.DDP5.1.x264-GROUP.mkv" → "Movie Name"
 *  Strips: year (4 digits), quality tags, codec, group, extension.
 */
function cleanFilename(filename: string): string {
  // Remove file extension
  let name = filename.replace(/\.\w{2,4}$/, '')
  // Replace dots and underscores with spaces
  name = name.replace(/[._]/g, ' ')
  // Truncate at first 4-digit year (e.g. 2024) or common quality tag
  name = name.replace(/\s+(19|20)\d{2}\b.*$/i, '')
  name = name.replace(/\s+(480|720|1080|2160|4k)\s*p?\b.*$/i, '')
  name = name.replace(/\s+(web|bluray|bdrip|hdtv|dvdrip|webrip|web-dl)\b.*$/i, '')
  // Trim
  return name.trim() || filename
}

/** Inline download activity section inside the Media tile */
function DownloadActivity({ snapshot }: { snapshot: DashboardSnapshot }) {
  const arrServices = snapshot.services.filter(s => DOWNLOAD_ARR_IDS.includes(s.id))
  const sabnzbd = snapshot.services.find(s => s.id === 'sabnzbd')

  // Active arr downloads (for title extraction)
  const activeArr = arrServices.filter(s => {
    const m = s.metrics as Record<string, unknown> | undefined
    return m?.downloading === true && typeof m?.activeDownloads === 'number' && (m.activeDownloads as number) > 0
  })

  // SABnzbd activity
  const sabMetrics = sabnzbd?.metrics as Record<string, unknown> | undefined
  const sabSpeedMBs = typeof sabMetrics?.speedMBs === 'number' ? sabMetrics.speedMBs : 0
  const sabQueueCount = typeof sabMetrics?.queueCount === 'number' ? sabMetrics.queueCount : 0
  const sabProgressPercent = typeof sabMetrics?.progressPercent === 'number' ? sabMetrics.progressPercent : 0
  const sabHasActivity = sabSpeedMBs > 0 || sabQueueCount > 0
  const sabCurrentFilename = typeof sabMetrics?.currentFilename === 'string' ? sabMetrics.currentFilename : ''

  const hasAnyActivity = activeArr.length > 0 || sabHasActivity

  // Derive active title: three-tier lookup
  // Priority 1: arr service actively downloading with a title
  // Priority 2: any arr service with an activeTitle (may not be in "downloading" state yet)
  // Priority 3: clean the SABnzbd filename as last resort
  const activeTitle = (() => {
    for (const s of activeArr) {
      const m = s.metrics as Record<string, unknown>
      if (typeof m.activeTitle === 'string' && m.activeTitle) return m.activeTitle
    }
    for (const s of arrServices) {
      const m = s.metrics as Record<string, unknown> | undefined
      if (typeof m?.activeTitle === 'string' && m.activeTitle) return m.activeTitle
    }
    return sabCurrentFilename ? cleanFilename(sabCurrentFilename) : ''
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', minHeight: 'auto' }}>
      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(232,160,32,0.08)', margin: '4px 0' }} />

      {/* DOWNLOADS sub-label — small proportional header */}
      <div style={{ fontSize: '11px', color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '3px', fontWeight: 600 }}>
        DOWNLOADS
      </div>

      {/* Active state: title + SABnzbd bar + speed only */}
      {hasAnyActivity && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Download title — 22px bold purple */}
          {activeTitle && (
            <span style={{ display: 'block', maxWidth: '100%', fontSize: '22px', fontWeight: 600, color: 'var(--cockpit-purple)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 0 8px var(--cockpit-purple)' }}>
              {activeTitle}
            </span>
          )}
          {/* SABnzbd progress bar + speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ flex: 1, height: '12px', background: 'rgba(232,160,32,0.15)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(Math.max(sabProgressPercent, 5), 100)}%`,
                background: 'var(--cockpit-amber)',
                borderRadius: '3px',
                transition: 'width 1s ease',
                boxShadow: '0 0 6px var(--cockpit-amber)',
              }} />
            </div>
            <span style={{ fontSize: '22px', fontWeight: 600, color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)', flexShrink: 0, textShadow: '0 0 8px var(--cockpit-amber)' }}>
              {sabSpeedMBs.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 400 }}>MB/s</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function CardGrid({ snapshot, lastArrEvent, nasStatus }: CardGridProps) {
  if (!snapshot) {
    // Skeleton state: two placeholder cards
    return (
      <div style={{ padding: '0 8px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', alignItems: 'start' }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="chamfer-card"
            style={{
              height: '160px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-rest)',
            }}
          />
        ))}
      </div>
    )
  }

  // Exclude nas-detail (legacy), Plex (in NowPlayingBanner), UniFi (embedded in NETWORK card)
  // SABnzbd is absorbed into Media tile
  const allServices = snapshot.services.filter(
    (s) => s.id !== 'nas-detail' && s.id !== 'plex' && s.id !== 'unifi',
  )
  const arrServices = allServices.filter((s) => ARR_IDS.has(s.id))

  // NAS service for full-width tile
  const nasService = allServices.find(s => s.id === 'nas')
  // Pi-hole service for network tile
  const piholeService = allServices.find(s => s.id === 'pihole')

  // Build ordered columns — only include services that exist in the snapshot
  const leftColArr = LEFT_COL_IDS
    .map((id) => arrServices.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
  const rightColArr = RIGHT_COL_IDS
    .map((id) => arrServices.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)

  let globalIndex = 0

  return (
    <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* Row 1: NAS tile — full width */}
      {nasService && (
        <ServiceCard
          key={nasService.id}
          service={nasService}
          index={globalIndex++}
          allServices={snapshot.services}
          nasStatus={nasStatus}
        />
      )}

      {/* Row 2: 2-column — Media tile left, Network tile right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'start' }}>

        {/* Media tile — arr LED rows + download activity section */}
        {arrServices.length > 0 && (
          <div
            className="chamfer-card"
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-rest)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* 20px amber header strip with MEDIA label */}
            <div style={{ height: '20px', background: 'var(--cockpit-amber)', flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: '6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#1a1a1a', letterSpacing: '0.08em', fontWeight: 600 }}>MEDIA</span>
            </div>
            {/* Two-column layout: L = Radarr/Sonarr/Lidarr, R = Prowlarr/Bazarr/Readarr */}
            <div style={{ display: 'flex', padding: '6px 4px 2px 4px', gap: '0' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {leftColArr.map((service) => (
                  <MediaStackRow key={service.id} service={service} index={globalIndex++} lastArrEvent={lastArrEvent} />
                ))}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {rightColArr.map((service) => (
                  <MediaStackRow key={service.id} service={service} index={globalIndex++} lastArrEvent={lastArrEvent} />
                ))}
              </div>
            </div>
            {/* Download activity section */}
            <div style={{ padding: '0 4px 6px 4px' }}>
              <DownloadActivity snapshot={snapshot} />
            </div>
          </div>
        )}

        {/* Network tile — Pi-hole with Ubiquiti */}
        {piholeService && (
          <ServiceCard
            key={piholeService.id}
            service={piholeService}
            index={globalIndex++}
            allServices={snapshot.services}
          />
        )}
      </div>
    </div>
  )
}
