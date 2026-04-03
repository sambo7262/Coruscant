import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import type { DashboardSnapshot } from '@coruscant/shared'
import { StatusDot } from '../components/ui/StatusDot.js'

interface ServiceDetailPageProps {
  snapshot: DashboardSnapshot | null
}

export function ServiceDetailPage({ snapshot }: ServiceDetailPageProps) {
  const { serviceId } = useParams<{ serviceId: string }>()

  // Focus management: focus h1 on mount (UI-SPEC Accessibility)
  useEffect(() => {
    const heading = document.getElementById('detail-heading')
    heading?.focus()
  }, [serviceId])

  const service = snapshot?.services.find((s) => s.id === serviceId)

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        {service && <StatusDot status={service.status} />}
        <h1
          id="detail-heading"
          className="text-heading"
          style={{ textTransform: 'uppercase', color: 'var(--cockpit-amber)', outline: 'none' }}
          tabIndex={-1}
        >
          {service?.name ?? serviceId}
        </h1>
      </div>

      {/* Mock metric slots — dot-leader readout format: LABEL ........... VALUE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span
            className="text-label"
            style={{ color: 'var(--text-offwhite)', textTransform: 'uppercase', flexShrink: 0 }}
          >
            Status
          </span>
          <span
            style={{
              flex: 1,
              borderBottom: '1px dotted rgba(232,160,32,0.20)',
              margin: '0 8px',
              minWidth: '20px',
            }}
          />
          <span className="text-body" style={{ color: 'var(--cockpit-amber)', flexShrink: 0 }}>
            {service?.status ?? '---'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span
            className="text-label"
            style={{ color: 'var(--text-offwhite)', textTransform: 'uppercase', flexShrink: 0 }}
          >
            Last Checked
          </span>
          <span
            style={{
              flex: 1,
              borderBottom: '1px dotted rgba(232,160,32,0.20)',
              margin: '0 8px',
              minWidth: '20px',
            }}
          />
          <span className="text-body" style={{ color: 'var(--cockpit-amber)', flexShrink: 0 }}>
            {service?.lastPollAt
              ? new Date(service.lastPollAt).toLocaleTimeString()
              : '---'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span
            className="text-label"
            style={{ color: 'var(--text-offwhite)', textTransform: 'uppercase', flexShrink: 0 }}
          >
            Response Time
          </span>
          <span
            style={{
              flex: 1,
              borderBottom: '1px dotted rgba(232,160,32,0.20)',
              margin: '0 8px',
              minWidth: '20px',
            }}
          />
          <span className="text-body" style={{ color: 'var(--cockpit-amber)', flexShrink: 0 }}>
            ---
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span
            className="text-label"
            style={{ color: 'var(--text-offwhite)', textTransform: 'uppercase', flexShrink: 0 }}
          >
            Uptime
          </span>
          <span
            style={{
              flex: 1,
              borderBottom: '1px dotted rgba(232,160,32,0.20)',
              margin: '0 8px',
              minWidth: '20px',
            }}
          />
          <span className="text-body" style={{ color: 'var(--cockpit-amber)', flexShrink: 0 }}>
            ---
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span
            className="text-label"
            style={{ color: 'var(--text-offwhite)', textTransform: 'uppercase', flexShrink: 0 }}
          >
            Version
          </span>
          <span
            style={{
              flex: 1,
              borderBottom: '1px dotted rgba(232,160,32,0.20)',
              margin: '0 8px',
              minWidth: '20px',
            }}
          />
          <span className="text-body" style={{ color: 'var(--cockpit-amber)', flexShrink: 0 }}>
            ---
          </span>
        </div>
      </div>

      <p className="text-label" style={{ color: 'var(--text-offwhite)', marginTop: '24px' }}>
        Detailed metrics will be available when service integration is configured.
      </p>
    </div>
  )
}
