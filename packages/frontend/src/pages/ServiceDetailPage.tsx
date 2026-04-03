import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import type { DashboardSnapshot } from '@coruscant/shared'
import { StatusDot } from '../components/ui/StatusDot.js'

interface ServiceDetailPageProps {
  snapshot: DashboardSnapshot | null
}

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr'])

/** Cockpit dot-leader row: LABEL ............. VALUE */
function DotLeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline' }}>
      <span
        className="text-label"
        style={{ color: 'var(--text-offwhite)', textTransform: 'uppercase', flexShrink: 0 }}
      >
        {label}
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
        {value}
      </span>
    </div>
  )
}

type AttentionItem = { type: 'manual_import' | 'failed'; name: string }

/** Arr-specific detail view with stats + attention required section */
function ArrDetailView({
  serviceId,
  metrics,
}: {
  serviceId: string
  metrics: Record<string, unknown>
}) {
  const isBazarr = serviceId === 'bazarr'
  const isSonarr = serviceId === 'sonarr'

  const queue = typeof metrics.queue === 'number' ? metrics.queue : 0
  const monitored = typeof metrics.monitored === 'number' ? metrics.monitored : 0
  const librarySize = typeof metrics.librarySize === 'string' ? metrics.librarySize : '—'
  const missing = typeof metrics.missing === 'number' ? metrics.missing : 0

  const rawAttention = Array.isArray(metrics.attentionItems) ? metrics.attentionItems : []
  const attentionItems: AttentionItem[] = rawAttention.filter(
    (item): item is AttentionItem =>
      item !== null &&
      typeof item === 'object' &&
      'type' in item &&
      'name' in item
  )

  const monitoredLabel = isBazarr
    ? 'SERIES'
    : isSonarr
    ? 'SHOWS'
    : 'MOVIES'

  const missingLabel = isBazarr ? 'MISSING SUBS' : isSonarr ? 'MISSING SHOWS' : 'MISSING'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Stats section */}
      {!isBazarr && (
        <DotLeaderRow label="Queue" value={`${queue} items`} />
      )}
      <DotLeaderRow
        label="Monitored"
        value={`${monitored.toLocaleString()} ${monitoredLabel}`}
      />
      {!isBazarr && (
        <DotLeaderRow label="Library Size" value={librarySize} />
      )}
      {!isBazarr && (
        <DotLeaderRow label={missingLabel} value={`${missing}`} />
      )}

      {/* Attention Required section — only shown when items exist */}
      {attentionItems.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            borderLeft: '3px solid var(--cockpit-amber)',
            background: 'rgba(232,160,32,0.08)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Attention header */}
          <div
            style={{
              borderBottom: '1px solid rgba(232,160,32,0.15)',
              paddingBottom: '6px',
              marginBottom: '4px',
            }}
          >
            <span
              className="text-label"
              style={{
                color: 'var(--cockpit-amber)',
                textTransform: 'uppercase',
                fontWeight: 600,
                fontSize: '11px',
              }}
            >
              [!] ATTENTION REQUIRED
            </span>
          </div>

          {/* Manual import items */}
          {attentionItems
            .filter((item) => item.type === 'manual_import')
            .map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span
                  className="text-label"
                  style={{
                    color: 'rgba(232,160,32,0.60)',
                    fontSize: '10px',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  Manual Import
                </span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1px dotted rgba(232,160,32,0.15)',
                    margin: '0 4px',
                    minWidth: '12px',
                  }}
                />
                <span
                  className="text-label"
                  style={{
                    color: 'var(--cockpit-amber)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.name}
                >
                  {item.name}
                </span>
              </div>
            ))}

          {/* Failed items */}
          {attentionItems
            .filter((item) => item.type === 'failed')
            .map((item, i) => (
              <div key={`failed-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span
                  className="text-label"
                  style={{
                    color: 'rgba(255,59,59,0.80)',
                    fontSize: '10px',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  Failed
                </span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '1px dotted rgba(232,160,32,0.15)',
                    margin: '0 4px',
                    minWidth: '12px',
                  }}
                />
                <span
                  className="text-label"
                  style={{
                    color: 'var(--cockpit-red)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.name}
                >
                  {item.name}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function ServiceDetailPage({ snapshot }: ServiceDetailPageProps) {
  const { serviceId } = useParams<{ serviceId: string }>()

  // Focus management: focus h1 on mount (UI-SPEC Accessibility)
  useEffect(() => {
    const heading = document.getElementById('detail-heading')
    heading?.focus()
  }, [serviceId])

  const service = snapshot?.services.find((s) => s.id === serviceId)
  const metrics = service?.metrics as Record<string, unknown> | undefined
  const isArr = serviceId != null && ARR_IDS.has(serviceId)

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

      {/* Arr services: rich operational detail view */}
      {isArr && metrics ? (
        <ArrDetailView serviceId={serviceId} metrics={metrics} />
      ) : (
        /* Generic dot-leader readout for all other services */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <DotLeaderRow label="Status" value={service?.status ?? '---'} />
          <DotLeaderRow
            label="Last Checked"
            value={service?.lastPollAt ? new Date(service.lastPollAt).toLocaleTimeString() : '---'}
          />
          <DotLeaderRow label="Response Time" value="---" />
          <DotLeaderRow label="Uptime" value="---" />
          <DotLeaderRow label="Version" value="---" />

          <p className="text-label" style={{ color: 'var(--text-offwhite)', marginTop: '12px' }}>
            Detailed metrics will be available when service integration is configured.
          </p>
        </div>
      )}
    </div>
  )
}
