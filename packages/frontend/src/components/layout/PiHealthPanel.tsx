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
    <div style={{ opacity: stale ? 0.4 : 1, marginBottom: '6px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        lineHeight: '16px',
        marginBottom: '3px',
      }}>
        <span style={{ color: 'var(--cockpit-amber)', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ color: 'var(--text-offwhite)' }}>{display}</span>
      </div>
      <div style={{
        width: '100%',
        height: '6px',
        background: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${clamped}%`,
          height: '100%',
          background: BAR_COLORS[color],
          borderRadius: '3px',
          transition: 'width 0.6s ease, background 0.4s ease',
        }} />
      </div>
    </div>
  )
}

export function PiHealthPanel({ piHealth }: { piHealth?: PiHealthStatus }) {
  const isStale = !piHealth || (Date.now() - new Date(piHealth.lastPollAt).getTime() > STALE_THRESHOLD_MS)

  const lastSeenText = piHealth?.lastPollAt
    ? `Last seen: ${Math.round((Date.now() - new Date(piHealth.lastPollAt).getTime()) / 60_000)}m ago`
    : 'No data'

  // CPU Temp: green <65°C, yellow 65-80°C, red >80°C — range 30-90°C
  const tempC = piHealth?.cpuTempC ?? 0
  const tempPercent = ((tempC - 30) / 60) * 100
  const tempColor = getBarColor(tempC, 65, 80)

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

  // Throttle flags: human-readable labels
  const THROTTLE_LABELS: Record<string, string> = {
    'under-voltage': 'LOW POWER',
    'arm-freq-capped': 'FREQ CAPPED',
    'currently-throttled': 'THROTTLED',
    'soft-temp-limit': 'TEMP LIMIT',
    'under-voltage-occurred': 'LOW POWER (PREV)',
    'arm-freq-capped-occurred': 'FREQ CAPPED (PREV)',
    'throttled-occurred': 'THROTTLED (PREV)',
    'soft-temp-limit-occurred': 'TEMP LIMIT (PREV)',
  }
  const throttleText = piHealth?.throttledFlags?.length
    ? piHealth.throttledFlags
        .filter(f => !f.endsWith('-occurred'))  // skip historical flags — only show current state
        .map(f => THROTTLE_LABELS[f] ?? f)
        .join(', ') || 'NONE'
    : piHealth?.throttled === false ? 'NONE' : '\u2014'
  const throttleColor = piHealth?.throttledFlags?.length
    ? (piHealth.throttledFlags.some(f => f === 'currently-throttled' || f === 'under-voltage') ? 'red' : 'yellow')
    : 'green'

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        position: 'fixed',
        top: '44px',
        left: 0,
        right: 0,
        zIndex: 9,
        background: 'rgba(13, 13, 13, 0.97)',
        borderBottom: '1px solid rgba(232, 160, 32, 0.25)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '10px 16px' }}>
        {isStale && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#999',
            marginBottom: '6px',
            textAlign: 'center',
          }}>
            {lastSeenText}
          </div>
        )}
        <MetricBar label="CPU TEMP" percent={tempPercent} display={`${tempC.toFixed(1)}°C`} color={tempColor} stale={isStale} />
        <MetricBar label="CPU" percent={cpuPct} display={`${cpuPct.toFixed(1)}%`} color={cpuColor} stale={isStale} />
        <MetricBar label="MEMORY" percent={memPercent} display={`${memUsed.toFixed(0)}/${memTotal.toFixed(0)} MB`} color={memColor} stale={isStale} />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          lineHeight: '16px',
          marginBottom: '6px',
          opacity: isStale ? 0.4 : 1,
        }}>
          <span style={{ color: 'var(--cockpit-amber)', letterSpacing: '0.06em' }}>THROTTLE</span>
          <span style={{ color: BAR_COLORS[throttleColor as BarColor] }}>{throttleText}</span>
        </div>
        <MetricBar label="WIFI" percent={wifiPercent} display={`${rssi} dBm`} color={wifiColor} stale={isStale} />
        <MetricBar label="NAS PING" percent={pingPercent} display={`${pingMs.toFixed(0)} ms`} color={pingColor} stale={isStale} />
      </div>
    </motion.div>
  )
}
