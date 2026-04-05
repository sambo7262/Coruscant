import { Link } from 'react-router-dom'
import { Settings, List } from 'lucide-react'
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

export function AppHeader({ nas, connected, showBack = false, nasConfigured }: AppHeaderProps) {
  // D-18: no expand/collapse mechanic — all NAS data always visible
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

            {/* Live state — always-visible stats strip (D-18, D-19) */}
            {isLive && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
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
                {/* CPU Temp — D-21: display °F (not °C) */}
                {nas.cpuTempC != null && (() => {
                  const tempF = nas.cpuTempC * 9 / 5 + 32
                  return (
                    <GaugeColumn
                      label="TEMP"
                      fillPct={Math.max(0, Math.min(100, ((tempF - 32) / (140 - 32)) * 100))}
                      valueText={`${Math.round(tempF)}°F`}
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

      {/* NAS inline sections — always visible (D-18, D-19) */}
      {!showBack && isLive && nas && (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 12px' }}>
          {/* Disk temp bars section — all disks with °F temps (D-19, D-21) */}
          {nas.disks && nas.disks.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'flex-end',
              padding: '4px 0',
              flexWrap: 'wrap',
              borderTop: '1px solid rgba(232,160,32,0.1)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '8px',
                color: 'rgba(232,160,32,0.5)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                alignSelf: 'center',
                marginRight: '2px',
              }}>DISKS</span>
              {nas.disks.map(disk => {
                const tempF = Math.round(disk.tempC * 9 / 5 + 32)
                // Truncate disk name to 6 chars max for space; guard against missing name
                const name = disk.name ?? ''
                const label = name.length > 6 ? name.slice(0, 6) : name
                return (
                  <GaugeColumn
                    key={disk.id}
                    label={label}
                    fillPct={Math.max(0, Math.min(100, ((tempF - 32) / (140 - 32)) * 100))}
                    valueText={`${tempF}°`}
                    color={tempColor(tempF)}
                  />
                )
              })}
            </div>
          )}

          {/* Docker stats row — only if docker data exists (D-22) */}
          {nas.docker && (
            <div style={{
              display: 'flex',
              gap: '12px',
              padding: '2px 0',
              fontSize: '10px',
              color: 'var(--text-offwhite)',
              fontFamily: 'var(--font-mono)',
              borderTop: '1px solid rgba(232,160,32,0.1)',
            }}>
              <span style={{ color: 'rgba(232,160,32,0.5)', fontSize: '8px', letterSpacing: '0.06em', alignSelf: 'center' }}>DOCKER</span>
              <span>CPU {nas.docker.cpuPercent.toFixed(1)}%</span>
              <span>RAM {nas.docker.ramPercent.toFixed(1)}%</span>
              <span>↑{nas.docker.networkMbpsUp.toFixed(1)}</span>
              <span>↓{nas.docker.networkMbpsDown.toFixed(1)}</span>
            </div>
          )}

          {/* Image update LED — always visible inline (D-20) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 0 4px 0',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: nas.imageUpdateAvailable ? 'var(--cockpit-amber)' : '#444',
              animation: nas.imageUpdateAvailable ? 'ledPulseWarn 1.2s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: '9px',
              color: nas.imageUpdateAvailable ? 'var(--cockpit-amber)' : '#555',
              letterSpacing: '0.06em',
              fontFamily: 'var(--font-mono)',
            }}>
              {nas.imageUpdateAvailable ? 'IMAGE UPDATES' : 'IMAGES CURRENT'}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
