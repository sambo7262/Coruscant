import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { DashboardSnapshot } from '@coruscant/shared'
import { StatusDot } from '../components/ui/StatusDot.js'

interface ServiceDetailPageProps {
  snapshot: DashboardSnapshot | null
}

export function ServiceDetailPage({ snapshot }: ServiceDetailPageProps) {
  const { serviceId } = useParams<{ serviceId: string }>()
  const navigate = useNavigate()

  // Focus management: focus h1 on mount (UI-SPEC Accessibility)
  useEffect(() => {
    const heading = document.getElementById('detail-heading')
    heading?.focus()
  }, [serviceId])

  const service = snapshot?.services.find((s) => s.id === serviceId)

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--tron-blue)',
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          cursor: 'pointer',
          padding: '8px 0',
          marginBottom: '16px',
        }}
        aria-label="Back to dashboard"
      >
        &larr; Dashboard
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        {service && <StatusDot status={service.status} />}
        <h1
          id="detail-heading"
          className="text-heading"
          style={{ textTransform: 'capitalize', outline: 'none' }}
          tabIndex={-1}
        >
          {service?.name ?? serviceId}
        </h1>
      </div>

      {/* Mock metric slots — D-21: labeled slots with dash indicating unpopulated */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>Status: </span>
          <span className="text-body" style={{ color: 'var(--tron-blue)' }}>
            {service?.status ?? '---'}
          </span>
        </div>
        <div>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>Last checked: </span>
          <span className="text-body" style={{ color: 'var(--tron-blue)' }}>
            {service?.lastPollAt
              ? new Date(service.lastPollAt).toLocaleTimeString()
              : '---'}
          </span>
        </div>
        <div>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>Response time: </span>
          <span className="text-body" style={{ color: 'var(--text-muted)' }}>---</span>
        </div>
        <div>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>Uptime: </span>
          <span className="text-body" style={{ color: 'var(--text-muted)' }}>---</span>
        </div>
        <div>
          <span className="text-label" style={{ color: 'var(--text-muted)' }}>Version: </span>
          <span className="text-body" style={{ color: 'var(--text-muted)' }}>---</span>
        </div>
      </div>

      <p className="text-label" style={{ color: 'var(--text-muted)', marginTop: '24px' }}>
        Detailed metrics will be available when service integration is configured.
      </p>
    </div>
  )
}
