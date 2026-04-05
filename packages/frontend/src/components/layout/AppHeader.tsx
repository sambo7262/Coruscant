import { Link } from 'react-router-dom'
import { Settings, List } from 'lucide-react'
import type { NasStatus } from '@coruscant/shared'

interface AppHeaderProps {
  nas: NasStatus | null
  connected: boolean
  showBack?: boolean
  nasConfigured?: boolean
}

/** Map a Fahrenheit temp to fill color for the bar.
 *  Thresholds match Synology DSM: warn at 45°C, critical at 60°C.
 *  ≥ 140°F (60°C) = red (DSM critical)
 *  ≥ 113°F (45°C) = orange (DSM warning)
 *  < 113°F        = amber (normal)
 */
function tempColor(tempF: number): string {
  if (tempF >= 140) return '#FF3B3B'   // red   — ≥ 60°C (DSM critical)
  if (tempF >= 113) return '#FF8C00'   // orange — ≥ 45°C (DSM warning)
  return 'var(--cockpit-amber)'         // amber  — normal
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

        {/* Center: connection status indicators (hidden when showBack) */}
        {!showBack && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
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

      {/* NAS data row — three sections: DISKS left | NAS stats middle | Docker+LED right (D-18, D-19) */}
      {!showBack && (isLive || isStale) && (
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '0 12px',
          borderTop: '1px solid rgba(232,160,32,0.1)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            padding: '3px 0 4px 0',
          }}>

            {/* LEFT — DISKS: labeled temp gauge bars */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', flexShrink: 0 }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '8px',
                color: 'rgba(232,160,32,0.5)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                alignSelf: 'center',
                marginRight: '2px',
              }}>DISKS</span>
              {isLive && nas && nas.disks && nas.disks.length > 0 ? (
                nas.disks.map(disk => {
                  const tempF = Math.round(disk.tempC * 9 / 5 + 32)
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
                })
              ) : (
                <GaugeColumn label="—" fillPct={0} valueText="—" />
              )}
            </div>

            {/* MIDDLE — NAS stats: CPU / RAM / NET / TEMP */}
            <div style={{
              flex: 1,
              display: 'flex',
              gap: '8px',
              justifyContent: 'center',
              alignItems: 'flex-end',
            }}>
              {isLive && nas ? (
                <>
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
                  {/* Network up/down as stacked text */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(232,160,32,0.6)', letterSpacing: '0.06em' }}>NET</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cockpit-amber)' }}>
                      ↑{nas.networkMbpsUp.toFixed(1)}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cockpit-amber)' }}>
                      ↓{nas.networkMbpsDown.toFixed(1)}
                    </span>
                  </div>
                  {/* CPU Temp — D-21: °F; scale 32°F–158°F (0–70°C) */}
                  {nas.cpuTempC != null && (() => {
                    const tempF = nas.cpuTempC * 9 / 5 + 32
                    return (
                      <GaugeColumn
                        label="TEMP"
                        fillPct={Math.max(0, Math.min(100, ((tempF - 32) / (158 - 32)) * 100))}
                        valueText={`${Math.round(tempF)}°`}
                        color={tempColor(tempF)}
                      />
                    )
                  })()}
                </>
              ) : (
                <>
                  <GaugeColumn label="CPU" fillPct={0} valueText="—" />
                  <GaugeColumn label="RAM" fillPct={0} valueText="—" />
                  <GaugeColumn label="TEMP" fillPct={0} valueText="—" />
                </>
              )}
            </div>

            {/* RIGHT — Docker stats + image update LED */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              alignItems: 'flex-end',
              flexShrink: 0,
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '8px',
                color: 'rgba(232,160,32,0.5)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>DOCKER</span>
              {isLive && nas && nas.docker ? (
                <>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cockpit-amber)' }}>
                    CPU {nas.docker.cpuPercent.toFixed(1)}%
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cockpit-amber)' }}>
                    RAM {nas.docker.ramPercent.toFixed(1)}%
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cockpit-amber)' }}>
                    ↑{nas.docker.networkMbpsUp.toFixed(1)} ↓{nas.docker.networkMbpsDown.toFixed(1)}
                  </span>
                </>
              ) : (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#555' }}>--</span>
              )}
              {/* Image update LED — D-20; always rendered when NAS row visible */}
              {isLive && nas && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: nas.imageUpdateAvailable ? 'var(--cockpit-amber)' : '#444',
                    animation: nas.imageUpdateAvailable ? 'ledPulseWarn 1.2s ease-in-out infinite' : 'none',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: nas.imageUpdateAvailable ? 'var(--cockpit-amber)' : '#555',
                    letterSpacing: '0.06em',
                  }}>
                    {nas.imageUpdateAvailable ? 'UPDATES' : 'CURRENT'}
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </header>
  )
}
