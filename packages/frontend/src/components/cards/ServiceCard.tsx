import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { ServiceStatus } from '@coruscant/shared'
import { StatusDot } from '../ui/StatusDot.js'
import { StaleIndicator } from '../ui/StaleIndicator.js'

// Card outline glow per non-healthy status (D-13)
function getCardGlow(status: ServiceStatus['status']): string {
  const base = 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)'
  if (status === 'warning') return `${base}, 0 0 12px rgba(232,160,32,0.3)`
  if (status === 'offline') return `${base}, 0 0 12px rgba(255,59,59,0.3)`
  return base
}

// NAS gauge bar instrument
function NasInstrument({ metrics }: { metrics: Record<string, unknown> }) {
  const cpu = typeof metrics.cpu === 'number' ? metrics.cpu : 0
  const ram = typeof metrics.ram === 'number' ? metrics.ram : 0
  const disk = typeof metrics.diskPercent === 'number' ? metrics.diskPercent : 0
  const temp = typeof metrics.tempC === 'number' ? metrics.tempC : 0

  const gauges = [
    { label: 'CPU', value: Math.round(cpu), unit: '%', percent: cpu },
    { label: 'RAM', value: Math.round(ram), unit: '%', percent: ram },
    { label: 'DISK', value: Math.round(disk), unit: '%', percent: disk },
    { label: 'TEMP', value: Math.round(temp), unit: '°C', percent: (temp / 80) * 100 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {gauges.map(({ label, value, unit, percent }) => (
        <div key={label}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '2px',
            }}
          >
            <span
              className="text-label"
              style={{ color: '#C8C8C8', fontSize: '9px', textTransform: 'uppercase' }}
            >
              {label}
            </span>
            <span
              className="text-label"
              style={{ color: 'var(--cockpit-amber)', fontSize: '9px' }}
            >
              {value}{unit}
            </span>
          </div>
          <div
            style={{
              height: '4px',
              background: 'rgba(232,160,32,0.15)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(Math.max(percent, 0), 100)}%`,
                background: 'var(--cockpit-amber)',
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// Dot matrix for arr services (Radarr/Sonarr/Lidarr/Bazarr)
function DotMatrixInstrument({ metrics }: { metrics: Record<string, unknown> }) {
  const queueCount = typeof metrics.queueCount === 'number' ? metrics.queueCount : 0
  const monitoredCount = typeof metrics.monitoredCount === 'number' ? metrics.monitoredCount : 0
  const COLS = 4
  const ROWS = 3
  const SLOTS = COLS * ROWS // 12

  const dots = Array.from({ length: SLOTS }, (_, i) => {
    if (i < Math.min(queueCount, SLOTS)) return 'queue'
    if (i < Math.min(monitoredCount, SLOTS)) return 'healthy'
    return 'empty'
  })

  const dotColors: Record<string, string> = {
    queue: 'var(--cockpit-amber)',
    healthy: 'var(--cockpit-green)',
    empty: 'var(--cockpit-grey)',
  }

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 8px)`,
          gap: '2px',
        }}
      >
        {dots.map((type, i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              background: dotColors[type],
              opacity: type === 'empty' ? 0.3 : 1,
            }}
          />
        ))}
      </div>
      <div
        className="text-label"
        style={{ color: '#C8C8C8', fontSize: '9px', marginTop: '4px' }}
      >
        {queueCount} QUEUED / {monitoredCount} MONITORED
      </div>
    </div>
  )
}

// Plex signal strength bars
function PlexInstrument({ metrics }: { metrics: Record<string, unknown> }) {
  const activeStreams = typeof metrics.activeStreams === 'number' ? metrics.activeStreams : 0
  const maxStreams = typeof metrics.maxStreams === 'number' ? metrics.maxStreams : 5

  const barHeights = [4, 8, 12, 16, 20]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', marginBottom: '4px' }}>
        {barHeights.map((h, i) => (
          <div
            key={i}
            style={{
              width: '6px',
              height: `${h}px`,
              background:
                i < Math.min(activeStreams, maxStreams)
                  ? 'var(--cockpit-green)'
                  : 'rgba(232,160,32,0.15)',
              borderRadius: '1px',
            }}
          />
        ))}
      </div>
      <div
        className="text-label"
        style={{ color: '#C8C8C8', fontSize: '9px' }}
      >
        {activeStreams} ACTIVE
      </div>
    </div>
  )
}

// SABnzbd download progress bar
function SabnzbdInstrument({ metrics }: { metrics: Record<string, unknown> }) {
  const speedMBs = typeof metrics.speedMBs === 'number' ? metrics.speedMBs : 0
  const queueCount = typeof metrics.queueCount === 'number' ? metrics.queueCount : 0
  const progressPercent = typeof metrics.progressPercent === 'number' ? metrics.progressPercent : 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <span
          className="text-label"
          style={{ color: 'var(--cockpit-amber)', fontSize: '9px' }}
        >
          {speedMBs.toFixed(1)} MB/s
        </span>
        <span
          className="text-label"
          style={{ color: '#C8C8C8', fontSize: '9px' }}
        >
          {queueCount} QUEUED
        </span>
      </div>
      <div
        style={{
          height: '6px',
          background: 'rgba(232,160,32,0.15)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(Math.max(progressPercent, 0), 100)}%`,
            background: 'var(--cockpit-amber)',
            borderRadius: '3px',
          }}
        />
      </div>
    </div>
  )
}

// Pi-hole stat readouts
function PiholeInstrument({ metrics }: { metrics: Record<string, unknown> }) {
  const blockedPercent =
    typeof metrics.blockedPercent === 'number' ? metrics.blockedPercent : 0
  const totalQueries =
    typeof metrics.totalQueries === 'number' ? metrics.totalQueries : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="text-label" style={{ color: '#C8C8C8', fontSize: '9px' }}>
          BLOCKED
        </span>
        <span className="text-label" style={{ color: 'var(--cockpit-amber)', fontSize: '9px' }}>
          {blockedPercent.toFixed(1)}%
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="text-label" style={{ color: '#C8C8C8', fontSize: '9px' }}>
          QUERIES
        </span>
        <span className="text-label" style={{ color: 'var(--cockpit-amber)', fontSize: '9px' }}>
          {totalQueries.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr'])

function renderInstrumentBody(service: ServiceStatus): React.ReactNode {
  const metrics = service.metrics as Record<string, unknown> | undefined
  if (!metrics) return null

  if (service.id === 'nas-detail') {
    return <NasInstrument metrics={metrics} />
  }
  if (ARR_IDS.has(service.id)) {
    return <DotMatrixInstrument metrics={metrics} />
  }
  if (service.id === 'plex') {
    return <PlexInstrument metrics={metrics} />
  }
  if (service.id === 'sabnzbd') {
    return <SabnzbdInstrument metrics={metrics} />
  }
  if (service.id === 'pihole') {
    return <PiholeInstrument metrics={metrics} />
  }
  return null
}

interface ServiceCardProps {
  service: ServiceStatus
  index: number
}

export function ServiceCard({ service, index }: ServiceCardProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  const handleClick = () => {
    // Save scroll position for restoration on back nav (UI-SPEC Scroll behavior)
    sessionStorage.setItem('dashboardScrollY', window.scrollY.toString())
    navigate(`/services/${service.id}`)
  }

  const instrumentBody = renderInstrumentBody(service)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${service.name}, status: ${service.status}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="chamfer-card"
      style={{
        position: 'relative',
        minHeight: '160px',
        padding: 0,
        background: 'var(--bg-panel)',
        border: `1px solid ${hovered ? 'rgba(232,160,32,0.60)' : 'var(--border-rest)'}`,
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: getCardGlow(service.status),
      }}
    >
      {/* 6px amber header strip (D-17) */}
      <div
        style={{
          height: '6px',
          background: 'var(--cockpit-amber)',
          flexShrink: 0,
        }}
      />

      {/* Header row: service name + status LED */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px 0 12px',
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
          {service.name}
        </span>
        <StatusDot status={service.status} />
      </div>

      {/* Stale indicator row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '2px 12px 0 12px',
        }}
      >
        <StaleIndicator lastPollAt={service.lastPollAt} />
      </div>

      {/* Instrument body (service-specific) */}
      {instrumentBody && (
        <div style={{ padding: '8px 12px 12px 12px', flex: 1 }}>{instrumentBody}</div>
      )}
    </motion.div>
  )
}
