import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { ServiceStatus, UnifiMetrics, ArrWebhookEvent, NasStatus, NasVolume } from '@coruscant/shared'
import { StatusDot } from '../ui/StatusDot.js'
import { StaleIndicator } from '../ui/StaleIndicator.js'

// Event flash colors for arr webhook events — used by MediaStackRow flash
const EVENT_COLORS: Record<string, string> = {
  grab: '#ffaa00',
  download_complete: '#c084fc',
  health_issue: '#ff4444',
  update_available: '#00ff88',
}

// ARR services that receive flash — SABnzbd excluded (uses burst poll instead)
const ARR_FLASH_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr'])

// NAS CPU/RAM bar threshold color (D-19): green <60%, amber 60-85%, red >85%
function getBarColor(percent: number): string {
  if (percent > 85) return '#FF3B3B'   // red
  if (percent > 60) return '#E8A020'   // amber
  return '#4ADE80'                      // green
}

// UniFi multi-arrow speed tier indicator (D-20)
function getArrowTier(mbps: number | null, direction: 'rx' | 'tx'): string {
  if (mbps === null || mbps < 0.1) return ''
  const arrow = direction === 'rx' ? '↓' : '↑'
  if (mbps < 10) return arrow
  if (mbps < 100) return arrow.repeat(2)
  return arrow.repeat(3)
}

// Card outline glow per non-healthy status (D-13)
function getCardGlow(status: ServiceStatus['status']): string {
  const base = 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)'
  if (status === 'warning') return `${base}, 0 0 12px rgba(232,160,32,0.3)`
  if (status === 'offline') return `${base}, 0 0 12px rgba(255,59,59,0.3)`
  return base
}

// NAS gauge bar instrument — used for nas-detail service (legacy detail view)
function NasInstrument({ metrics }: { metrics: Record<string, unknown> }) {
  const cpu = typeof metrics.cpu === 'number' ? metrics.cpu : 0
  const ram = typeof metrics.ram === 'number' ? metrics.ram : 0
  const disk = typeof metrics.diskPercent === 'number' ? metrics.diskPercent : 0
  const temp = typeof metrics.tempC === 'number' ? metrics.tempC : 0

  const gauges = [
    { label: 'CPU', value: Math.round(cpu), unit: '%', percent: cpu, isThreshold: true },
    { label: 'RAM', value: Math.round(ram), unit: '%', percent: ram, isThreshold: true },
    { label: 'DISK', value: Math.round(disk), unit: '%', percent: disk, isThreshold: false },
    { label: 'TEMP', value: Math.round(temp), unit: '°C', percent: (temp / 80) * 100, isThreshold: false },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {gauges.map(({ label, value, unit, percent, isThreshold }) => {
        const barColor = isThreshold ? getBarColor(percent) : 'var(--cockpit-amber)'
        return (
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
                className="text-label text-glow"
                style={{ color: barColor, fontSize: '9px' }}
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
                  background: barColor,
                  borderRadius: '2px',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Vertical column bar gauge — used in NAS full-width tile.
 * fillPct: 0–100, fills from bottom up.
 * barWidth and barHeight are optional; defaults are '8px' and '60px'.
 */
function NasGaugeColumn({
  label,
  fillPct,
  valueText,
  color = 'var(--cockpit-amber)',
  barWidth = '8px',
  barHeight = '60px',
}: {
  label: string
  fillPct: number
  valueText: string
  color?: string
  barWidth?: string
  barHeight?: string
}) {
  const clampedFill = Math.max(0, Math.min(100, fillPct))
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          textTransform: 'uppercase',
          color: 'rgba(232,160,32,0.6)',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '36px',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
      <div
        style={{
          width: barWidth,
          height: barHeight,
          background: 'rgba(232,160,32,0.15)',
          borderRadius: '2px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${clampedFill}%`,
            background: color,
            borderRadius: '2px',
            transition: 'height 0.6s ease',
            boxShadow: `0 0 4px ${color}`,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color,
          textShadow: `0 0 6px ${color}`,
        }}
      >
        {valueText}
      </span>
    </div>
  )
}

// NAS standalone tile instrument (D-21) — 3-column layout: disk LEDs | CPU/RAM/volume bars | Docker stats
function NasTileInstrument({ nasStatus }: { nasStatus: NasStatus }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '0 8px', alignItems: 'stretch' }}>

      {/* LEFT col — disk temp LED indicators: 4-per-row grid, last row centered */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {nasStatus.disks && (() => {
            const rows: typeof nasStatus.disks[] = []
            for (let i = 0; i < nasStatus.disks.length; i += 4) rows.push(nasStatus.disks.slice(i, i + 4))
            return rows.map((row, rowIdx) => (
              <div key={rowIdx} style={{
                display: 'flex',
                justifyContent: row.length < 4 ? 'center' : 'flex-start',
                gap: '8px',
                marginBottom: rowIdx < rows.length - 1 ? '8px' : 0,
              }}>
                {row.map((disk, colIdx) => {
                  const idx = rowIdx * 4 + colIdx
                  const tempC = disk.tempC
                  const dotColor = tempC > 55 ? '#FF3B3B' : tempC >= 45 ? '#E8A020' : '#4ADE80'
                  const tempF = Math.round(tempC * 9 / 5 + 32)
                  return (
                    <div key={disk.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{
                        width: '14px', height: '14px', borderRadius: '50%',
                        background: dotColor, boxShadow: `0 0 6px ${dotColor}`,
                      }} />
                      <span style={{ fontSize: '10px', color: dotColor, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                        {tempF}°
                      </span>
                      <span style={{ fontSize: '8px', color: 'rgba(200,200,200,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>
                        D{idx + 1}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>
      </div>

      {/* CENTER col — horizontal bars for CPU, RAM, HD volumes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center', height: '100%' }}>
        {[
          { label: 'CPU', value: nasStatus.cpu, valueText: `${Math.round(nasStatus.cpu)}%` },
          { label: 'RAM', value: nasStatus.ram, valueText: `${Math.round(nasStatus.ram)}%` },
          ...nasStatus.volumes.map((vol: NasVolume) => ({
            label: vol.name === '/volume1' ? 'HD' : vol.name.replace(/^\/volume/, 'V').slice(0, 4),
            value: vol.usedPercent,
            valueText: `${Math.round(vol.usedPercent)}%`,
          })),
        ].map(({ label, value, valueText }) => {
          const color = getBarColor(value)
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'rgba(232,160,32,0.6)', width: '26px', flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: '14px', background: `rgba(232,160,32,0.15)`, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(Math.max(value, 0), 100)}%`,
                  background: color,
                  borderRadius: '3px',
                  transition: 'width 0.6s ease',
                  boxShadow: `0 0 6px ${color}`,
                }} />
              </div>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color, textShadow: `0 0 6px ${color}`, width: '32px', textAlign: 'right', flexShrink: 0 }}>{valueText}</span>
            </div>
          )
        })}
      </div>

      {/* RIGHT col — Docker stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center', height: '100%' }}>
        {nasStatus.docker ? (
          <>
            <div style={{ fontSize: '11px', color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Docker</div>
            <span className="text-glow" style={{ fontSize: '22px', lineHeight: 1.2, color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)', textShadow: '0 0 6px var(--cockpit-amber)' }}>
              CPU {nasStatus.docker.cpuPercent.toFixed(1)}%
            </span>
            <span className="text-glow" style={{ fontSize: '22px', lineHeight: 1.2, color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)', textShadow: '0 0 6px var(--cockpit-amber)' }}>
              RAM {nasStatus.docker.ramPercent.toFixed(1)}%
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
              {nasStatus.imageUpdateAvailable === true ? (
                <>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E8A020', boxShadow: '0 0 4px #E8A020', flexShrink: 0 }} />
                  <span style={{ fontSize: '10px', color: '#E8A020', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Update Available</span>
                </>
              ) : (
                <>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#444', flexShrink: 0 }} />
                  <span style={{ fontSize: '10px', color: '#444', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>No Update Available</span>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

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
          className="text-label text-glow"
          style={{ color: 'var(--text-offwhite)', fontSize: '22px', fontWeight: 600, lineHeight: 1.1, textTransform: 'uppercase', textShadow: '0 0 8px rgba(200,200,200,0.4)' }}
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
        /* Active download: show clean title */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            className="text-label"
            style={{
              color: 'var(--cockpit-purple)',
              fontSize: '22px',
              fontWeight: 600,
              lineHeight: 1.1,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              textShadow: '0 0 8px var(--cockpit-purple)',
            }}
          >
            {typeof metrics.activeTitle === 'string' && metrics.activeTitle
              ? metrics.activeTitle
              : `x${activeDownloads}`}
          </span>
          {downloadQuality && (
            <span className="text-label" style={{ color: 'rgba(139,92,246,0.6)', fontSize: '8px', textTransform: 'uppercase' }}>
              {downloadQuality}
            </span>
          )}
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
  // Plex server stats — CPU green, RAM blue, bandwidth white (D-22)
  const cpuPct = typeof metrics.processCpuPercent === 'number' ? metrics.processCpuPercent.toFixed(1) : null
  const ramPct = typeof metrics.processRamPercent === 'number' ? metrics.processRamPercent.toFixed(1) : null
  const bwMbps = typeof metrics.bandwidthMbps === 'number' ? metrics.bandwidthMbps.toFixed(1) : null

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
        className="text-label text-glow"
        style={{ color: '#C8C8C8', fontSize: '9px' }}
      >
        {activeStreams} ACTIVE
      </div>
      {/* Plex server stats — D-22 */}
      {(cpuPct !== null || ramPct !== null || bwMbps !== null) && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
          {cpuPct !== null && (
            <span className="text-label text-glow" style={{ color: '#4ADE80', fontSize: '9px' }}>
              CPU {cpuPct}%
            </span>
          )}
          {ramPct !== null && (
            <span className="text-label text-glow" style={{ color: '#00c8ff', fontSize: '9px' }}>
              RAM {ramPct}%
            </span>
          )}
          {bwMbps !== null && (
            <span className="text-label text-glow" style={{ color: '#C8C8C8', fontSize: '9px' }}>
              {bwMbps}M
            </span>
          )}
        </div>
      )}
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
        <span style={{ fontSize: '20px', color: 'var(--cockpit-amber)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          {speed} <span style={{ fontSize: '11px', fontWeight: 400 }}>MB/s</span>
        </span>
        {eta && (
          <span style={{ fontSize: '9px', color: 'var(--text-offwhite)' }}>
            ETA {eta}
          </span>
        )}
      </div>
      {/* Progress bar — only when actively downloading */}
      {hasActivity && (
        <div style={{
          margin: '4px 0 2px',
          height: '16px',
          background: 'rgba(232,160,32,0.15)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${typeof metrics.progressPercent === 'number' ? metrics.progressPercent : 0}%`,
            background: 'var(--cockpit-amber)',
            borderRadius: '2px',
            transition: 'width 1s ease',
            boxShadow: '0 0 6px var(--cockpit-amber)',
          }} />
        </div>
      )}
    </div>
  )
}

// Throughput bar for TX/RX display in NETWORK card UBIQUITI section (D-02, D-03)
// Shows bar only — no trailing number, bar height 16px for visual prominence
function ThroughputBar({ label, value, peak, color }: { label: string; value: number | null; peak: number; color: string }) {
  const effectivePeak = peak > 0 ? peak : 100  // fallback to 100 Mbps until peaks are established
  const pct = value !== null ? Math.min((value / effectivePeak) * 100, 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
      <span style={{ fontSize: '8px', color: 'var(--text-offwhite)', fontFamily: 'var(--font-mono)', width: '14px' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '16px', background: '#222', borderRadius: '3px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s ease', boxShadow: `0 0 6px ${color}` }} />
      </div>
    </div>
  )
}

// NETWORK card: Pi-hole section + Ubiquiti section (D-15, D-16)
function NetworkInstrument({ metrics, unifiService }: { metrics: Record<string, unknown>; unifiService?: ServiceStatus }) {
  const qpm = typeof metrics.queriesPerMinute === 'number'
    ? metrics.queriesPerMinute.toFixed(1) : '--'
  const load = typeof metrics.load1m === 'number'
    ? metrics.load1m.toFixed(2) : '--'
  const mem = typeof metrics.memPercent === 'number'
    ? `${Math.round(metrics.memPercent as number)}%` : '--'
  const blocking = metrics.blockingActive === true ? 'BLOCKING' : 'DISABLED'

  const unifiConfigured = unifiService?.configured !== false && unifiService?.metrics != null
  const um = unifiService?.metrics as unknown as UnifiMetrics | undefined
  const healthToLed = um?.healthStatus === 'online' ? 'online' as const
    : um?.healthStatus === 'warning' ? 'warning' as const
    : 'offline' as const
  const healthLabel = um?.healthStatus === 'online' ? 'ONLINE'
    : um?.healthStatus === 'warning' ? 'DEGRADED'
    : 'OFFLINE'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
      {/* LEFT — Pi-hole */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ fontSize: '9px', color: 'var(--cockpit-amber)', letterSpacing: '0.08em',
          textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>PI-HOLE</div>
        <span className="text-glow" style={{
          fontSize: '22px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.1,
          color: blocking === 'BLOCKING' ? 'var(--cockpit-green)' : 'var(--cockpit-red)',
          textShadow: `0 0 8px ${blocking === 'BLOCKING' ? 'var(--cockpit-green)' : 'var(--cockpit-red)'}`,
        }}>
          {blocking}
        </span>
        <div style={{ fontSize: '8px', color: 'rgba(200,200,200,0.4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>BLOCKING</div>
        <span className="text-glow" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)', lineHeight: 1.1, textShadow: '0 0 8px var(--cockpit-amber)' }}>
          {qpm}
        </span>
        <div style={{ fontSize: '8px', color: 'rgba(200,200,200,0.4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>QPM</div>
        {typeof metrics.percentBlocked === 'number' && (
          <>
            <span className="text-glow" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)', lineHeight: 1.1, textShadow: '0 0 8px var(--cockpit-amber)' }}>
              {(metrics.percentBlocked as number).toFixed(1)}%
            </span>
            <div style={{ fontSize: '8px', color: 'rgba(200,200,200,0.4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>BLOCKED</div>
          </>
        )}
      </div>
      {/* RIGHT — Ubiquiti */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ fontSize: '9px', color: unifiConfigured ? 'var(--cockpit-amber)' : '#555',
          letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          UBIQUITI
        </div>
        {!unifiConfigured ? (
          <span style={{ fontSize: '9px', color: '#444', fontFamily: 'var(--font-mono)' }}>
            NOT CONFIGURED
          </span>
        ) : (
          <>
            {/* Row 1: Health LED + status label — styled like Pi-hole BLOCKING */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <StatusDot status={healthToLed} />
              <span className="text-glow" style={{
                fontSize: '22px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.1,
                color: healthToLed === 'online' ? 'var(--cockpit-green)' : healthToLed === 'warning' ? 'var(--cockpit-amber)' : 'var(--cockpit-red)',
                textShadow: `0 0 8px ${healthToLed === 'online' ? 'var(--cockpit-green)' : healthToLed === 'warning' ? 'var(--cockpit-amber)' : 'var(--cockpit-red)'}`,
              }}>
                {healthLabel}
              </span>
            </div>
            {/* Vertical bars: UP / DOWN / CLIENTS filling space under ONLINE */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'flex-end', flex: 1, paddingTop: '8px' }}>
              {[
                { label: 'UP', value: um!.wanTxMbps, peak: um!.peakTxMbps, color: '#FF3B3B' },
                { label: 'DOWN', value: um!.wanRxMbps, peak: um!.peakRxMbps, color: '#00c8ff' },
                { label: 'CLIENTS', value: um!.clientCount, peak: um!.peakClients && um!.peakClients > 0 ? um!.peakClients : (um!.clientCount > 0 ? um!.clientCount : 1), color: '#4ADE80' },
              ].map(({ label, value, peak, color }) => {
                const effectivePeak = peak > 0 ? peak : 1
                const fillPct = value !== null && value !== undefined ? Math.min((value / effectivePeak) * 100, 100) : 0
                return (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <div style={{ width: '16px', height: '60px', background: '#222', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${fillPct}%`,
                        background: color,
                        borderRadius: '3px',
                        transition: 'height 0.3s ease',
                        boxShadow: `0 0 6px ${color}`,
                      }} />
                    </div>
                    <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'rgba(200,200,200,0.5)', letterSpacing: '0.04em', textAlign: 'center' }}>{label}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr'])

function renderInstrumentBody(service: ServiceStatus, allServices?: ServiceStatus[]): React.ReactNode {
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
    const unifiService = allServices?.find((s) => s.id === 'unifi')
    return <NetworkInstrument metrics={metrics} unifiService={unifiService} />
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
  allServices?: ServiceStatus[]
  lastArrEvent?: ArrWebhookEvent | null
  nasStatus?: NasStatus | null
}

export function ServiceCard({ service, index, allServices, nasStatus }: ServiceCardProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  // D-20: Plex does not render as a grid card (in NowPlayingBanner)
  if (service.id === 'plex') return null

  // SABnzbd is absorbed into the Media tile — no standalone card
  if (service.id === 'sabnzbd') return null

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

  // NAS standalone tile — amber ribbon header, full NAS metrics (D-21)
  if (service.id === 'nas') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.05 }}
        className="chamfer-card"
        style={{
          position: 'relative',
          background: 'var(--bg-panel)',
          border: `1px solid ${hovered ? 'rgba(232,160,32,0.60)' : 'var(--border-rest)'}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 20px amber ribbon header — same pattern as MEDIA tile */}
        <div style={{ height: '20px', background: 'var(--cockpit-amber)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '6px', paddingRight: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#1a1a1a', letterSpacing: '0.08em', fontWeight: 600 }}>NAS</span>
          <StatusDot status={isUnconfigured ? 'stale' : service.status} />
        </div>
        <div style={{ padding: '6px 10px 8px 10px', flex: 1 }}>
          {isUnconfigured || !nasStatus ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60px' }}>
              <span className="text-label" style={{ color: 'rgba(200,200,200,0.3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {isUnconfigured ? 'NOT CONFIGURED' : 'LOADING...'}
              </span>
            </div>
          ) : (
            <NasTileInstrument nasStatus={nasStatus} />
          )}
        </div>
      </motion.div>
    )
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
  ) : renderInstrumentBody(service, allServices)

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
        minHeight: service.id === 'pihole' ? undefined : '160px',
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
      {/* Banner header: 20px strip for pihole (with LED inside), or 6px strip for all others */}
      {service.id === 'pihole' ? (
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
            NETWORK
          </span>
          <StatusDot status={isUnconfigured ? 'stale' : service.status} />
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
export function MediaStackRow({ service, index, lastArrEvent }: ServiceCardProps) {
  const navigate = useNavigate()

  const metrics = service.metrics as Record<string, unknown> | undefined
  const isUnconfigured = service.configured === false
  const queue = typeof metrics?.queue === 'number' ? metrics.queue : 0
  const downloading = metrics?.downloading === true

  // Flash state — triggered by arr webhook events for this service
  const [flashColor, setFlashColor] = useState<string | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!lastArrEvent || lastArrEvent.service !== service.id) return
    if (lastArrEvent.eventCategory === 'unknown') return
    if (!ARR_FLASH_IDS.has(service.id)) return
    const color = EVENT_COLORS[lastArrEvent.eventCategory]
    if (!color) return
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlashColor(color)
    flashTimerRef.current = setTimeout(() => setFlashColor(null), 10_000)
  }, [lastArrEvent, service.id])

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
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        cursor: 'pointer',
        borderRadius: '3px',
        border: flashColor ? `1px solid ${flashColor}` : '1px solid transparent',
        boxShadow: flashColor ? `0 0 8px 2px ${flashColor}66` : 'none',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!flashColor) {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(232,160,32,0.30)'
          ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(232,160,32,0.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!flashColor) {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
          ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
        }
      }}
    >
      {/* Flash glow overlay — fades out using arrFlash keyframe (opacity only, DASH-08) */}
      {flashColor && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `${flashColor}1a`,
            animation: 'arrFlash 10s linear forwards',
            pointerEvents: 'none',
          }}
        />
      )}
      {/* 10px LED dot */}
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          flexShrink: 0,
          ...getLedStyle(),
        }}
      />
      {/* Service label */}
      <span
        className="text-label text-glow"
        style={{
          color: isUnconfigured ? '#666' : 'var(--text-offwhite)',
          fontSize: '22px',
          fontWeight: 600,
          lineHeight: 1.1,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          textShadow: isUnconfigured ? 'none' : '0 0 8px rgba(200,200,200,0.4)',
        }}
      >
        {service.name}
      </span>
    </motion.div>
  )
}
