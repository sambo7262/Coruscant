import { useState, useEffect } from 'react'
import type { LogEntry } from '../hooks/useDashboardSSE.js'
import { useViewport } from '../viewport/index.js'
import { TimeWindowSelector } from '../components/timeline/TimeWindowSelector.js'
import type { TimeWindow } from '../components/timeline/TimeWindowSelector.js'
import { SparklineCard } from '../components/timeline/SparklineCard.js'
import type { MetricConfig } from '../components/timeline/SparklineCard.js'
import { LogsPage } from './LogsPage.js'
import { MediaEventList } from '../components/timeline/MediaEventList.js'

interface TimelinePageProps {
  lastLogEntry?: LogEntry | null
}

type ActiveTab = 'timeline' | 'raw'

interface MetricsResponse {
  service: string
  window: string
  points: Array<Record<string, number | string>>
}

// Per-service metric configs — amber for CPU, colorful for others
const NAS_METRICS: MetricConfig[] = [
  { key: 'cpu', label: 'CPU', color: 'var(--cockpit-amber)', fillOpacity: 0.4, domain: [0, 100], chartType: 'area', unit: '%' },
  { key: 'ram', label: 'RAM', color: '#4ADE80', fillOpacity: 0.25, domain: [0, 100], chartType: 'area', unit: '%' },
  { key: 'networkMbpsUp', label: 'NET UP', color: '#FF3B3B', chartType: 'line', domain: ['auto', 'auto'], unit: ' Mbps' },
  { key: 'networkMbpsDown', label: 'NET DWN', color: '#00c8ff', chartType: 'line', domain: ['auto', 'auto'], unit: ' Mbps' },
]

const NAS_DISK_CONFIG = (key: string, label: string): MetricConfig => ({
  key,
  label,
  color: 'rgba(232,160,32,0.8)',
  chartType: 'line',
  domain: [0, 100],
  unit: '%',
})

const DOCKER_METRICS: MetricConfig[] = [
  { key: 'dockerCpu', label: 'CPU', color: 'var(--cockpit-amber)', fillOpacity: 0.3, domain: [0, 100], chartType: 'area', unit: '%' },
  { key: 'dockerRam', label: 'RAM', color: '#8B5CF6', fillOpacity: 0.2, domain: [0, 100], chartType: 'area', unit: '%' },
]

const PIHOLE_METRICS: MetricConfig[] = [
  { key: 'queriesPerSecond', label: 'Q/S', color: '#00c8ff', fillOpacity: 0.3, domain: ['auto', 'auto'], chartType: 'area', unit: ' q/s' },
  { key: 'percentBlocked', label: 'BLKD%', color: '#FF3B3B', fillOpacity: 0.3, domain: [0, 100], chartType: 'area', unit: '%' },
]

const UNIFI_METRICS: MetricConfig[] = [
  { key: 'wanTxMbps', label: 'WAN TX', color: '#FF3B3B', chartType: 'line', domain: ['auto', 'auto'], unit: ' Mbps' },
  { key: 'wanRxMbps', label: 'WAN RX', color: '#00c8ff', chartType: 'line', domain: ['auto', 'auto'], unit: ' Mbps' },
  { key: 'clientCount', label: 'CLIENTS', color: '#4ADE80', chartType: 'line', domain: ['auto', 'auto'] },
]

const DISK_TEMP_COLORS = ['#E8A020', '#00c8ff', '#4ADE80', '#FF3B3B', '#8B5CF6', '#FF8C00']

const btnBase: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  padding: '8px 16px',
  borderRadius: '3px',
  cursor: 'pointer',
  textTransform: 'uppercase' as const,
  minHeight: '36px',
  whiteSpace: 'nowrap' as const,
  background: 'transparent',
  border: 'none',
}

async function fetchMetrics(service: string, window: TimeWindow): Promise<MetricsResponse> {
  const res = await fetch(`/api/metrics/history?service=${service}&window=${window}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<MetricsResponse>
}

export function TimelinePage({ lastLogEntry }: TimelinePageProps) {
  const viewport = useViewport()
  const isIphone = viewport.startsWith('iphone')
  const isPortrait = viewport === 'iphone-portrait'

  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline')
  const [activeWindow, setActiveWindow] = useState<TimeWindow>('24h')

  const [nasPoints, setNasPoints] = useState<Array<Record<string, number | string>>>([])
  const [piholePoints, setPiholePoints] = useState<Array<Record<string, number | string>>>([])
  const [unifiPoints, setUnifiPoints] = useState<Array<Record<string, number | string>>>([])
  const [piHealthPoints, setPiHealthPoints] = useState<Array<Record<string, number | string>>>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void Promise.all([
      fetchMetrics('nas', activeWindow),
      fetchMetrics('pihole', activeWindow),
      fetchMetrics('unifi', activeWindow),
      fetchMetrics('piHealth', activeWindow),
    ])
      .then(([nas, pihole, unifi, piHealth]) => {
        if (cancelled) return
        setNasPoints(nas.points)
        setPiholePoints(pihole.points)
        setUnifiPoints(unifi.points)
        setPiHealthPoints(piHealth.points)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('HEALTH DATA UNAVAILABLE — Check that the backend is reachable and metric history is being recorded.')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [activeWindow])

  // Determine grid columns from viewport
  const gridColumns = isPortrait ? 1 : 2

  // Build NAS disk sparklines from points data (dynamic per volume key)
  const diskMetrics: MetricConfig[] = []
  if (nasPoints.length > 0) {
    const samplePoint = nasPoints[nasPoints.length - 1]
    Object.keys(samplePoint)
      .filter(k => k.startsWith('vol_'))
      .forEach(k => {
        const volName = k.replace('vol_', '').toUpperCase()
        diskMetrics.push(NAS_DISK_CONFIG(k, volName))
      })
  }

  const nasMetrics = [...NAS_METRICS, ...diskMetrics]

  // Only show Docker card if dockerCpu/dockerRam keys appear in NAS points
  const hasDockerMetrics = nasPoints.length > 0 && nasPoints.some(p => p['dockerCpu'] !== undefined)

  // Build disk temp metrics — all drives on one chart with different colors, converted to °F
  // Keys from backend: dt_disk1, dt_disk2, etc. (using disk.id for safe Recharts dataKey)
  const diskTempMetrics: MetricConfig[] = []
  const nasPointsWithDiskF = nasPoints.map(p => {
    const converted: Record<string, number | string> = { ...p }
    Object.keys(p).filter(k => k.startsWith('dt_')).forEach(k => {
      const c = typeof p[k] === 'number' ? p[k] as number : typeof p[k] === 'string' ? parseFloat(p[k] as string) : NaN
      converted[`${k}F`] = isNaN(c) ? 0 : c * 9 / 5 + 32
    })
    return converted
  })
  if (nasPoints.length > 0) {
    const samplePoint = nasPoints[nasPoints.length - 1]
    Object.keys(samplePoint)
      .filter(k => k.startsWith('dt_'))
      .sort()
      .forEach((k, idx) => {
        const diskId = k.replace('dt_', '').replace(/(\d)/g, ' $1').trim().toUpperCase()
        diskTempMetrics.push({
          key: `${k}F`,
          label: diskId,
          color: DISK_TEMP_COLORS[idx % DISK_TEMP_COLORS.length],
          chartType: 'line',
          domain: ['auto', 'auto'],
          unit: '°F',
        })
      })
  }

  // Convert Pi health temps from C to F
  const piHealthPointsF = piHealthPoints.map(p => {
    const c = typeof p['cpuTempC'] === 'number' ? p['cpuTempC'] : typeof p['cpuTempC'] === 'string' ? parseFloat(p['cpuTempC']) : NaN
    return { ...p, cpuTempF: isNaN(c) ? undefined : c * 9 / 5 + 32 }
  })

  const PI_HEALTH_METRICS: MetricConfig[] = [
    { key: 'cpuPercent', label: 'CPU', color: 'var(--cockpit-amber)', fillOpacity: 0.4, domain: [0, 100], chartType: 'area', unit: '%' },
    { key: 'cpuTempF', label: 'TEMP', color: '#FF3B3B', chartType: 'line', domain: ['auto', 'auto'], unit: '°F' },
  ]

  return (
    <div style={{ padding: '0 16px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Title + sub-tab switcher (stacked to avoid horizontal overflow on iPhone) */}
      <div style={{ marginBottom: '16px' }}>
        <h1
          className="text-display"
          style={{ color: 'var(--cockpit-amber)', letterSpacing: '0.08em', marginBottom: '8px' }}
        >
          ACTIVITY TIMELINE
        </h1>
        {/* Sub-tab switcher */}
        <div style={{ display: 'flex', gap: '0' }}>
          {(['timeline', 'raw'] as ActiveTab[]).map((tab) => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  ...btnBase,
                  color: isActive ? 'var(--cockpit-amber)' : 'var(--text-offwhite)',
                  borderBottom: isActive ? '2px solid var(--cockpit-amber)' : '2px solid transparent',
                  minHeight: isIphone ? '44px' : '36px',
                  paddingBottom: isActive ? '6px' : '8px',
                }}
              >
                {tab === 'timeline' ? 'TIMELINE' : 'RAW LOGS'}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'raw' ? (
        <LogsPage lastLogEntry={lastLogEntry} />
      ) : (
        <>
          {/* Time window selector */}
          <div style={{ marginBottom: '24px' }}>
            <TimeWindowSelector value={activeWindow} onChange={setActiveWindow} />
          </div>

          {/* Section heading */}
          <h2
            className="text-heading"
            style={{ color: 'var(--cockpit-amber)', letterSpacing: '0.08em', marginBottom: '16px' }}
          >
            INFRASTRUCTURE HEALTH
          </h2>

          {/* Error state */}
          {error && !loading && (
            <div style={{
              background: 'var(--space-mid)',
              border: '1px solid var(--cockpit-red)',
              borderRadius: '4px',
              padding: '16px',
              marginBottom: '16px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              color: 'var(--cockpit-red)',
              letterSpacing: '0.04em',
            }}>
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{
              textAlign: 'center',
              padding: '32px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              color: 'var(--cockpit-amber)',
              letterSpacing: '0.08em',
            }}>
              LOADING...
            </div>
          )}

          {/* Sparkline card grid */}
          {!error && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gap: '12px',
              marginBottom: '32px',
            }}>
              <SparklineCard
                service="NAS"
                points={nasPoints}
                metrics={nasMetrics}
                loading={loading}
                window={activeWindow}
              />
              <SparklineCard
                service="PI-HOLE"
                points={piholePoints}
                metrics={PIHOLE_METRICS}
                loading={loading}
                window={activeWindow}
              />
              <SparklineCard
                service="UNIFI"
                points={unifiPoints}
                metrics={UNIFI_METRICS}
                loading={loading}
                window={activeWindow}
              />
              {hasDockerMetrics && (
                <SparklineCard
                  service="DOCKER"
                  points={nasPoints}
                  metrics={DOCKER_METRICS}
                  loading={loading}
                  window={activeWindow}
                />
              )}
              {diskTempMetrics.length > 0 && (
                <SparklineCard
                  service="DISK TEMPS"
                  points={nasPointsWithDiskF}
                  metrics={diskTempMetrics}
                  loading={loading}
                  window={activeWindow}
                  multiLine
                />
              )}
              {piHealthPoints.length > 0 && (
                <SparklineCard
                  service="PI HEALTH"
                  points={piHealthPointsF}
                  metrics={PI_HEALTH_METRICS}
                  loading={loading}
                  window={activeWindow}
                />
              )}
            </div>
          )}

          {/* 32px spacer between sparkline grid and media events section (xl spacing per UI-SPEC) */}
          <div style={{ height: '32px' }} />

          {/* Media event list */}
          <MediaEventList window={activeWindow} />

          {/* Bottom padding to clear NowPlayingBanner */}
          <div style={{ height: '48px' }} />
        </>
      )}
    </div>
  )
}
