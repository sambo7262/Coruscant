import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Settings, List } from 'lucide-react'
import type { NasStatus, ArrWebhookEvent } from '@coruscant/shared'

interface AppHeaderProps {
  nas: NasStatus | null
  connected: boolean
  showBack?: boolean
  nasConfigured?: boolean
  lastArrEvent?: ArrWebhookEvent | null
}

const EVENT_COLORS: Record<string, string> = {
  grab: '#ffaa00',
  download_complete: '#c084fc',
  health_issue: '#ff4444',
  update_available: '#00ff88',
}

function buildTickerText(event: ArrWebhookEvent): string {
  const svc = event.service.toUpperCase()
  const verb: Record<string, string> = {
    grab: 'GRABBED',
    download_complete: 'IMPORTED',
    health_issue: 'HEALTH ISSUE',
    update_available: 'UPDATE AVAILABLE',
  }
  // D-08: Prowlarr indexer health uses special copy
  let eventVerb = verb[event.eventCategory] ?? ''
  if (event.eventCategory === 'health_issue' && event.rawEventType === 'Health') {
    if (event.title?.toLowerCase().includes('indexer')) {
      eventVerb = 'INDEXER DOWN'
    }
  }
  // D-13: Title portion only for grab and download_complete
  if (event.title && (event.eventCategory === 'grab' || event.eventCategory === 'download_complete')) {
    return `${svc} \u25B8 ${eventVerb} \u25B8 ${event.title}`
  }
  return `${svc} \u25B8 ${eventVerb}`
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

export function AppHeader({ nas, connected, showBack = false, nasConfigured, lastArrEvent }: AppHeaderProps) {
  // D-18: no expand/collapse mechanic — all NAS data always visible
  const isLive = nasConfigured !== false && nas !== null
  const isStale = nasConfigured !== false && nas === null
  const isUnconfigured = nasConfigured === false

  const [ticker, setTicker] = useState<{ text: string; color: string } | null>(null)
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!lastArrEvent || lastArrEvent.eventCategory === 'unknown') return
    const text = buildTickerText(lastArrEvent)
    const color = EVENT_COLORS[lastArrEvent.eventCategory] ?? 'transparent'
    if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current)
    setTicker({ text, color })
    tickerTimerRef.current = setTimeout(() => setTicker(null), 10_000)
  }, [lastArrEvent])

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
        borderBottom: `1px solid ${ticker ? ticker.color : 'rgba(232, 160, 32, 0.30)'}`,
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

        {/* Center+Right: ticker overlay when active, or normal content */}
        {!showBack && ticker ? (
          /* Ticker overlay — covers center + right columns (gridColumn 2/3) per D-12 */
          <div
            aria-live="polite"
            style={{
              gridColumn: '2 / 4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              fontWeight: 400,
              color: 'var(--cockpit-amber)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '0 12px',
              opacity: 1,
              transition: 'opacity 0.4s ease-out',
            }}
          >
            {ticker.text.split('\u25B8').map((segment, i, arr) => (
              <span key={i}>
                {segment}
                {i < arr.length - 1 && (
                  <span style={{ color: 'rgba(232, 160, 32, 0.5)' }}>{'\u25B8'}</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* NAS temp/fan summary line — one-line inline (D-21: NAS detail moved to standalone tile) */}
      {!showBack && (isLive || isStale) && (
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '0 12px 4px 12px',
          borderTop: '1px solid rgba(232,160,32,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          {/* CPU temp */}
          {isLive && nas && nas.cpuTempC != null && (() => {
            const tempF = Math.round(nas.cpuTempC * 9 / 5 + 32)
            return (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: tempColor(tempF) }}>
                CPU {tempF}°F
              </span>
            )
          })()}
          {/* Disk temps */}
          {isLive && nas && nas.disks && nas.disks.map(disk => {
            const tempF = Math.round(disk.tempC * 9 / 5 + 32)
            const name = disk.name ? disk.name.slice(0, 6) : disk.id
            return (
              <span key={disk.id} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: tempColor(tempF) }}>
                {name} {tempF}°F
              </span>
            )
          })}
          {/* Fan RPM */}
          {isLive && nas && nas.fans && nas.fans.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(232,160,32,0.6)' }}>
              FAN {nas.fans[0].rpm}rpm
            </span>
          )}
          {/* Image update LED */}
          {isLive && nas && nas.imageUpdateAvailable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--cockpit-amber)',
                animation: 'ledPulseWarn 1.2s ease-in-out infinite',
                flexShrink: 0,
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--cockpit-amber)', letterSpacing: '0.06em' }}>
                UPDATES
              </span>
            </div>
          )}
          {/* Stale indicator */}
          {isStale && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#555' }}>NAS STALE</span>
          )}
        </div>
      )}
    </header>
  )
}
