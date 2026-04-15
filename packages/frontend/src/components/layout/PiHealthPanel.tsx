import { motion } from 'framer-motion'
import type { PiHealthStatus } from '@coruscant/shared'

const STALE_THRESHOLD_MS = 60_000 // 2x 30s default poll interval

type BarColor = 'green' | 'yellow' | 'red'

function getBarColor(percent: number, yellowAt: number, redAt: number): BarColor {
  if (percent >= redAt) return 'red'
  if (percent >= yellowAt) return 'yellow'
  return 'green'
}

const BAR_COLORS: Record<BarColor, string> = {
  green: '#4ADE80',
  yellow: '#E8A020',
  red: '#FF3B3B',
}

function MetricBar({
  label,
  percent,
  display,
  color,
  stale,
}: {
  label: string
  percent: number
  display: string
  color: BarColor
  stale: boolean
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="pi-health__metric-row" style={{ opacity: stale ? 0.4 : 1 }}>
      <div className="pi-health__metric-label-row">
        <span className="pi-health__metric-label">{label}</span>
        <span className="pi-health__metric-value">{display}</span>
      </div>
      <div className="pi-health__bar-track">
        <div
          className="pi-health__bar-fill"
          style={{ width: `${clamped}%`, background: BAR_COLORS[color] }}
        />
      </div>
    </div>
  )
}

export function PiHealthPanel({ piHealth }: { piHealth?: PiHealthStatus }) {
  const isStale = !piHealth || (Date.now() - new Date(piHealth.lastPollAt).getTime() > STALE_THRESHOLD_MS)

  const lastSeenText = piHealth?.lastPollAt
    ? `Last seen: ${Math.round((Date.now() - new Date(piHealth.lastPollAt).getTime()) / 60_000)}m ago`
    : 'No data'

  // CPU Temp: convert C→F, green <149°F, yellow 149-176°F, red >176°F
  const tempC = piHealth?.cpuTempC ?? 0
  const tempF = tempC * 9 / 5 + 32
  const tempPercent = ((tempF - 86) / 108) * 100  // range 86°F (30°C) to 194°F (90°C)
  const tempColor = getBarColor(tempF, 149, 176)   // 65°C=149°F, 80°C=176°F

  // CPU %: green <60%, yellow 60-85%, red >85%
  const cpuPct = piHealth?.cpuPercent ?? 0
  const cpuColor = getBarColor(cpuPct, 60, 85)

  // Memory: green <70%, yellow 70-90%, red >90%
  const memUsed = piHealth?.memUsedMb ?? 0
  const memTotal = piHealth?.memTotalMb ?? 1
  const memPercent = (memUsed / memTotal) * 100
  const memColor = getBarColor(memPercent, 70, 90)

  // WiFi RSSI: -30 dBm = perfect, -70 dBm = weak, -80 dBm = bad
  // Invert: stronger signal = more green. Map -90 to -20 range
  const rssi = piHealth?.wifiRssiDbm ?? -90
  const wifiPercent = Math.max(0, Math.min(100, ((rssi + 90) / 70) * 100))
  const wifiColor: BarColor = rssi > -50 ? 'green' : rssi > -70 ? 'yellow' : 'red'

  // NAS Ping: green <50ms, yellow 50-150ms, red >150ms — range 0-300ms
  const pingMs = piHealth?.nasLatencyMs ?? 0
  const pingPercent = (pingMs / 300) * 100
  const pingColor: BarColor = pingMs < 50 ? 'green' : pingMs < 150 ? 'yellow' : 'red'

  // Throttle: simple performance status
  const currentFlags = (piHealth?.throttledFlags ?? []).filter(f => !f.endsWith('-occurred'))
  const hasCritical = currentFlags.some(f => f === 'currently-throttled' || f === 'under-voltage')
  const hasWarning = currentFlags.length > 0

  const throttleText = hasCritical ? 'PERFORMANCE CRITICAL' : hasWarning ? 'PERFORMANCE DEGRADED' : 'PERFORMANCE OPTIMAL'
  const throttleColor: BarColor = hasCritical ? 'red' : hasWarning ? 'yellow' : 'green'

  return (
    <motion.div
      className="pi-health"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <div className="pi-health__inner">
        {isStale && (
          <div className="pi-health__stale-notice">
            {lastSeenText}
          </div>
        )}
        <MetricBar label="CPU TEMP" percent={tempPercent} display={`${tempF.toFixed(1)}°F`} color={tempColor} stale={isStale} />
        <MetricBar label="CPU" percent={cpuPct} display={`${cpuPct.toFixed(1)}%`} color={cpuColor} stale={isStale} />
        <MetricBar label="MEMORY" percent={memPercent} display={`${memUsed.toFixed(0)}/${memTotal.toFixed(0)} MB`} color={memColor} stale={isStale} />
        <div
          className="pi-health__metric-label-row pi-health__throttle-row"
          style={{ opacity: isStale ? 0.4 : 1 }}
        >
          <span className="pi-health__metric-label">THROTTLE</span>
          <span style={{ color: BAR_COLORS[throttleColor as BarColor] }}>{throttleText}</span>
        </div>
        <MetricBar label="WIFI" percent={wifiPercent} display={`${rssi} dBm`} color={wifiColor} stale={isStale} />
        <MetricBar label="NAS PING" percent={pingPercent} display={`${pingMs.toFixed(0)} ms`} color={pingColor} stale={isStale} />
      </div>
    </motion.div>
  )
}
