import type { DashboardSnapshot, ServiceStatus } from '@coruscant/shared'
import { ServiceCard, MediaStackRow } from './ServiceCard.js'

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr'])

const TIER_ORDER: Array<{ tier: ServiceStatus['tier']; label: string }> = [
  { tier: 'status', label: 'STATUS' },
  { tier: 'activity', label: 'ACTIVITY' },
  { tier: 'rich', label: 'RICH DATA' },
]

interface CardGridProps {
  snapshot: DashboardSnapshot | null
}

export function CardGrid({ snapshot }: CardGridProps) {
  if (!snapshot) {
    // Skeleton state: placeholder cards with chamfer styling
    return (
      <div style={{ padding: '0 16px' }}>
        {TIER_ORDER.map(({ label }) => (
          <section key={label} style={{ marginBottom: '24px' }}>
            <h2
              className="text-heading"
              style={{
                color: 'var(--cockpit-amber)',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              {label}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
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
          </section>
        ))}
      </div>
    )
  }

  // Group services by tier, excluding NAS (shown in AppHeader instrument panel)
  // Also exclude plex and nas from grid cards per D-20
  const grouped = TIER_ORDER.map(({ tier, label }) => ({
    label,
    services: snapshot.services.filter(
      (s) => s.tier === tier && s.id !== 'nas-detail' && s.id !== 'plex' && s.id !== 'nas',
    ),
  }))

  // Track global index for stagger offset
  let globalIndex = 0

  return (
    <div style={{ padding: '0 16px' }}>
      {grouped.map(({ label, services }) => {
        if (services.length === 0) return null

        // Split arr services (condensed LED rows) from other services (full cards)
        const arrServices = services.filter((s) => ARR_IDS.has(s.id))
        const cardServices = services.filter((s) => !ARR_IDS.has(s.id))

        return (
          <section key={label} style={{ marginBottom: '24px' }}>
            <h2
              className="text-heading"
              style={{
                color: 'var(--cockpit-amber)',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              {label}
            </h2>

            {/* Two-column layout: arr LED rows left, full cards right (D-29) */}
            {arrServices.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: cardServices.length > 0 ? '1fr 1fr' : '1fr',
                  gap: '16px',
                  alignItems: 'start',
                }}
              >
                {/* Left column: condensed arr LED rows */}
                <div
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-rest)',
                    borderRadius: '4px',
                    padding: '8px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--cockpit-amber)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '0 8px 6px 8px',
                      borderBottom: '1px solid rgba(232,160,32,0.15)',
                      marginBottom: '4px',
                    }}
                  >
                    MEDIA STACK
                  </div>
                  {arrServices.map((service) => {
                    const rowIndex = globalIndex++
                    return (
                      <MediaStackRow
                        key={service.id}
                        service={service}
                        index={rowIndex}
                      />
                    )
                  })}
                </div>

                {/* Right column: full service cards (SABnzbd, Pi-hole, etc.) */}
                {cardServices.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {cardServices.map((service) => {
                      const cardIndex = globalIndex++
                      return (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          index={cardIndex}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* No arr services in this tier — render all as full cards */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '16px',
                }}
              >
                {cardServices.map((service) => {
                  const cardIndex = globalIndex++
                  return (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      index={cardIndex}
                    />
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
