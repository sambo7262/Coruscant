import type { DashboardSnapshot } from '@coruscant/shared'
import { ServiceCard, MediaStackRow } from './ServiceCard.js'

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr'])

// Ordered columns for the arr tile (D-09, D-12)
const LEFT_COL_IDS = ['radarr', 'sonarr', 'lidarr']
const RIGHT_COL_IDS = ['prowlarr', 'bazarr', 'readarr']

// SABnzbd is a download service — rendered below media and network tiles
const DOWNLOAD_IDS = new Set(['sabnzbd'])

interface CardGridProps {
  snapshot: DashboardSnapshot | null
}

export function CardGrid({ snapshot }: CardGridProps) {
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

  // Exclude NAS (in AppHeader), Plex (in NowPlayingBanner)
  const allServices = snapshot.services.filter(
    (s) => s.id !== 'nas-detail' && s.id !== 'plex' && s.id !== 'nas',
  )
  const arrServices = allServices.filter((s) => ARR_IDS.has(s.id))
  const nonArrServices = allServices.filter((s) => !ARR_IDS.has(s.id))

  // Split non-arr cards: network/infrastructure first, downloads (SABnzbd) below
  const networkServices = nonArrServices.filter((s) => !DOWNLOAD_IDS.has(s.id))
  const downloadServices = nonArrServices.filter((s) => DOWNLOAD_IDS.has(s.id))

  // Build ordered columns — only include services that exist in the snapshot
  const leftColArr = LEFT_COL_IDS
    .map((id) => arrServices.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
  const rightColArr = RIGHT_COL_IDS
    .map((id) => arrServices.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)

  let globalIndex = 0

  return (
    <div style={{ padding: '0 8px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', alignItems: 'stretch' }}>
      {/* 1. Arr services tile — chamfered card with MEDIA label in amber header (D-09, D-12) */}
      {arrServices.length > 0 && (
        <div
          className="chamfer-card"
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-rest)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
          }}
        >
          {/* 20px amber header strip with MEDIA label */}
          <div style={{ height: '20px', background: 'var(--cockpit-amber)', flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#1a1a1a', letterSpacing: '0.08em', fontWeight: 600 }}>MEDIA</span>
          </div>
          {/* Two-column layout: L = Radarr/Sonarr/Lidarr, R = Prowlarr/Bazarr/Readarr */}
          <div style={{ display: 'flex', padding: '6px 4px', gap: '0' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {leftColArr.map((service) => (
                <MediaStackRow key={service.id} service={service} index={globalIndex++} />
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {rightColArr.map((service) => (
                <MediaStackRow key={service.id} service={service} index={globalIndex++} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Network/infrastructure cards (Pi-hole, etc.) */}
      {networkServices.map((service) => (
        <ServiceCard key={service.id} service={service} index={globalIndex++} />
      ))}

      {/* 3. Download cards (SABnzbd) — always on its own row below media and network */}
      {downloadServices.length > 0 && (
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
          {downloadServices.map((service) => (
            <ServiceCard key={service.id} service={service} index={globalIndex++} />
          ))}
        </div>
      )}
    </div>
  )
}
