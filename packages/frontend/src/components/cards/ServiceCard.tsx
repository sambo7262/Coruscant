import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { ServiceStatus, UnifiMetrics, ArrWebhookEvent, NasStatus, NasVolume } from '@coruscant/shared'
import { StatusDot } from '../ui/StatusDot.js'
import { StaleIndicator } from '../ui/StaleIndicator.js'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js'
import { canHover, useViewport } from '../../viewport/index.js'
import { DockerUpdatePanel } from '../layout/DockerUpdatePanel.js'

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
    <div className="nas-instrument">
      {gauges.map(({ label, value, unit, percent, isThreshold }) => {
        const barColor = isThreshold ? getBarColor(percent) : 'var(--cockpit-amber)'
        return (
          <div key={label}>
            <div className="nas-instrument__row">
              <span className="text-label nas-instrument__label">
                {label}
              </span>
              <span className="text-label text-glow nas-instrument__value" style={{ color: barColor }}>
                {value}{unit}
              </span>
            </div>
            <div className="nas-instrument__track">
              <div
                className="nas-instrument__fill"
                style={{
                  width: `${Math.min(Math.max(percent, 0), 100)}%`,
                  background: barColor,
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
    <div className="nas-gauge-col">
      <span className="nas-gauge-col__label">
        {label}
      </span>
      <div
        className="nas-gauge-col__track"
        style={{ width: barWidth, height: barHeight }}
      >
        <div
          className="nas-gauge-col__fill"
          style={{
            height: `${clampedFill}%`,
            background: color,
            boxShadow: `0 0 4px ${color}`,
          }}
        />
      </div>
      <span className="nas-gauge-col__value" style={{ color }}>
        {valueText}
      </span>
    </div>
  )
}

// NAS standalone tile instrument (D-21) — 3-column layout: disk LEDs | CPU/RAM/volume bars | Docker stats
function NasTileInstrument({ nasStatus }: { nasStatus: NasStatus }) {
  const animCpu = useAnimatedNumber(nasStatus.cpu)
  const animRam = useAnimatedNumber(nasStatus.ram)
  const animDockerCpu = useAnimatedNumber(nasStatus.docker?.cpuPercent ?? 0)
  const animDockerRam = useAnimatedNumber(nasStatus.docker?.ramPercent ?? 0)
  const [dockerPanelOpen, setDockerPanelOpen] = useState(false)

  return (
    <div className="nas-tile">

      {/* LEFT col — disk temp LED indicators: 4-per-row grid, last row centered */}
      <div className="nas-tile__col-left">
        {/* DISKS section label */}
        <div className="nas-tile__section-label">DISKS</div>
        <div className="nas-tile__disks">
          {nasStatus.disks && (() => {
            const rows: typeof nasStatus.disks[] = []
            for (let i = 0; i < nasStatus.disks.length; i += 4) rows.push(nasStatus.disks.slice(i, i + 4))
            return rows.map((row, rowIdx) => {
              const rowKey = row.map(d => d.id).join('-')
              return (
              <div
                key={rowKey}
                className="nas-tile__disk-row"
                style={{
                  justifyContent: row.length < 4 ? 'center' : 'flex-start',
                  marginBottom: rowIdx < rows.length - 1 ? '8px' : 0,
                }}
              >
                {row.map((disk, colIdx) => {
                  const idx = rowIdx * 4 + colIdx
                  const tempC = disk.tempC
                  const dotColor = tempC > 55 ? '#FF3B3B' : tempC >= 45 ? '#E8A020' : '#4ADE80'
                  const tempF = Math.round(tempC * 9 / 5 + 32)
                  return (
                    <div key={disk.id} className="nas-tile__disk">
                      <div
                        className="nas-tile__disk-led"
                        style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
                      />
                      <span className="nas-tile__disk-temp" style={{ color: dotColor }}>
                        {tempF}°
                      </span>
                      <span className="nas-tile__disk-label">
                        D{idx + 1}
                      </span>
                    </div>
                  )
                })}
              </div>
              )
            })
          })()}
        </div>
      </div>

      {/* CENTER col — horizontal bars for CPU, RAM, HD volumes */}
      <div className="nas-tile__col-center">
        {/* NAS device name label */}
        <div className="nas-tile__section-label nas-tile__name">{nasStatus.name || 'TheRock'}</div>
        {[
          { label: 'CPU', value: nasStatus.cpu, valueText: `${animCpu}%` },
          { label: 'RAM', value: nasStatus.ram, valueText: `${animRam}%` },
          ...nasStatus.volumes.map((vol: NasVolume, idx: number) => ({
            label: idx === 0 ? 'HD' : `HD${idx + 1}`,
            value: vol.usedPercent,
            valueText: `${Math.round(vol.usedPercent)}%`,
          })),
        ].map(({ label, value, valueText }) => {
          const color = getBarColor(value)
          return (
            <div key={label} className="nas-tile__metric-row">
              <span className="nas-tile__metric-label">{label}</span>
              <div className="nas-tile__metric-track">
                <div
                  className="nas-tile__metric-fill"
                  style={{
                    width: `${Math.min(Math.max(value, 0), 100)}%`,
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
              </div>
              <span className="nas-tile__metric-value" style={{ color }}>{valueText}</span>
            </div>
          )
        })}
      </div>

      {/* RIGHT col — Docker stats */}
      <div className="nas-tile__col-right">
        {nasStatus.docker ? (
          <>
            <div className="nas-tile__section-label nas-tile__docker-label">DOCKER</div>
            <span className="text-glow nas-tile__docker-stat">
              CPU {animDockerCpu}%
            </span>
            <span className="text-glow nas-tile__docker-stat">
              RAM {animDockerRam}%
            </span>
            <button
              className="nas-tile__docker-update-btn"
              onClick={() => setDockerPanelOpen(prev => !prev)}
              aria-expanded={dockerPanelOpen}
              aria-label={dockerPanelOpen ? 'Collapse Docker update details' : 'Expand Docker update details'}
            >
              <div className="nas-tile__docker-update">
                {nasStatus.imageUpdateAvailable === true ? (
                  <>
                    <div className="nas-tile__docker-dot nas-tile__docker-dot--on" />
                    <span className="nas-tile__docker-update-label nas-tile__docker-update-label--on">Update Available</span>
                  </>
                ) : (
                  <>
                    <div className="nas-tile__docker-dot nas-tile__docker-dot--off" />
                    <span className="nas-tile__docker-update-label nas-tile__docker-update-label--off">No Update Available</span>
                  </>
                )}
              </div>
            </button>
          </>
        ) : null}
      </div>

      <AnimatePresence>
        {dockerPanelOpen && (
          <DockerUpdatePanel
            images={nasStatus.imageUpdateDetails ?? []}
            checkedAt={nasStatus.imageUpdateCheckedAt}
            hasUpdates={nasStatus.imageUpdateAvailable ?? false}
          />
        )}
      </AnimatePresence>
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
    <div className="arr-instrument">
      {/* Row 1: large status LED + status text */}
      <div className="arr-instrument__status-row">
        <div
          className="arr-instrument__led"
          style={{ background: ledColor, boxShadow: `0 0 6px ${ledColor}` }}
        />
        <span className="text-label text-glow arr-instrument__status-text">
          {statusText}
        </span>
      </div>

      {/* Row 2: download indicator or subtitle grab indicator */}
      {isBazarr ? (
        /* Bazarr: subtitle grab indicator */
        <div className="arr-instrument__sub-row">
          <span
            className="text-label arr-instrument__sub-text"
            style={{ color: activeSubtitleGrabs > 0 ? 'var(--cockpit-amber)' : '#444' }}
          >
            {activeSubtitleGrabs > 0
              ? `SUBTITLES  x${activeSubtitleGrabs}`
              : 'IDLE'}
          </span>
        </div>
      ) : downloading && activeDownloads > 0 ? (
        /* Active download: show clean title */
        <div className="arr-instrument__dl">
          <span className="text-label arr-instrument__dl-title">
            {typeof metrics.activeTitle === 'string' && metrics.activeTitle
              ? metrics.activeTitle
              : `x${activeDownloads}`}
          </span>
          {downloadQuality && (
            <span className="text-label arr-instrument__dl-quality">
              {downloadQuality}
            </span>
          )}
        </div>
      ) : (
        /* Idle */
        <span className="text-label arr-instrument__idle">
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
      <div className="plex-instrument__bars">
        {barHeights.map((h, i) => (
          <div
            key={i}
            className="plex-instrument__bar"
            style={{
              height: `${h}px`,
              background:
                i < Math.min(activeStreams, maxStreams)
                  ? 'var(--cockpit-green)'
                  : 'rgba(232,160,32,0.15)',
            }}
          />
        ))}
      </div>
      <div className="text-label text-glow plex-instrument__active">
        {activeStreams} ACTIVE
      </div>
      {/* Plex server stats — D-22 */}
      {(cpuPct !== null || ramPct !== null || bwMbps !== null) && (
        <div className="plex-instrument__stats">
          {cpuPct !== null && (
            <span className="text-label text-glow plex-instrument__stat plex-instrument__stat--cpu">
              CPU {cpuPct}%
            </span>
          )}
          {ramPct !== null && (
            <span className="text-label text-glow plex-instrument__stat plex-instrument__stat--ram">
              RAM {ramPct}%
            </span>
          )}
          {bwMbps !== null && (
            <span className="text-label text-glow plex-instrument__stat plex-instrument__stat--bw">
              {bwMbps}M
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Helper: parse "H:MM:SS" or "MM:SS" timeLeft string to total seconds (DL-02)
function parseTimeleftToSeconds(timeleft: string): number {
  if (!timeleft) return 0
  const parts = timeleft.split(':').map(Number)
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
  return 0
}

// Helper: format total seconds back to "H:MM:SS" string (DL-02)
function formatSecondsToTimeleft(secs: number): string {
  const s = Math.max(0, secs)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// SABnzbd natural display: filename, speed, ETA (D-04)
// Text is always amber — only the StatusDot LED handles purple states (D-05)
function SabnzbdInstrument({ metrics }: { metrics: Record<string, unknown> }) {
  const speed = typeof metrics.speedMBs === 'number' ? metrics.speedMBs.toFixed(1) : '--'
  const filename = typeof metrics.currentFilename === 'string' && metrics.currentFilename
    ? metrics.currentFilename : ''
  const queueCount = typeof metrics.queueCount === 'number' ? metrics.queueCount : 0
  const speedMBs = typeof metrics.speedMBs === 'number' ? metrics.speedMBs : 0
  const hasActivity = queueCount > 0 || speedMBs > 0

  // DL-01: Slot tracking — show amber pulse until real progress change is confirmed
  const slotId = typeof metrics.slotId === 'string' ? metrics.slotId : null
  const progressPercent = typeof metrics.progressPercent === 'number' ? metrics.progressPercent : 0

  const [slotStates, setSlotStates] = useState<Map<string, 'pending' | 'active'>>(new Map())
  const prevProgressRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!slotId) return
    setSlotStates(prev => {
      // Only retain the current slot — evict all previous entries to prevent unbounded Map growth
      const next = new Map<string, 'pending' | 'active'>()
      const prevProgress = prevProgressRef.current.get(slotId)
      const prevState = prev.get(slotId)
      if (!prevState) {
        next.set(slotId, 'pending')
      } else if (prevState === 'pending' && prevProgress !== undefined && prevProgress !== progressPercent) {
        next.set(slotId, 'active')
      } else {
        next.set(slotId, prevState)
      }
      // Evict stale progress refs too
      prevProgressRef.current = new Map([[slotId, progressPercent]])
      return next
    })
  }, [slotId, progressPercent])

  const isPending = slotId ? slotStates.get(slotId) !== 'active' : false

  // DL-02: ETA countdown — count down every second, resync to server value on each SSE update
  const serverTimeLeft = typeof metrics.timeLeft === 'string' ? metrics.timeLeft : ''
  const [displaySeconds, setDisplaySeconds] = useState<number>(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const secs = parseTimeleftToSeconds(serverTimeLeft)
    setDisplaySeconds(secs)
    // Always clear the previous interval first and null the ref
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    if (secs > 0) {
      countdownRef.current = setInterval(() => {
        setDisplaySeconds(prev => Math.max(0, prev - 1))
      }, 1000)
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [serverTimeLeft])

  const displayEta = displaySeconds > 0 ? formatSecondsToTimeleft(displaySeconds) : serverTimeLeft

  if (!hasActivity && !filename) {
    return (
      <span className="text-label sab-instrument__idle">
        IDLE
      </span>
    )
  }

  return (
    <div className="sab-instrument">
      {/* Filename — truncated, always amber (D-04) */}
      {filename && (
        <div className="sab-instrument__filename">
          {filename}
        </div>
      )}
      {/* Speed + ETA row — text always amber (D-05) */}
      <div className="sab-instrument__speed-row">
        <span className="sab-instrument__speed">
          {speed} <span className="sab-instrument__speed-unit">MB/s</span>
        </span>
        {displayEta && (
          <span className="sab-instrument__eta">
            ETA {displayEta}
          </span>
        )}
      </div>
      {/* Progress bar — pulse when pending (DL-01), real fill when active */}
      {hasActivity && (
        <div className={`sab-instrument__track${isPending ? ' sab-instrument__track--pending' : ''}`}>
          {!isPending && (
            <div
              className="sab-instrument__fill"
              style={{ width: `${progressPercent}%` }}
            />
          )}
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
    <div className="throughput-bar">
      <span className="throughput-bar__label">
        {label}
      </span>
      <div className="throughput-bar__track">
        <div
          className="throughput-bar__fill"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  )
}

// NETWORK card: Pi-hole section + Ubiquiti section (D-15, D-16)
function NetworkInstrument({ metrics, unifiService }: { metrics: Record<string, unknown>; unifiService?: ServiceStatus }) {
  const viewport = useViewport()
  const isLandscape = viewport === 'iphone-landscape'

  const rawQps = typeof metrics.queriesPerSecond === 'number' ? metrics.queriesPerSecond : 0
  const rawPercentBlocked = typeof metrics.percentBlocked === 'number' ? metrics.percentBlocked : 0
  const rawMem = typeof metrics.memPercent === 'number' ? metrics.memPercent : 0

  const animQps = useAnimatedNumber(Math.round(rawQps * 10))
  const animPercentBlocked = useAnimatedNumber(rawPercentBlocked * 10) // multiply by 10 for sub-integer resolution
  const animMem = useAnimatedNumber(rawMem)

  const um = unifiService?.metrics as unknown as UnifiMetrics | undefined
  const rawClientCount = typeof um?.clientCount === 'number' ? um.clientCount : 0
  const animClientCount = useAnimatedNumber(rawClientCount)
  const rawWanTx = typeof um?.wanTxMbps === 'number' ? um.wanTxMbps * 10 : 0
  const rawWanRx = typeof um?.wanRxMbps === 'number' ? um.wanRxMbps * 10 : 0
  const animWanTx = useAnimatedNumber(rawWanTx)
  const animWanRx = useAnimatedNumber(rawWanRx)

  const hasQpsData = typeof metrics.queriesPerSecond === 'number'
  const hasPercentData = typeof metrics.percentBlocked === 'number'
  const hasMemData = typeof metrics.memPercent === 'number'

  const qpsDisplay = hasQpsData ? (animQps / 10).toFixed(1) : '--'
  const percentBlockedDisplay = hasPercentData ? (animPercentBlocked / 10).toFixed(1) : '--'
  const memDisplay = hasMemData ? `${animMem}%` : '--'

  const blocking = metrics.blockingActive === true ? 'BLOCKING' : 'DISABLED'

  const unifiConfigured = unifiService?.configured !== false && unifiService?.metrics != null
  const healthToLed = um?.healthStatus === 'online' ? 'online' as const
    : um?.healthStatus === 'warning' ? 'warning' as const
    : 'offline' as const
  const healthLabel = um?.healthStatus === 'online' ? 'ONLINE'
    : um?.healthStatus === 'warning' ? 'DEGRADED'
    : 'OFFLINE'

  return (
    <div className="net-instrument">
      {/* LEFT — Pi-hole */}
      <div className="net-instrument__col">
        <div className="net-instrument__section-label">PI-HOLE</div>
        <span
          className="text-glow net-instrument__stat"
          style={{ color: blocking === 'BLOCKING' ? 'var(--cockpit-green)' : 'var(--cockpit-red)' }}
        >
          {blocking}
        </span>
        <div className="net-instrument__sub-label">BLOCKING</div>
        {isLandscape ? (
          <div className="net-instrument__pihole-row">
            <div className="net-instrument__pihole-metric">
              <span className="text-glow net-instrument__stat net-instrument__stat--amber">
                {qpsDisplay}
              </span>
              <div className="net-instrument__sub-label">QPS</div>
            </div>
            {hasPercentData && (
              <div className="net-instrument__pihole-metric">
                <span className="text-glow net-instrument__stat net-instrument__stat--amber">
                  {percentBlockedDisplay}%
                </span>
                <div className="net-instrument__sub-label">BLOCKED</div>
              </div>
            )}
          </div>
        ) : (
          <>
            <span className="text-glow net-instrument__stat net-instrument__stat--amber">
              {qpsDisplay}
            </span>
            <div className="net-instrument__sub-label">QPS</div>
            {hasPercentData && (
              <>
                <span className="text-glow net-instrument__stat net-instrument__stat--amber">
                  {percentBlockedDisplay}%
                </span>
                <div className="net-instrument__sub-label">BLOCKED</div>
              </>
            )}
          </>
        )}
        {!isLandscape && (
          <>
            <span className="text-glow net-instrument__stat net-instrument__stat--amber">
              {memDisplay}
            </span>
            <div className="net-instrument__sub-label">MEM</div>
          </>
        )}
      </div>
      {/* RIGHT — Ubiquiti */}
      <div className="net-instrument__col">
        <div
          className="net-instrument__section-label net-instrument__section-label--center"
          style={{ color: unifiConfigured ? 'var(--cockpit-amber)' : '#555' }}
        >
          UNIFI
        </div>
        {!unifiConfigured ? (
          <span className="net-instrument__not-configured">
            NOT CONFIGURED
          </span>
        ) : (
          <>
            {/* Row 1: Health status label — styled like Pi-hole BLOCKING */}
            <div className="net-instrument__health-row">
              <span
                className="text-glow net-instrument__stat net-instrument__stat--center"
                style={{
                  color: healthToLed === 'online' ? 'var(--cockpit-green)' : healthToLed === 'warning' ? 'var(--cockpit-amber)' : 'var(--cockpit-red)',
                }}
              >
                {healthLabel}
              </span>
            </div>
            {/* Speed arcs (UP / DOWN) with CLIENTS count between — landscape shows compact stats instead */}
            {isLandscape ? (
              <div className="net-instrument__compact-stats">
                <div className="net-instrument__compact-speed-row">
                  <div className="net-instrument__compact-row">
                    <span className="text-glow net-instrument__stat" style={{ color: '#00c8ff' }}>
                      {(animWanRx / 10).toFixed(1)}
                    </span>
                    <span className="net-instrument__sub-label">DOWN</span>
                  </div>
                  <div className="net-instrument__compact-row">
                    <span className="text-glow net-instrument__stat" style={{ color: '#FF3B3B' }}>
                      {(animWanTx / 10).toFixed(1)}
                    </span>
                    <span className="net-instrument__sub-label">UP</span>
                  </div>
                </div>
                <div className="net-instrument__compact-row">
                  <span className="text-glow net-instrument__stat net-instrument__stat--amber">
                    {animClientCount}
                  </span>
                  <span className="net-instrument__sub-label">CLIENTS</span>
                </div>
              </div>
            ) : (
              <div className="net-instrument__arcs">
                {([
                  { label: 'DOWN', value: um!.wanRxMbps, color: '#00c8ff', valueText: `${(animWanRx / 10).toFixed(1)}` },
                  { label: 'UP', value: um!.wanTxMbps, color: '#FF3B3B', valueText: `${(animWanTx / 10).toFixed(1)}` },
                ] as const).map(({ label, value, color, valueText }, idx) => {
                  const mbps = typeof value === 'number' ? value : 0
                  const isOnline = um?.healthStatus === 'online' || um?.healthStatus === 'warning'
                  const litArcs = mbps >= 25 ? 3 : mbps >= 5 ? 2 : (mbps > 0 || isOnline) ? 1 : 0
                  const dimColor = 'rgba(255,255,255,0.08)'
                  const arcs = [
                    { r: 18, strokeWidth: 4 },
                    { r: 27, strokeWidth: 4 },
                    { r: 36, strokeWidth: 4 },
                  ]
                  const arcEl = (
                    <div key={label} className="net-instrument__arc">
                      <span
                        className="text-glow net-instrument__arc-value"
                        style={{ color }}
                      >
                        {valueText}
                      </span>
                      <span className="net-instrument__arc-unit">Mbps</span>
                      <svg width="78" height="48" viewBox="0 0 78 48">
                        {arcs.map((arc, i) => {
                          const cx = 39, cy = 46
                          const startAngle = Math.PI + 0.35
                          const endAngle = 2 * Math.PI - 0.35
                          const x1 = cx + arc.r * Math.cos(startAngle)
                          const y1 = cy + arc.r * Math.sin(startAngle)
                          const x2 = cx + arc.r * Math.cos(endAngle)
                          const y2 = cy + arc.r * Math.sin(endAngle)
                          const d = `M ${x1} ${y1} A ${arc.r} ${arc.r} 0 0 1 ${x2} ${y2}`
                          const isLit = i < litArcs
                          return (
                            <path
                              key={i}
                              d={d}
                              fill="none"
                              stroke={isLit ? color : dimColor}
                              strokeWidth={arc.strokeWidth}
                              strokeLinecap="round"
                              className="net-instrument__arc-path"
                              style={{
                                filter: isLit ? `drop-shadow(0 0 4px ${color})` : 'none',
                              }}
                            />
                          )
                        })}
                      </svg>
                      <span className="net-instrument__arc-label">{label}</span>
                    </div>
                  )
                  // Insert CLIENTS count between UP and DOWN
                  if (idx === 0) {
                    return [
                      arcEl,
                      <div key="clients" className="net-instrument__clients">
                        <span className="net-instrument__clients-value">
                          {animClientCount}
                        </span>
                        <span className="net-instrument__arc-label">CLIENTS</span>
                      </div>,
                    ]
                  }
                  return arcEl
                })}
              </div>
            )}
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
    return <div className="status-led sabnzbd-led sabnzbd-led--active" />
  }
  return <StatusDot status="online" />
}

interface ServiceCardProps {
  service: ServiceStatus
  index: number
  allServices?: ServiceStatus[]
  lastArrEvent?: ArrWebhookEvent | null
  activeOutages?: Map<string, { message?: string; since: string }>
  nasStatus?: NasStatus | null
}

export function ServiceCard({ service, index, allServices, nasStatus }: ServiceCardProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  // RESP-17: only desktop with real mouse engages hover state; kiosk/touch never gets stuck hover
  const hoverCapable = canHover()

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
        transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.08 }}
        className="chamfer-card service-card--nas"
        style={{
          border: `1px solid ${hovered ? 'rgba(232,160,32,0.60)' : 'var(--border-rest)'}`,
        }}
        onMouseEnter={() => { if (hoverCapable) setHovered(true); }}
        onMouseLeave={() => { if (hoverCapable) setHovered(false); }}
      >
        {/* 20px amber ribbon header — same pattern as MEDIA tile */}
        <div className="service-card__ribbon">
          <span className="ribbon-label">NAS</span>
          <StatusDot status={isUnconfigured ? 'stale' : service.status} />
        </div>
        <div className="service-card--nas__body">
          {isUnconfigured || !nasStatus ? (
            <div className="service-card--nas__placeholder">
              <span className="text-label service-card--nas__placeholder-text">
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
    <div className="service-card__empty-state">
      <span className="text-label service-card__empty-label">
        NOT CONFIGURED
      </span>
    </div>
  ) : renderInstrumentBody(service, allServices)

  const isPihole = service.id === 'pihole'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.08 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${service.name}, status: ${isUnconfigured ? 'not configured' : service.status}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick()
      }}
      onMouseEnter={() => { if (hoverCapable) setHovered(true); }}
      onMouseLeave={() => { if (hoverCapable) setHovered(false); }}
      className={`chamfer-card service-card ${isPihole ? 'service-card--pihole' : 'service-card--default'}`}
      style={{
        border: `1px solid ${hovered ? 'rgba(232,160,32,0.60)' : 'var(--border-rest)'}`,
        boxShadow: getCardGlow(isUnconfigured ? 'stale' : service.status),
      }}
    >
      {/* Banner header: 20px strip for pihole (with LED inside), or 6px strip for all others */}
      {isPihole ? (
        <div className="service-card__ribbon">
          <span className="ribbon-label">
            NETWORK
          </span>
          <StatusDot status={isUnconfigured ? 'stale' : service.status} />
        </div>
      ) : (
        <>
          {/* 6px amber header strip (D-17) */}
          <div className="service-card__thin-strip" />

          {/* Header row: service name + status LED */}
          <div className="service-card__header">
            <span className="text-label service-card__name">
              {service.name}
            </span>
            <StatusDot status={isUnconfigured ? 'stale' : service.status} />
          </div>
        </>
      )}

      {/* Stale indicator row */}
      <div className="service-card__stale-row">
        <StaleIndicator lastPollAt={service.lastPollAt} />
      </div>

      {/* Instrument body (service-specific or NOT CONFIGURED label) */}
      {instrumentBody && (
        <div className="service-card__body">{instrumentBody}</div>
      )}
    </motion.div>
  )
}

/** Condensed LED + label row for media stack arr services (D-29, D-30).
 *  Renders a single tight row with a status LED and service label.
 *  Tappable — navigates to service detail view.
 */
export function MediaStackRow({ service, index, lastArrEvent, activeOutages }: ServiceCardProps) {
  const navigate = useNavigate()

  const metrics = service.metrics as Record<string, unknown> | undefined
  const isUnconfigured = service.configured === false
  const queue = typeof metrics?.queue === 'number' ? metrics.queue : 0
  const downloading = metrics?.downloading === true

  // Flash state — triggered by arr webhook events for this service
  const [flashColor, setFlashColor] = useState<string | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // LED over-pulse state — brief intensity burst on status transition (D-19)
  const prevStatusRef = useRef(service.status)
  const [ledPulsing, setLedPulsing] = useState(false)

  useEffect(() => {
    if (prevStatusRef.current !== service.status) {
      prevStatusRef.current = service.status
      setLedPulsing(true)
    }
  }, [service.status])

  // Active outage → persistent red (no timer, no fade). Derived directly from
  // the activeOutages Map so there's no effect-ordering race between the outage
  // state and the lastArrEvent state.
  const hasActiveOutage = activeOutages?.has(service.id) ?? false

  // Compute effective flash color: active outage always wins over transient events.
  // This runs on every render — no useEffect timing issues.
  const outageFlashColor = hasActiveOutage ? EVENT_COLORS.health_issue : null

  useEffect(() => {
    if (hasActiveOutage) {
      // Outage is active — force red and cancel any pending fade timer
      if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null }
      setFlashColor(EVENT_COLORS.health_issue)
      return
    }
    // Outage just cleared — if we were showing persistent red, remove it
    setFlashColor(prev => prev === EVENT_COLORS.health_issue ? null : prev)
  }, [hasActiveOutage])

  useEffect(() => {
    if (!lastArrEvent || lastArrEvent.service !== service.id) return
    if (lastArrEvent.eventCategory === 'unknown') return
    if (lastArrEvent.eventCategory === 'health_restored') return
    // Don't start a transient flash if outage is active — it owns the red treatment
    if (hasActiveOutage) return
    if (!ARR_FLASH_IDS.has(service.id)) return
    const color = EVENT_COLORS[lastArrEvent.eventCategory]
    if (!color) return
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlashColor(color)
    flashTimerRef.current = setTimeout(() => setFlashColor(null), 10_000)
  }, [lastArrEvent, service.id, hasActiveOutage])

  // D-11 LED color logic for arr services
  // Green: online, no download activity
  // Solid purple: actively downloading (file sent to SABnzbd, in progress)
  // Flashing purple: queued (in arr queue, not yet active)
  // Amber: warning
  // Red: offline
  // Grey: unconfigured / stale
  // D-12: glow values aligned with StatusDot (8px 3px spread) + ledBreathe on idle online
  const getLedStyle = (): React.CSSProperties => {
    // Active outage → amber LED with warning pulse (overrides normal status)
    if (hasActiveOutage) {
      return {
        background: 'var(--cockpit-amber)',
        boxShadow: '0 0 8px 3px rgba(232,160,32,0.6)',
        color: 'var(--cockpit-amber)',
        animation: 'ledPulseWarn 1s ease-in-out infinite',
      }
    }
    if (isUnconfigured || service.status === 'stale') {
      return { background: '#666666', boxShadow: 'none', color: '#666666' }
    }
    if (service.status === 'offline') {
      return {
        background: 'var(--cockpit-red)',
        boxShadow: '0 0 8px 3px rgba(255,59,59,0.6)',
        color: 'var(--cockpit-red)',
        animation: 'ledFlashDown 0.4s ease-in-out infinite',
      }
    }
    if (service.status === 'warning') {
      return {
        background: 'var(--cockpit-amber)',
        boxShadow: '0 0 8px 3px rgba(232,160,32,0.6)',
        color: 'var(--cockpit-amber)',
        animation: 'ledPulseWarn 1s ease-in-out infinite',
      }
    }
    if (service.status === 'online') {
      if (downloading) {
        // D-11: Solid purple = actively downloading (file sent to SABnzbd, in progress)
        return {
          background: 'var(--cockpit-purple)',
          boxShadow: '0 0 8px 3px rgba(139,92,246,0.6)',
          color: 'var(--cockpit-purple)',
        }
      }
      if (queue > 0) {
        // D-11: Flashing purple = queued (in arr queue, not yet active in SABnzbd)
        return {
          background: 'var(--cockpit-purple)',
          boxShadow: '0 0 8px 3px rgba(139,92,246,0.6)',
          color: 'var(--cockpit-purple)',
          animation: 'ledFlashPurple 1.5s ease-in-out infinite',
        }
      }
      // D-11/D-12: GREEN = online, no download activity — ledBreathe matches StatusDot glow
      return {
        background: 'var(--cockpit-green, #4ADE80)',
        boxShadow: '0 0 8px 3px rgba(74,222,128,0.6)',
        color: 'var(--cockpit-green, #4ADE80)',
        animation: 'ledBreathe 3s ease-in-out infinite',
      }
    }
    return { background: '#666666', boxShadow: 'none', color: '#666666' }
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
      transition={{ duration: 0.2, ease: 'easeOut', delay: index * 0.08 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${service.name}, status: ${isUnconfigured ? 'not configured' : service.status}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick()
      }}
      className={`media-stack-row${hasActiveOutage ? ' media-stack-row--outage' : ''}`}
      style={!hasActiveOutage ? {
        border: flashColor ? `1px solid ${flashColor}` : '1px solid transparent',
        boxShadow: flashColor ? `0 0 8px 2px ${flashColor}66` : 'none',
      } : undefined}
      onMouseEnter={(e) => {
        if (!flashColor && !outageFlashColor) {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(232,160,32,0.30)'
          ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(232,160,32,0.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!flashColor && !outageFlashColor) {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
          ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
        }
      }}
    >
      {/* Flash glow overlay — persistent for outages, fading for transient events */}
      {(outageFlashColor || flashColor) && (
        <div
          className="media-stack-row__flash"
          style={{ background: `${outageFlashColor || flashColor}1a` }}
        />
      )}
      {/* 10px LED dot — over-pulse on status transition (D-19) */}
      <div
        className="media-stack-row__led"
        style={{
          ...getLedStyle(),
          ...(ledPulsing ? { animation: 'ledOverPulse 0.6s ease-out' } : {}),
        }}
        onAnimationEnd={ledPulsing ? () => setLedPulsing(false) : undefined}
      />
      {/* Service label */}
      <span
        className="text-label text-glow media-stack-row__name"
        style={{ color: isUnconfigured ? '#666' : 'var(--text-offwhite)' }}
      >
        {service.name}
      </span>
    </motion.div>
  )
}
