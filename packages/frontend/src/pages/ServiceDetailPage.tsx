import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
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

// Cockpit amber/green palette for donut slices
const DONUT_COLORS = [
  '#E8A020', // cockpit amber
  '#4CAF50', // cockpit green
  '#FF6B35', // warm orange
  '#8B6914', // dark gold
  '#2E7D32', // deep green
  '#D4A017', // goldenrod
  '#6B8E23', // olive
  '#B8860B', // dark goldenrod
]

/** Pi-hole detail view: Today's Stats + System + Query Distribution donut chart (D-06) */
function PiholeDetailView({ service, metrics }: { service: { status: string; configured?: boolean }; metrics: Record<string, unknown> }) {
  // Empty/error states per UI-SPEC copywriting
  if (service.configured === false) {
    return (
      <p className="text-label" style={{ color: 'var(--text-offwhite)' }}>
        NO DATA — configure Pi-hole in Settings
      </p>
    )
  }
  if (service.status === 'offline') {
    return (
      <p className="text-label" style={{ color: 'var(--cockpit-red)' }}>
        CONNECTION ERROR — check URL and password in Settings
      </p>
    )
  }

  const totalQueriesDay = typeof metrics.totalQueriesDay === 'number' ? metrics.totalQueriesDay : 0
  const totalBlockedDay = typeof metrics.totalBlockedDay === 'number' ? metrics.totalBlockedDay : 0
  const percentBlocked = typeof metrics.percentBlocked === 'number' ? metrics.percentBlocked : 0
  const domainsBlocked = typeof metrics.domainsBlocked === 'number' ? metrics.domainsBlocked : 0
  const queriesPerMinute = typeof metrics.queriesPerMinute === 'number' ? metrics.queriesPerMinute : 0
  const load1m = typeof metrics.load1m === 'number' ? metrics.load1m : 0
  const memPercent = typeof metrics.memPercent === 'number' ? metrics.memPercent : 0

  // Build query type distribution data for donut chart
  const queryTypeData = metrics.queryTypes
    ? Object.entries(metrics.queryTypes as Record<string, number>)
        .map(([name, count]) => ({ name, value: count }))
        .sort((a, b) => b.value - a.value)
    : []

  const rawWarnings = Array.isArray(metrics.warnings) ? metrics.warnings : []
  const warnings: string[] = rawWarnings.filter((w): w is string => typeof w === 'string')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* TODAY'S STATS section */}
      <div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--cockpit-amber)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}
        >
          TODAY'S STATS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <DotLeaderRow label="QUERIES TODAY" value={totalQueriesDay.toLocaleString()} />
          <DotLeaderRow label="BLOCKED TODAY" value={totalBlockedDay.toLocaleString()} />
          <DotLeaderRow label="BLOCK RATE" value={`${percentBlocked.toFixed(1)}%`} />
        </div>
      </div>

      {/* SYSTEM section */}
      <div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--cockpit-amber)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}
        >
          SYSTEM
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <DotLeaderRow label="BLOCKLIST SIZE" value={domainsBlocked.toLocaleString()} />
          <DotLeaderRow label="QUERIES / MIN" value={queriesPerMinute.toFixed(1)} />
          <DotLeaderRow label="SYSTEM LOAD" value={load1m.toFixed(2)} />
          <DotLeaderRow label="MEMORY USAGE" value={`${memPercent.toFixed(1)}%`} />
        </div>
      </div>

      {/* QUERY DISTRIBUTION donut chart (D-06) */}
      {queryTypeData.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--cockpit-amber)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            QUERY DISTRIBUTION
          </div>
          <PieChart width={280} height={200}>
            <Pie
              data={queryTypeData}
              cx={140}
              cy={100}
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              nameKey="name"
              label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${value ?? 0}`}
              labelLine={false}
            >
              {queryTypeData.map((_, index) => (
                <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </div>
      )}

      {/* WARNINGS section — only shown when warnings exist */}
      {warnings.length > 0 && (
        <div
          style={{
            borderLeft: '3px solid var(--cockpit-amber)',
            background: 'rgba(232,160,32,0.08)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <span
            className="text-label"
            style={{
              color: 'var(--cockpit-amber)',
              textTransform: 'uppercase',
              fontWeight: 600,
              fontSize: '11px',
              borderBottom: '1px solid rgba(232,160,32,0.15)',
              paddingBottom: '6px',
              marginBottom: '4px',
            }}
          >
            [!] WARNINGS
          </span>
          {warnings.map((w, i) => (
            <span key={i} className="text-label" style={{ color: 'var(--cockpit-amber)', fontSize: '11px' }}>
              {w}
            </span>
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
  const isPihole = serviceId === 'pihole'

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

      {/* Pi-hole: rich detail view with donut chart */}
      {isPihole && service ? (
        <PiholeDetailView service={service} metrics={metrics ?? {}} />
      ) : isPihole && !service ? (
        <p className="text-label" style={{ color: 'var(--text-offwhite)' }}>
          NO DATA — configure Pi-hole in Settings
        </p>
      ) : isArr && metrics ? (
        /* Arr services: rich operational detail view */
        <ArrDetailView serviceId={serviceId!} metrics={metrics} />
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
