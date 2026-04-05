import type { DashboardSnapshot } from '@coruscant/shared'
import { ServiceCard, MediaStackRow } from './ServiceCard.js'

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr'])

// Ordered columns for the arr tile (D-09, D-12)
const LEFT_COL_IDS = ['radarr', 'sonarr', 'lidarr']
const RIGHT_COL_IDS = ['prowlarr', 'bazarr', 'readarr']

interface CardGridProps {
  snapshot: DashboardSnapshot | null
}

export function CardGrid({ snapshot }: CardGridProps) {
  if (!snapshot) {
    // Skeleton state: two placeholder cards
    return (
      <div style={{ padding: '0 8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', alignItems: 'start' }}>
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
  const cardServices = allServices.filter((s) => !ARR_IDS.has(s.id))

  // Build ordered columns — only include services that exist in the snapshot
  const leftColArr = LEFT_COL_IDS
    .map((id) => arrServices.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
  const rightColArr = RIGHT_COL_IDS
    .map((id) => arrServices.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)

  let globalIndex = 0

  return (
    <div style={{ padding: '0 8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', alignItems: 'start' }}>
      {/* Arr services tile — chamfered card with amber header strip (D-09, D-12) */}
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
          {/* 6px amber header strip — same as all other instrument cards */}
          <div style={{ height: '6px', background: 'var(--cockpit-amber)', flexShrink: 0 }} />
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

      {/* Individual service cards (SABnzbd, Pi-hole, etc.) — no tier section labels */}
      {cardServices.map((service) => (
        <ServiceCard key={service.id} service={service} index={globalIndex++} />
      ))}
    </div>
  )
}
