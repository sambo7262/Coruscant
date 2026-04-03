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
    // Skeleton state per UI-SPEC: show placeholder cards with border trace running, no content
    return (
      <div style={{ padding: '0 16px' }}>
        {TIER_ORDER.map(({ label }) => (
          <section key={label} style={{ marginBottom: '24px' }}>
            <h2
              className="text-heading"
              style={{
                color: 'var(--section-label)',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              {label}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '16px',
              }}
            >
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    height: '88px',
                    borderRadius: '6px',
                    background: 'rgba(13, 17, 23, 0.85)',
                    border: '1px solid rgba(0, 200, 255, 0.15)',
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  // Group services by tier
  const grouped = TIER_ORDER.map(({ tier, label }) => ({
    label,
    services: snapshot.services.filter((s) => s.tier === tier),
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
                color: 'var(--section-label)',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              {label}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
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
