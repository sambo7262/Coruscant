import { motion } from 'framer-motion'
import type { PiHealthStatus } from '@coruscant/shared'

const STALE_THRESHOLD_MS = 60_000 // 2x 30s default poll interval

export function PiHealthPanel({ piHealth }: { piHealth?: PiHealthStatus }) {
  const isStale = !piHealth || (Date.now() - new Date(piHealth.lastPollAt).getTime() > STALE_THRESHOLD_MS)

  const lastSeenText = piHealth?.lastPollAt
    ? `Last seen: ${Math.round((Date.now() - new Date(piHealth.lastPollAt).getTime()) / 60_000)}m ago`
    : 'No data'

  function MetricRow({ label, value, unit }: { label: string; value: string | number | undefined; unit?: string }) {
    const display = value != null ? `${value}${unit ?? ''}` : '\u2014'
    return (
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        lineHeight: '22px',
        opacity: isStale ? 0.4 : 1,
      }}>
        <span style={{ color: 'var(--cockpit-amber)', flexShrink: 0 }}>{label}</span>
        <span style={{
          flex: 1,
          borderBottom: '1px dotted rgba(232, 160, 32, 0.2)',
          margin: '0 6px',
          minWidth: '20px',
        }} />
        <span style={{ color: 'var(--text-offwhite)', flexShrink: 0 }}>{display}</span>
      </div>
    )
  }

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
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '10px 16px' }}>
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
        <MetricRow label="CPU TEMP" value={piHealth?.cpuTempC != null ? piHealth.cpuTempC.toFixed(1) : undefined} unit={'\u00B0C'} />
        <MetricRow label="CPU" value={piHealth?.cpuPercent != null ? piHealth.cpuPercent.toFixed(1) : undefined} unit="%" />
        <MetricRow label="MEMORY" value={piHealth?.memUsedMb != null && piHealth?.memTotalMb != null ? `${piHealth.memUsedMb.toFixed(0)}/${piHealth.memTotalMb.toFixed(0)}` : undefined} unit=" MB" />
        <MetricRow label="THROTTLE" value={piHealth?.throttledFlags?.length ? piHealth.throttledFlags.join(', ') : (piHealth?.throttled === false ? 'NONE' : undefined)} />
        <MetricRow label="WIFI" value={piHealth?.wifiRssiDbm} unit=" dBm" />
        <MetricRow label="NAS PING" value={piHealth?.nasLatencyMs != null ? piHealth.nasLatencyMs.toFixed(0) : undefined} unit=" ms" />
      </div>
    </motion.div>
  )
}
