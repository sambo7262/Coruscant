import type { DashboardSnapshot, ServiceStatus } from '@coruscant/shared'
import { ServiceCard } from './ServiceCard.js'

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
  const grouped = TIER_ORDER.map(({ tier, label }) => ({
    label,
    services: snapshot.services.filter((s) => s.tier === tier && s.id !== 'nas-detail'),
  }))

  // Track global card index for stagger offset
  let globalIndex = 0

  return (
    <div style={{ padding: '0 16px' }}>
      {grouped.map(({ label, services }) => {
        if (services.length === 0) return null
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              {services.map((service) => {
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
          </section>
        )
      })}
    </div>
  )
}
