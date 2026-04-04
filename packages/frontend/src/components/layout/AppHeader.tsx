import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, List } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { NasStatus } from '@coruscant/shared'

interface AppHeaderProps {
  nas: NasStatus | null
  connected: boolean
  showBack?: boolean
  nasConfigured?: boolean
}

/** Map a Fahrenheit temp to fill color for the bar */
function tempColor(tempF: number): string {
  if (tempF >= 114) return '#FF3B3B'   // red — very hot
  if (tempF >= 95)  return '#FF8C00'   // orange — warm
  return 'var(--cockpit-amber)'         // amber — normal
}

/**
 * Vertical bar gauge (4px wide × 20px tall).
 * fillPct: 0–100
 */
function VerticalBar({ fillPct, color }: { fillPct: number; color: string }) {
  const clampedFill = Math.max(0, Math.min(100, fillPct))
  return (
    <div
      style={{
        width: '4px',
        height: '20px',
        background: 'rgba(232,160,32,0.15)',
        borderRadius: '1px',
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
          borderRadius: '1px',
          transition: 'height 0.6s ease',
        }}
      />
    </div>
  )
}

/** Single labeled gauge column: label / bar / value */
function GaugeColumn({
  label,
  fillPct,
  valueText,
  color = 'var(--cockpit-amber)',
}: {
  label: string
  fillPct: number
  valueText: string
  color?: string
}) {
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
        }}
      >
        {label}
      </span>
      <VerticalBar fillPct={fillPct} color={color} />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color,
        }}
      >
        {valueText}
      </span>
    </div>
  )
}

/** Expanded downward panel — serves as NAS detail view (SVCRICH-05) */
function NasHeaderPanel({ nas }: { nas: NasStatus }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{
        overflow: 'hidden',
        background: 'rgba(13, 13, 13, 0.97)',
        borderBottom: '1px solid var(--cockpit-amber)',
        position: 'absolute',
        top: '44px',
        left: 0,
        right: 0,
        zIndex: 30,
        padding: '0 16px',
      }}
    >
      <div style={{ padding: '12px 0', maxWidth: '800px', margin: '0 auto' }}>
        {/* Per-disk section — only if disks exist (D-19) */}
        {nas.disks && nas.disks.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--cockpit-amber)', letterSpacing: '0.08em', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>DISKS</div>
            {nas.disks.map(disk => {
              const tempF = disk.tempC * 9 / 5 + 32
              return (
                <div key={disk.id} style={{ display: 'flex', justifyContent: 'space-between', height: '28px', alignItems: 'center', fontSize: '14px', color: 'var(--text-offwhite)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)' }}>{disk.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {disk.readBytesPerSec != null && <span style={{ marginRight: '12px' }}>R: {(disk.readBytesPerSec / 1048576).toFixed(1)} MB/s</span>}
                    {disk.writeBytesPerSec != null && <span style={{ marginRight: '12px' }}>W: {(disk.writeBytesPerSec / 1048576).toFixed(1)} MB/s</span>}
                    <span style={{ color: tempColor(tempF) }}>{disk.tempC}C</span>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Docker section — only if docker stats exist (D-19) */}
        {nas.docker && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--cockpit-amber)', letterSpacing: '0.08em', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>DOCKER</div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-offwhite)', fontFamily: 'var(--font-mono)' }}>
              <span>CPU {nas.docker.cpuPercent.toFixed(1)}%</span>
              <span>RAM {nas.docker.ramPercent.toFixed(1)}%</span>
              <span>UP {nas.docker.networkMbpsUp.toFixed(1)} Mbps</span>
              <span>DN {nas.docker.networkMbpsDown.toFixed(1)} Mbps</span>
            </div>
          </div>
        )}

        {/* Fan section — only if fans exist (D-19) */}
        {nas.fans && nas.fans.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--cockpit-amber)', letterSpacing: '0.08em', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>FANS</div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-offwhite)', fontFamily: 'var(--font-mono)' }}>
              {nas.fans.map(fan => (
                <span key={fan.id}>{fan.id}: {fan.rpm} RPM</span>
              ))}
            </div>
          </div>
        )}

        {/* Image update LED */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: nas.imageUpdateAvailable ? 'var(--cockpit-amber)' : '#666666',
            animation: nas.imageUpdateAvailable ? 'ledPulseWarn 1.2s ease-in-out infinite' : 'none',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: '12px', color: nas.imageUpdateAvailable ? 'var(--cockpit-amber)' : '#666666', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
            {nas.imageUpdateAvailable ? 'UPDATES AVAILABLE' : 'UP TO DATE'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export function AppHeader({ nas, connected, showBack = false, nasConfigured }: AppHeaderProps) {
  const [expanded, setExpanded] = useState(false)

  // Collapse drawer when navigating to a sub-page
  const isLive = nasConfigured !== false && nas !== null
  const isStale = nasConfigured !== false && nas === null
  const isUnconfigured = nasConfigured === false

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'rgba(13, 13, 13, 0.95)',
        backdropFilter: 'blur(4px)',
        borderBottom: '1px solid rgba(232, 160, 32, 0.30)',
        boxShadow: '0 1px 8px rgba(232, 160, 32, 0.15)',
      }}
    >
      {/* Single title row — 44px height */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          height: '44px',
          padding: '0 12px',
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        {/* Left: title or back link */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {showBack ? (
            <Link
              to="/"
              className="text-display"
              style={{
                color: 'var(--cockpit-amber)',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              ← CORUSCANT
            </Link>
          ) : (
            <span className="text-display" style={{ color: 'var(--cockpit-amber)' }}>
              CORUSCANT
            </span>
          )}
        </div>

        {/* Center: NAS instrument panel (hidden when showBack) */}
        {!showBack && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              maxWidth: '280px',
            }}
          >
            {/* Disconnected indicator */}
            {!connected && (
              <span
                title="Connection lost. Reconnecting..."
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--cockpit-amber)',
                  boxShadow: '0 0 5px 2px rgba(232, 160, 32, 0.6)',
                  animation: 'ledPulseWarn 1s ease-in-out infinite',
                  flexShrink: 0,
                }}
              />
            )}

            {/* NAS NOT CONFIGURED state */}
            {isUnconfigured && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: '#666666',
                  letterSpacing: '0.06em',
                }}
              >
                NAS NOT CONFIGURED
              </span>
            )}

            {/* Stale state — dashes */}
            {isStale && (
              <>
                <GaugeColumn label="CPU" fillPct={0} valueText="—" />
                <GaugeColumn label="RAM" fillPct={0} valueText="—" />
                <GaugeColumn label="DSK" fillPct={0} valueText="—" />
                <div style={{ width: '1px', height: '24px', background: 'rgba(232,160,32,0.25)', flexShrink: 0 }} />
                <GaugeColumn label="TEMP" fillPct={0} valueText="—" />
              </>
            )}

            {/* Live state — interactive strip */}
            {isLive && (
              <div
                role="button"
                tabIndex={0}
                aria-label={expanded ? 'Collapse NAS details' : 'Expand NAS details'}
                aria-expanded={expanded}
                onClick={() => setExpanded(e => !e)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') setExpanded(e => !e)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <GaugeColumn
                  label="CPU"
                  fillPct={nas.cpu}
                  valueText={`${Math.round(nas.cpu)}%`}
                />
                <GaugeColumn
                  label="RAM"
                  fillPct={nas.ram}
                  valueText={`${Math.round(nas.ram)}%`}
                />
                <GaugeColumn
                  label="DSK"
                  fillPct={nas.volumes[0]?.usedPercent ?? 0}
                  valueText={`${Math.round(nas.volumes[0]?.usedPercent ?? 0)}%`}
                />
                <div style={{ width: '1px', height: '24px', background: 'rgba(232,160,32,0.25)', flexShrink: 0 }} />
                {/* Network */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(232,160,32,0.6)', letterSpacing: '0.06em' }}>NET</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cockpit-amber)' }}>
                    ↑{nas.networkMbpsUp.toFixed(1)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cockpit-amber)' }}>
                    ↓{nas.networkMbpsDown.toFixed(1)}
                  </span>
                </div>
                {/* CPU Temp */}
                {nas.cpuTempC != null && (() => {
                  const tempF = nas.cpuTempC * 9 / 5 + 32
                  return (
                    <GaugeColumn
                      label="TEMP"
                      fillPct={Math.max(0, Math.min(100, ((tempF - 32) / (140 - 32)) * 100))}
                      valueText={`${Math.round(nas.cpuTempC)}C`}
                      color={tempColor(tempF)}
                    />
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* Right: nav icons (hidden when showBack) */}
        {!showBack ? (
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
            <Link
              to="/settings"
              aria-label="Open Settings"
              style={{
                color: 'var(--cockpit-amber)',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={20} />
            </Link>
            <Link
              to="/logs"
              aria-label="Open Logs"
              style={{
                color: 'var(--cockpit-amber)',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <List size={20} />
            </Link>
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* Backdrop overlay when expanded */}
      <AnimatePresence>
        {expanded && isLive && (
          <motion.div
            key="nas-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setExpanded(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 25, background: 'rgba(0,0,0,0.4)', top: '44px' }}
          />
        )}
      </AnimatePresence>

      {/* Expanded NAS panel — IS the NAS detail view (SVCRICH-05) */}
      <AnimatePresence>
        {expanded && isLive && nas && <NasHeaderPanel nas={nas} />}
      </AnimatePresence>
    </header>
  )
}
