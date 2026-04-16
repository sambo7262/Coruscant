import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Settings, List } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import type { ArrWebhookEvent, WeatherData, PiHealthStatus } from '@coruscant/shared'
import { WeatherIcon } from '../weather/WeatherIcon.js'
import { StaleIndicator } from '../ui/StaleIndicator.js'
import { PiHealthPanel } from './PiHealthPanel.js'
import { useViewport } from '../../viewport/index.js'

interface AppHeaderProps {
  connected: boolean
  showBack?: boolean
  lastArrEvent?: ArrWebhookEvent | null
  activeOutages?: Map<string, { message?: string; since: string }>
  weatherData?: WeatherData | null
  piHealth?: PiHealthStatus | null
}

function isWeatherStale(fetchedAt: string): boolean {
  const age = Date.now() - new Date(fetchedAt).getTime()
  return age > 20 * 60 * 1000 // 20 minutes (15 min poll + 5 min grace)
}

function useLocalClock(timezone?: string, enabled = true): { time: string; colonVisible: boolean } {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [enabled])
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

const SEVERITY_TITLE_STYLES: Record<string, { color: string; animation?: string }> = {
  normal:   { color: 'var(--cockpit-amber)' },
  warning:  { color: '#FFD060', animation: 'ledPulseWarn 1s ease-in-out infinite' },
  critical: { color: 'var(--cockpit-red)', animation: 'ledFlashDown 0.4s ease-in-out infinite' },
  stale:    { color: 'var(--cockpit-amber)' },
}

export function AppHeader({ connected, showBack = false, lastArrEvent, activeOutages, weatherData, piHealth }: AppHeaderProps) {
  const viewport = useViewport()
  const isPortrait = viewport === 'iphone-portrait'
  const [ticker, setTicker] = useState<{ text: string; color: string } | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clock = useLocalClock(weatherData?.timezone, !isPortrait)

  const titleSeverity = piHealth?.severity ?? 'normal'
  const titleStyle = SEVERITY_TITLE_STYLES[titleSeverity] ?? SEVERITY_TITLE_STYLES.normal

  // Persistent outage ticker: if any service has an active health outage,
  // hold the ticker at the outage message until HealthRestored clears it.
  const outageCount = activeOutages?.size ?? 0

  useEffect(() => {
    if (outageCount > 0) {
      const entries = [...(activeOutages?.entries() ?? [])]
      const [svc, info] = entries[0]
      const text = entries.length === 1
        ? `${svc.toUpperCase()} \u25B8 INDEXER DOWN${info.message ? ` \u25B8 ${info.message}` : ''}`
        : `${entries.length} SERVICES \u25B8 HEALTH ISSUES`
      if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current)
      setTicker({ text, color: EVENT_COLORS.health_issue })
      return
    }
    // All outages cleared — remove persistent ticker
    if (ticker?.color === EVENT_COLORS.health_issue) {
      setTicker(null)
    }
  }, [outageCount])

  useEffect(() => {
    if (!lastArrEvent || lastArrEvent.eventCategory === 'unknown') return
    if (lastArrEvent.eventCategory === 'health_restored') {
      // Don't show "restored" in ticker — the outage effect handles clearing
      return
    }
    // If there's an active outage, the outage ticker takes priority — skip transient events
    if (outageCount > 0) return
    const text = buildTickerText(lastArrEvent)
    const color = EVENT_COLORS[lastArrEvent.eventCategory] ?? 'transparent'
    if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current)
    setTicker({ text, color })
    tickerTimerRef.current = setTimeout(() => setTicker(null), 10_000)
  }, [lastArrEvent, outageCount])

  return (
    <>
    <header
      className="app-header-blur app-header"
      style={{
        borderBottom: `1px solid ${ticker ? ticker.color : 'rgba(232, 160, 32, 0.30)'}`,
      }}
    >
      {/* Single title row — 44px height */}
      <div className="app-header__title-row">
        {/* Left: title or back link */}
        <div className="app-header__title-left">
          {showBack ? (
            <Link
              to="/"
              className="text-display app-header__title app-header__back-link"
              style={{
                color: titleStyle.color,
                animation: titleStyle.animation,
              }}
            >
              ← CORUSCANT
            </Link>
          ) : (
            <button
              onClick={() => setPanelOpen(prev => !prev)}
              className="app-header__title-button"
              aria-label={panelOpen ? 'Close Pi health panel' : 'Open Pi health panel'}
              aria-expanded={panelOpen}
            >
              <span
                className="text-display app-header__title"
                style={{ color: titleStyle.color, animation: titleStyle.animation }}
              >
                CORUSCANT
              </span>
            </button>
          )}
        </div>

        {/* Center+Right: ticker overlay when active, or normal content */}
        {!showBack && ticker ? (
          /* Ticker overlay — covers center + right columns (gridColumn 2/3) per D-12 */
          <div aria-live="polite" className="app-header__ticker">
            {ticker.text.split('\u25B8').map((segment, i, arr) => (
              <span key={i}>
                {segment}
                {i < arr.length - 1 && (
                  <span className="app-header__ticker-sep">{'\u25B8'}</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <>
            {/* Center: clock — hidden in portrait per D-10 */}
            {!showBack && !isPortrait && (
              <div className="app-header__center">
                {/* Local clock — flashing colon */}
                <span className="app-header__clock">
                  {(() => {
                    const [hm, ampm] = clock.time.split(' ')
                    const [h, m] = hm.split(':')
                    return <>{h}<span style={{ opacity: clock.colonVisible ? 1 : 0 }}>:</span>{m} <span className="app-header__clock-ampm">{ampm}</span></>
                  })()}
                </span>
                {/* Disconnected indicator */}
                {!connected && (
                  <span
                    title="Connection lost. Reconnecting..."
                    className="app-header__disconnected-dot"
                  />
                )}
              </div>
            )}
            {/* Portrait: show disconnected dot standalone if needed */}
            {!showBack && isPortrait && !connected && (
              <span
                title="Connection lost. Reconnecting..."
                className="app-header__disconnected-dot"
              />
            )}

            {/* Right: weather widget + nav icons (hidden when showBack) */}
            {!showBack ? (
              <div className="app-header__right">
                {/* Weather widget — renders nothing when weatherData is null/undefined */}
                {weatherData && (
                  <div className="app-header__weather">
                    <WeatherIcon wmoCode={weatherData.wmo_code} size={30} />
                    <span className="app-header__weather-temp">
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
                  className="app-header__icon-button"
                >
                  <Settings size={26} />
                </Link>
                {!isPortrait && (
                  <Link
                    to="/logs"
                    aria-label="Open Logs"
                    className="app-header__icon-button"
                  >
                    <List size={26} />
                  </Link>
                )}
              </div>
            ) : (
              <div />
            )}
          </>
        )}
      </div>
    </header>
    <AnimatePresence>
      {!showBack && panelOpen && (
        <PiHealthPanel piHealth={piHealth ?? undefined} />
      )}
    </AnimatePresence>
    </>
  )
}
