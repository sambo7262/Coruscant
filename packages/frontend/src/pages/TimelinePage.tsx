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

// Per-service metric configs per UI-SPEC (prescriptive color mapping)
const NAS_METRICS: MetricConfig[] = [
  { key: 'cpu', label: 'CPU', color: 'var(--cockpit-amber)', fillOpacity: 0.4, domain: [0, 100], chartType: 'area' },
  { key: 'ram', label: 'RAM', color: 'rgba(232,160,32,0.6)', fillOpacity: 0.25, domain: [0, 100], chartType: 'area' },
  { key: 'networkMbpsUp', label: 'NET UP', color: '#00c8ff', chartType: 'line', domain: ['auto', 'auto'] },
  { key: 'networkMbpsDown', label: 'NET DWN', color: '#00c8ff', chartType: 'line', domain: ['auto', 'auto'] },
]

const NAS_DISK_CONFIG = (key: string, label: string): MetricConfig => ({
  key,
  label,
  color: 'rgba(232,160,32,0.8)',
  chartType: 'line',
  domain: [0, 100],
})

const DOCKER_METRICS: MetricConfig[] = [
  { key: 'dockerCpu', label: 'CPU', color: 'rgba(232,160,32,0.7)', fillOpacity: 0.3, domain: [0, 100], chartType: 'area' },
  { key: 'dockerRam', label: 'RAM', color: 'rgba(232,160,32,0.5)', fillOpacity: 0.2, domain: [0, 100], chartType: 'area' },
]

const PIHOLE_METRICS: MetricConfig[] = [
  { key: 'queriesPerSecond', label: 'Q/S', color: 'var(--cockpit-amber)', fillOpacity: 0.3, domain: ['auto', 'auto'], chartType: 'area' },
  { key: 'percentBlocked', label: 'BLKD%', color: 'var(--cockpit-green)', fillOpacity: 0.3, domain: [0, 100], chartType: 'area' },
]

const UNIFI_METRICS: MetricConfig[] = [
  { key: 'wanTxMbps', label: 'WAN TX', color: '#00c8ff', chartType: 'line', domain: ['auto', 'auto'] },
  { key: 'wanRxMbps', label: 'WAN RX', color: '#00c8ff', chartType: 'line', domain: ['auto', 'auto'] },
  { key: 'clientCount', label: 'CLIENTS', color: 'var(--cockpit-green)', chartType: 'line', domain: ['auto', 'auto'] },
]

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

  // Pi Health (Raspberry Pi) card uses piHealth service data
  const PI_HEALTH_METRICS: MetricConfig[] = [
    { key: 'cpuPercent', label: 'CPU', color: 'var(--cockpit-amber)', fillOpacity: 0.4, domain: [0, 100], chartType: 'area' },
    { key: 'cpuTempC', label: 'TEMP', color: 'rgba(232,160,32,0.6)', chartType: 'line', domain: ['auto', 'auto'] },
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
              />
              <SparklineCard
                service="PI-HOLE"
                points={piholePoints}
                metrics={PIHOLE_METRICS}
                loading={loading}
              />
              <SparklineCard
                service="UNIFI"
                points={unifiPoints}
                metrics={UNIFI_METRICS}
                loading={loading}
              />
              {hasDockerMetrics && (
                <SparklineCard
                  service="DOCKER"
                  points={nasPoints}
                  metrics={DOCKER_METRICS}
                  loading={loading}
                />
              )}
              {piHealthPoints.length > 0 && (
                <SparklineCard
                  service="PI HEALTH"
                  points={piHealthPoints}
                  metrics={PI_HEALTH_METRICS}
                  loading={loading}
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
