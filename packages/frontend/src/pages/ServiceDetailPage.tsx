import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { PieChart, Pie, Cell } from 'recharts'
import type { DashboardSnapshot, UnifiDevice, UnifiMetrics } from '@coruscant/shared'
import { StatusDot } from '../components/ui/StatusDot.js'

interface ServiceDetailPageProps {
  snapshot: DashboardSnapshot | null
}

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr'])

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

/** SABnzbd detail view: active download at top + full queue list below (D-08) */
function SabnzbdDetailView({ metrics }: { metrics: Record<string, unknown> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Active download — top section */}
      {typeof metrics.currentFilename === 'string' && metrics.currentFilename && (
        <div style={{
          padding: '12px',
          borderBottom: '1px solid rgba(232,160,32,0.15)',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ fontSize: '10px', color: 'rgba(232,160,32,0.5)', letterSpacing: '0.06em', marginBottom: '6px' }}>
            ACTIVE DOWNLOAD
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cockpit-amber)', marginBottom: '4px', wordBreak: 'break-all' }}>
            {String(metrics.currentFilename)}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-offwhite)', marginBottom: '6px' }}>
            <span>{typeof metrics.speedMBs === 'number' ? metrics.speedMBs.toFixed(1) : '--'} MB/s</span>
            <span>ETA {typeof metrics.timeLeft === 'string' ? metrics.timeLeft : '--'}</span>
          </div>
          {/* Progress bar */}
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${typeof metrics.progressPercent === 'number' ? metrics.progressPercent : 0}%`,
              background: 'var(--cockpit-purple)',
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Queue section */}
      <div style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
        <div style={{ fontSize: '10px', color: 'rgba(232,160,32,0.5)', letterSpacing: '0.06em', marginBottom: '6px' }}>
          QUEUE ({typeof metrics.queueCount === 'number' ? metrics.queueCount : 0})
        </div>
        {/* If queue items are available as an array, render them */}
        {Array.isArray(metrics.queueItems) && (metrics.queueItems as Record<string, unknown>[]).map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
            fontSize: '10px',
          }}>
            <span style={{ color: 'var(--text-offwhite)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {String(item.filename ?? '')}
            </span>
            <span style={{ color: 'rgba(232,160,32,0.6)', flexShrink: 0, marginLeft: '8px' }}>
              {String(item.status ?? '')}
            </span>
          </div>
        ))}
        {/* Fallback if no queue items array */}
        {!Array.isArray(metrics.queueItems) && typeof metrics.queueCount === 'number' && metrics.queueCount > 0 && (
          <div style={{ fontSize: '10px', color: 'var(--text-offwhite)' }}>
            {metrics.queueCount} item(s) queued
          </div>
        )}
        {/* Idle state */}
        {!metrics.currentFilename && (typeof metrics.queueCount !== 'number' || metrics.queueCount === 0) && (
          <div style={{ fontSize: '10px', color: '#555' }}>IDLE — no active downloads</div>
        )}
      </div>
    </div>
  )
}

/** Arr-specific detail view: status/version dot-leader rows + health warnings (D-14) */
function ArrDetailView({
  service,
  metrics,
}: {
  service: { status: string; configured?: boolean }
  metrics: Record<string, unknown>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Status and version — dot-leader rows */}
      <div style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-offwhite)' }}>STATUS</span>
          <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.15)', margin: '0 8px', alignSelf: 'flex-end' }} />
          <span style={{ color: service.status === 'online' ? 'var(--cockpit-green, #4ADE80)' : 'var(--cockpit-red)' }}>
            {service.status === 'online' ? 'ONLINE' : service.status === 'warning' ? 'DEGRADED' : 'OFFLINE'}
          </span>
        </div>
        {typeof metrics.version === 'string' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-offwhite)' }}>VERSION</span>
            <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.15)', margin: '0 8px', alignSelf: 'flex-end' }} />
            <span style={{ color: 'var(--text-offwhite)' }}>{metrics.version}</span>
          </div>
        )}
      </div>

      {/* Health warnings (D-14) */}
      {Array.isArray(metrics.healthWarnings) && metrics.healthWarnings.length > 0 && (
        <div style={{
          padding: '0 12px 12px 12px',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ fontSize: '10px', color: 'var(--cockpit-amber)', letterSpacing: '0.06em', marginBottom: '6px' }}>
            WARNINGS ({(metrics.healthWarnings as unknown[]).length})
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {(metrics.healthWarnings as Record<string, unknown>[]).map((warn, i) => (
              <div key={i} style={{
                padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                fontSize: '10px',
              }}>
                <div style={{ color: 'var(--cockpit-amber)', marginBottom: '2px' }}>
                  {String(warn.source ?? '')}
                </div>
                <div style={{ color: 'var(--text-offwhite)', lineHeight: '1.3' }}>
                  {String(warn.message ?? '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* No warnings state */}
      {(!Array.isArray(metrics.healthWarnings) || (metrics.healthWarnings as unknown[]).length === 0) && (
        <div style={{ padding: '0 12px 12px 12px', fontSize: '10px', color: '#555', fontFamily: 'var(--font-mono)' }}>
          No health warnings
        </div>
      )}
    </div>
  )
}

/** Single device row: LED + model + uptime + client count (D-11) */
function DeviceRow({ device }: { device: UnifiDevice }) {
  const isOnline = device.state === 'online'
  const days = Math.floor(device.uptime / 86_400)
  const hours = Math.floor((device.uptime % 86_400) / 3_600)
  const uptimeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '10px',
      fontFamily: 'var(--font-mono)', color: 'var(--text-offwhite)' }}>
      <span style={{ color: isOnline ? 'var(--cockpit-green, #4ADE80)' : 'var(--cockpit-red)', fontSize: '10px' }}>
        {isOnline ? '●' : '✕'}
      </span>
      <span style={{ flex: 1 }}>{device.model}</span>
      {isOnline && <span style={{ color: '#666' }}>up {uptimeStr}</span>}
      {isOnline && device.clientCount > 0 && (
        <span style={{ color: 'var(--cockpit-amber)', marginLeft: 'auto' }}>{device.clientCount} cl</span>
      )}
    </div>
  )
}

/** Device group section with amber ribbon label (D-10) */
function DeviceSection({ label, devices }: { label: string; devices: UnifiDevice[] }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '9px', color: 'var(--cockpit-amber)', letterSpacing: '0.08em',
        textTransform: 'uppercase', fontFamily: 'var(--font-mono)',
        marginBottom: '4px', borderBottom: '1px solid rgba(232,160,32,0.2)', paddingBottom: '2px' }}>
        {label}
      </div>
      {devices.map(d => <DeviceRow key={d.macAddress} device={d} />)}
    </div>
  )
}

/** UniFi device list grouped by type — shown below Pi-hole stats in NETWORK detail (D-10, D-11, D-13) */
function UnifiDetailView({ metrics }: { metrics: Record<string, unknown> }) {
  const um = metrics as unknown as UnifiMetrics
  const devices = um?.devices ?? []

  const classify = (m: string) => {
    const u = m.toUpperCase()
    if (u.startsWith('UDM') || u.startsWith('UDMP') || u.startsWith('UDR')) return 'gateway'
    if (u.startsWith('USW')) return 'switch'
    if (u.startsWith('U6') || u.startsWith('UAP') || u.startsWith('UAL') || u.startsWith('UAE')) return 'ap'
    return 'other'
  }

  const gateways = devices.filter(d => classify(d.model) === 'gateway')
  const switches = devices.filter(d => classify(d.model) === 'switch')
  const aps = devices.filter(d => classify(d.model) === 'ap')
  const knownMacs = new Set([...gateways, ...switches, ...aps].map(d => d.macAddress))
  const other = devices.filter(d => !knownMacs.has(d.macAddress))

  return (
    <div style={{ overflowY: 'auto' }}>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: '12px', fontSize: '10px', fontFamily: 'var(--font-mono)',
        color: 'var(--text-offwhite)', marginBottom: '10px' }}>
        <span>{um?.clientCount ?? 0} clients</span>
        <span>TX {um?.wanTxMbps !== null && um?.wanTxMbps !== undefined ? `${Math.round(um.wanTxMbps)}M` : '—'}</span>
        <span>RX {um?.wanRxMbps !== null && um?.wanRxMbps !== undefined ? `${Math.round(um.wanRxMbps)}M` : '—'}</span>
      </div>
      {gateways.length > 0 && <DeviceSection label="GATEWAYS" devices={gateways} />}
      {switches.length > 0 && <DeviceSection label="SWITCHES" devices={switches} />}
      {aps.length > 0 && <DeviceSection label="ACCESS POINTS" devices={aps} />}
      {other.length > 0 && <DeviceSection label="OTHER" devices={other} />}
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

      {/* QUERY DISTRIBUTION donut chart with static table legend (D-17) */}
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
          {/* Layout: donut chart left, static legend table right (D-17) */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <PieChart width={120} height={120}>
              <Pie
                data={queryTypeData}
                cx={60}
                cy={60}
                innerRadius={35}
                outerRadius={55}
                dataKey="value"
                stroke="none"
              >
                {queryTypeData.map((_, index) => (
                  <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>

            {/* Static legend table — no tooltips (D-17) */}
            <table style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
              <tbody>
                {queryTypeData.map((entry, i) => (
                  <tr key={i}>
                    <td style={{ paddingRight: '6px', paddingBottom: '2px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    </td>
                    <td style={{ paddingRight: '12px', color: 'var(--cockpit-amber)', paddingBottom: '2px' }}>{entry.name}</td>
                    <td style={{ color: 'var(--text-offwhite)', paddingBottom: '2px', textAlign: 'right' }}>{entry.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const isSabnzbd = serviceId === 'sabnzbd'

  // Pi-hole header shows NETWORK (D-15); SABnzbd header shows DOWNLOADS
  const displayName = isPihole
    ? 'NETWORK'
    : isSabnzbd
    ? 'DOWNLOADS'
    : (service?.name ?? serviceId)

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
          {displayName}
        </h1>
      </div>

      {/* Pi-hole: rich detail view with donut chart + UniFi device list below */}
      {isPihole && service ? (
        <>
          <PiholeDetailView service={service} metrics={metrics ?? {}} />
          {(() => {
            const unifiService = snapshot?.services.find(s => s.id === 'unifi')
            return unifiService?.metrics ? (
              <div style={{ marginTop: '24px', borderTop: '1px solid rgba(232,160,32,0.15)', paddingTop: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--cockpit-amber)', letterSpacing: '0.08em',
                  textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
                  UBIQUITI DEVICES
                </div>
                <UnifiDetailView metrics={unifiService.metrics as Record<string, unknown>} />
              </div>
            ) : null
          })()}
        </>
      ) : isPihole && !service ? (
        <p className="text-label" style={{ color: 'var(--text-offwhite)' }}>
          NO DATA — configure Pi-hole in Settings
        </p>
      ) : isSabnzbd && metrics ? (
        /* SABnzbd: active download + queue list (D-08) */
        <SabnzbdDetailView metrics={metrics} />
      ) : isArr && service && metrics ? (
        /* Arr services: status/version dot-leaders + health warnings (D-14) */
        <ArrDetailView service={service} metrics={metrics} />
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
