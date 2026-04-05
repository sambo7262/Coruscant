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

// Arr instrument body: minimal 2-row readout (status LED + download indicator)
// Replaces the dot-matrix grid — shows only what matters at a glance
function ArrInstrument({ service, metrics }: { service: ServiceStatus; metrics: Record<string, unknown> }) {
  const isBazarr = service.id === 'bazarr'
  const downloading = metrics.downloading === true
  const activeDownloads = typeof metrics.activeDownloads === 'number' ? metrics.activeDownloads : 0
  const downloadQuality = typeof metrics.downloadQuality === 'string' ? metrics.downloadQuality : ''
  const downloadProgress = typeof metrics.downloadProgress === 'number' ? metrics.downloadProgress : 0
  const activeSubtitleGrabs = typeof metrics.activeSubtitleGrabs === 'number' ? metrics.activeSubtitleGrabs : 0

  // Status text for the LED row
  const statusText =
    service.status === 'online' ? 'ONLINE'
    : service.status === 'warning' ? 'DEGRADED'
    : service.status === 'offline' ? 'OFFLINE'
    : 'STALE'

  // LED colour per status — purple when online AND actively downloading
  const ledColor =
    service.status === 'online' && downloading
      ? 'var(--cockpit-purple)'
      : service.status === 'online'
      ? 'var(--cockpit-green)'
      : service.status === 'warning'
      ? 'var(--cockpit-amber)'
      : '#ff3b3b'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Row 1: large status LED + status text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: ledColor,
            boxShadow: `0 0 6px ${ledColor}`,
            flexShrink: 0,
          }}
        />
        <span
          className="text-label"
          style={{ color: 'var(--text-offwhite)', fontSize: '11px', textTransform: 'uppercase' }}
        >
          {statusText}
        </span>
      </div>

      {/* Row 2: download indicator or subtitle grab indicator */}
      {isBazarr ? (
        /* Bazarr: subtitle grab indicator */
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            className="text-label"
            style={{
              color: activeSubtitleGrabs > 0 ? 'var(--cockpit-amber)' : '#444',
              fontSize: '9px',
              textTransform: 'uppercase',
            }}
          >
            {activeSubtitleGrabs > 0
              ? `SUBTITLES  x${activeSubtitleGrabs}`
              : 'IDLE'}
          </span>
        </div>
      ) : downloading && activeDownloads > 0 ? (
        /* Active download: pulsing purple bar + label */
        <div>
          <div
            style={{
              height: '4px',
              background: 'rgba(139,92,246,0.15)',
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '4px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(Math.max(downloadProgress, 5), 100)}%`,
                background: 'var(--cockpit-purple)',
                borderRadius: '2px',
                animation: 'arrDownloadPulsePurple 1.4s ease-in-out infinite',
              }}
            />
          </div>
          <span
            className="text-label"
            style={{ color: 'var(--cockpit-purple)', fontSize: '9px', textTransform: 'uppercase' }}
          >
            {`DOWNLOADING  ${downloadQuality} x${activeDownloads}`}
          </span>
        </div>
      ) : (
        /* Idle */
        <span
          className="text-label"
          style={{ color: '#444', fontSize: '9px', textTransform: 'uppercase' }}
        >
          IDLE
        </span>
      )}
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

// SABnzbd natural display: filename, speed, ETA (D-04)
// Text is always amber — only the StatusDot LED handles purple states (D-05)
function SabnzbdInstrument({ metrics }: { metrics: Record<string, unknown> }) {
  const speed = typeof metrics.speedMBs === 'number' ? metrics.speedMBs.toFixed(1) : '--'
  const filename = typeof metrics.currentFilename === 'string' && metrics.currentFilename
    ? metrics.currentFilename : ''
  const eta = typeof metrics.timeLeft === 'string' && metrics.timeLeft
    ? metrics.timeLeft : ''
  const queueCount = typeof metrics.queueCount === 'number' ? metrics.queueCount : 0
  const speedMBs = typeof metrics.speedMBs === 'number' ? metrics.speedMBs : 0
  const hasActivity = queueCount > 0 || speedMBs > 0

  if (!hasActivity && !filename) {
    return (
      <span
        className="text-label"
        style={{ color: '#444', fontSize: '9px', textTransform: 'uppercase' }}
      >
        IDLE
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'var(--font-mono)' }}>
      {/* Filename — truncated, always amber (D-04) */}
      {filename && (
        <div style={{
          fontSize: '9px',
          color: 'var(--cockpit-amber)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}>
          {filename}
        </div>
      )}
      {/* Speed + ETA row — text always amber (D-05) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '14px', color: 'var(--cockpit-amber)', fontWeight: 600 }}>
          {speed} MB/s
        </span>
        {eta && (
          <span style={{ fontSize: '9px', color: 'var(--text-offwhite)' }}>
            ETA {eta}
          </span>
        )}
      </div>
    </div>
  )
}

// NETWORK card: Pi-hole section + Ubiquiti placeholder (D-15, D-16)
function NetworkInstrument({ metrics }: { metrics: Record<string, unknown> }) {
  const qpm = typeof metrics.queriesPerMinute === 'number'
    ? metrics.queriesPerMinute.toFixed(1) : '--'
  const load = typeof metrics.load1m === 'number'
    ? metrics.load1m.toFixed(2) : '--'
  const mem = typeof metrics.memPercent === 'number'
    ? `${Math.round(metrics.memPercent as number)}%` : '--'
  const blocking = metrics.blockingActive === true ? 'BLOCKING' : 'DISABLED'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* PI-HOLE section */}
      <div style={{ fontSize: '8px', color: 'var(--cockpit-amber)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
        PI-HOLE
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: blocking === 'BLOCKING' ? 'var(--cockpit-green)' : 'var(--cockpit-red)' }}>{blocking}</span>
        <span style={{ color: 'var(--text-offwhite)' }}>QPM {qpm}</span>
        <span style={{ color: 'var(--text-offwhite)' }}>LOAD {load}</span>
        <span style={{ color: 'var(--text-offwhite)' }}>MEM {mem}</span>
      </div>

      {/* 1px amber divider */}
      <div style={{ height: '1px', background: 'rgba(232,160,32,0.2)', margin: '2px 0' }} />

      {/* UBIQUITI placeholder section (D-16) */}
      <div style={{ fontSize: '8px', color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
        UBIQUITI
      </div>
      <span style={{ fontSize: '9px', color: '#444', fontFamily: 'var(--font-mono)' }}>
        NOT CONFIGURED
      </span>
    </div>
  )
}

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr'])

function renderInstrumentBody(service: ServiceStatus): React.ReactNode {
  const metrics = service.metrics as Record<string, unknown> | undefined
  if (!metrics) return null

  if (service.id === 'nas-detail') {
    return <NasInstrument metrics={metrics} />
  }
  if (ARR_IDS.has(service.id)) {
    return <ArrInstrument service={service} metrics={metrics} />
  }
  if (service.id === 'plex') {
    return <PlexInstrument metrics={metrics} />
  }
  if (service.id === 'sabnzbd') {
    return <SabnzbdInstrument metrics={metrics} />
  }
  if (service.id === 'pihole') {
    return <NetworkInstrument metrics={metrics} />
  }
  return null
}

/** Reactive LED for SABnzbd card: amber when actively downloading or queue > 0, green when idle */
function SabnzbdLed({ service }: { service: ServiceStatus }) {
  if (service.status === 'offline') {
    return <StatusDot status="offline" />
  }
  if (service.status === 'warning') {
    return <StatusDot status="warning" />
  }
  if (service.status === 'stale') {
    return <StatusDot status="stale" />
  }
  // Online — check for active download activity
  const metrics = service.metrics as Record<string, unknown> | undefined
  const speedMBs = typeof metrics?.speedMBs === 'number' ? metrics.speedMBs : 0
  const queueCount = typeof metrics?.queueCount === 'number' ? metrics.queueCount : 0
  const isActive = speedMBs > 0 || queueCount > 0
  if (isActive) {
    return (
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--cockpit-purple)',
          boxShadow: '0 0 6px var(--cockpit-purple)',
          flexShrink: 0,
        }}
      />
    )
  }
  return <StatusDot status="online" />
}

interface ServiceCardProps {
  service: ServiceStatus
  index: number
}

export function ServiceCard({ service, index }: ServiceCardProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  // D-20: Plex and NAS do not render as grid cards
  if (service.id === 'plex' || service.id === 'nas') return null

  // D-15, D-16: unconfigured services deep-link to settings
  const isUnconfigured = service.configured === false

  const handleClick = () => {
    if (isUnconfigured) {
      navigate(`/settings?service=${service.id}`)
      return
    }
    // Save scroll position for restoration on back nav (UI-SPEC Scroll behavior)
    sessionStorage.setItem('dashboardScrollY', window.scrollY.toString())
    navigate(`/services/${service.id}`)
  }

  // Unconfigured cards show the NOT CONFIGURED label instead of service instruments
  const instrumentBody = isUnconfigured ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '60px',
      }}
    >
      <span
        className="text-label"
        style={{
          color: 'rgba(200, 200, 200, 0.3)',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        NOT CONFIGURED
      </span>
    </div>
  ) : renderInstrumentBody(service)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${service.name}, status: ${isUnconfigured ? 'not configured' : service.status}`}
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
        boxShadow: getCardGlow(isUnconfigured ? 'stale' : service.status),
      }}
    >
      {/* Banner header: 20px strip for pihole and sabnzbd (with LED inside), or 6px strip for all others */}
      {(service.id === 'pihole' || service.id === 'sabnzbd') ? (
        <div style={{
          height: '20px',
          background: 'var(--cockpit-amber)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '6px',
          paddingRight: '8px',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: '#1a1a1a',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}>
            {service.id === 'pihole' ? 'NETWORK' : 'DOWNLOADS'}
          </span>
          {/* LED dot inside banner strip */}
          {service.id === 'sabnzbd' && !isUnconfigured
            ? <SabnzbdLed service={service} />
            : <StatusDot status={isUnconfigured ? 'stale' : service.status} />
          }
        </div>
      ) : (
        <>
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
            <StatusDot status={isUnconfigured ? 'stale' : service.status} />
          </div>
        </>
      )}

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

      {/* Instrument body (service-specific or NOT CONFIGURED label) */}
      {instrumentBody && (
        <div style={{ padding: '8px 12px 12px 12px', flex: 1 }}>{instrumentBody}</div>
      )}
    </motion.div>
  )
}

/** Condensed LED + label row for media stack arr services (D-29, D-30).
 *  Renders a single tight row with a status LED and service label.
 *  Tappable — navigates to service detail view.
 */
export function MediaStackRow({ service, index }: ServiceCardProps) {
  const navigate = useNavigate()

  const metrics = service.metrics as Record<string, unknown> | undefined
  const isUnconfigured = service.configured === false
  const queue = typeof metrics?.queue === 'number' ? metrics.queue : 0
  const downloading = metrics?.downloading === true

  // D-11 LED color logic for arr services
  // Green: online, no download activity
  // Solid purple: actively downloading (file sent to SABnzbd, in progress)
  // Flashing purple: queued (in arr queue, not yet active)
  // Amber: warning
  // Red: offline
  // Grey: unconfigured / stale
  const getLedStyle = (): React.CSSProperties => {
    if (isUnconfigured || service.status === 'stale') {
      return { background: '#666666', boxShadow: 'none' }
    }
    if (service.status === 'offline') {
      return { background: 'var(--cockpit-red)', boxShadow: '0 0 6px var(--cockpit-red)' }
    }
    if (service.status === 'warning') {
      return { background: 'var(--cockpit-amber)', boxShadow: '0 0 6px rgba(232,160,32,0.6)' }
    }
    if (service.status === 'online') {
      if (downloading) {
        // D-11: Solid purple = actively downloading (file sent to SABnzbd, in progress)
        return { background: 'var(--cockpit-purple)', boxShadow: '0 0 6px var(--cockpit-purple)' }
      }
      if (queue > 0) {
        // D-11: Flashing purple = queued (in arr queue, not yet active in SABnzbd)
        return {
          background: 'var(--cockpit-purple)',
          boxShadow: '0 0 6px var(--cockpit-purple)',
          animation: 'ledFlashPurple 1.5s ease-in-out infinite',
        }
      }
      // D-11: GREEN = online, no download activity (was incorrectly purple)
      return { background: 'var(--cockpit-green, #4ADE80)', boxShadow: '0 0 6px rgba(74,222,128,0.6)' }
    }
    return { background: '#666666', boxShadow: 'none' }
  }

  const handleClick = () => {
    if (isUnconfigured) {
      navigate(`/settings?service=${service.id}`)
      return
    }
    sessionStorage.setItem('dashboardScrollY', window.scrollY.toString())
    navigate(`/services/${service.id}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay: index * 0.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${service.name}, status: ${isUnconfigured ? 'not configured' : service.status}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        cursor: 'pointer',
        borderRadius: '3px',
        border: '1px solid transparent',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(232,160,32,0.30)'
        ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(232,160,32,0.05)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {/* 8px LED dot */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          flexShrink: 0,
          ...getLedStyle(),
        }}
      />
      {/* Service label */}
      <span
        className="text-label"
        style={{
          color: isUnconfigured ? '#666' : 'var(--text-offwhite)',
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {service.name}
      </span>
    </motion.div>
  )
}
