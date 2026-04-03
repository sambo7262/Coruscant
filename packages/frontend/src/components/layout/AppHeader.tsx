import { Link } from 'react-router-dom'
import { Settings, List } from 'lucide-react'
import type { NasStatus } from '@coruscant/shared'

interface AppHeaderProps {
  nas: NasStatus | null
  connected: boolean
  showBack?: boolean
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

export function AppHeader({ nas, connected, showBack = false }: AppHeaderProps) {
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
              maxWidth: '220px',
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

            {/* CPU / RAM / Disk gauges */}
            <GaugeColumn
              label="CPU"
              fillPct={nas ? nas.cpu : 0}
              valueText={nas ? `${Math.round(nas.cpu)}%` : '--'}
            />
            <GaugeColumn
              label="RAM"
              fillPct={nas ? nas.ram : 0}
              valueText={nas ? `${Math.round(nas.ram)}%` : '--'}
            />
            <GaugeColumn
              label="DSK"
              fillPct={nas ? (nas.volumes[0]?.usedPercent ?? 0) : 0}
              valueText={nas ? `${Math.round(nas.volumes[0]?.usedPercent ?? 0)}%` : '--'}
            />

            {/* Separator */}
            <div
              style={{
                width: '1px',
                height: '24px',
                background: 'rgba(232,160,32,0.25)',
                flexShrink: 0,
              }}
            />

            {/* Drive temp bars */}
            {nas
              ? nas.volumes.map((vol) => {
                  const tf = vol.tempF ?? Math.round((vol.tempC ?? 0) * 9 / 5 + 32)
                  const fillPct = Math.max(0, Math.min(100, ((tf - 32) / (140 - 32)) * 100))
                  return (
                    <GaugeColumn
                      key={vol.name}
                      label={vol.name}
                      fillPct={fillPct}
                      valueText={`${tf}°F`}
                      color={tempColor(tf)}
                    />
                  )
                })
              : (
                <GaugeColumn
                  label="DRV"
                  fillPct={0}
                  valueText="--°F"
                />
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
    </header>
  )
}
