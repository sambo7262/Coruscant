import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Settings, List } from 'lucide-react'
import type { ArrWebhookEvent, WeatherData } from '@coruscant/shared'
import { WeatherIcon } from '../weather/WeatherIcon.js'
import { StaleIndicator } from '../ui/StaleIndicator.js'

interface AppHeaderProps {
  connected: boolean
  showBack?: boolean
  lastArrEvent?: ArrWebhookEvent | null
  weatherData?: WeatherData | null
}

function isWeatherStale(fetchedAt: string): boolean {
  const age = Date.now() - new Date(fetchedAt).getTime()
  return age > 20 * 60 * 1000 // 20 minutes (15 min poll + 5 min grace)
}

function useLocalClock(timezone?: string): { time: string; colonVisible: boolean } {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const d = new Date(now)
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  }).formatToParts(d)
  const hour = parts.find(p => p.type === 'hour')?.value ?? ''
  const minute = parts.find(p => p.type === 'minute')?.value ?? ''
  const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value ?? ''
  const colonVisible = d.getSeconds() % 2 === 0
  return { time: `${hour}:${minute} ${dayPeriod}`, colonVisible }
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

export function AppHeader({ connected, showBack = false, lastArrEvent, weatherData }: AppHeaderProps) {
  const [ticker, setTicker] = useState<{ text: string; color: string } | null>(null)
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clock = useLocalClock(weatherData?.timezone)

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
      className="app-header-blur"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'rgba(13, 13, 13, 0.95)',
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
                fontSize: '28px',
              }}
            >
              ← CORUSCANT
            </Link>
          ) : (
            <span className="text-display" style={{ color: 'var(--cockpit-amber)', fontSize: '28px' }}>
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
                {/* Local clock — flashing colon */}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--cockpit-amber)',
                  letterSpacing: '-0.02em',
                }}>
                  {(() => {
                    const [hm, ampm] = clock.time.split(' ')
                    const [h, m] = hm.split(':')
                    return <>{h}<span style={{ opacity: clock.colonVisible ? 1 : 0 }}>:</span>{m} <span style={{ fontSize: '12px', fontWeight: 400 }}>{ampm}</span></>
                  })()}
                </span>
                {/* Disconnected indicator */}
                {!connected && (
                  <span
                    title="Connection lost. Reconnecting..."
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: '#ff4444',
                      boxShadow: '0 0 8px 3px rgba(255, 68, 68, 0.7)',
                      animation: 'ledFlashDown 0.4s ease-in-out infinite',
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            )}

            {/* Right: weather widget + nav icons (hidden when showBack) */}
            {!showBack ? (
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                {/* Weather widget — renders nothing when weatherData is null/undefined */}
                {weatherData && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '44px',
                    paddingRight: '4px',
                  }}>
                    <WeatherIcon wmoCode={weatherData.wmo_code} size={30} />
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '22px',
                      fontWeight: 700,
                      color: 'var(--cockpit-amber)',
                      letterSpacing: '-0.02em',
                    }}>
                      {Math.round(weatherData.temp_f)}°
                    </span>
                    {isWeatherStale(weatherData.fetched_at) && (
                      <StaleIndicator lastPollAt={weatherData.fetched_at} />
                    )}
                  </div>
                )}
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
                  <Settings size={26} />
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
                  <List size={26} />
                </Link>
              </div>
            ) : (
              <div />
            )}
          </>
        )}
      </div>
    </header>
  )
}
