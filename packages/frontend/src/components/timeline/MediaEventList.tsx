import { useState, useEffect } from 'react'
import type { LogEntry } from '../../hooks/useDashboardSSE.js'
import { useViewport } from '../../viewport/index.js'
import type { TimeWindow } from './TimeWindowSelector.js'

// ------- Types -------

type EventType = 'grab' | 'download_complete' | 'health_issue' | 'health_restored'

interface MediaEvent {
  type: EventType
  summary: string
  service: string
  timestamp: string
}

interface MediaEventListProps {
  window: TimeWindow
}

// ------- Style constants (matching LogsPage patterns) -------

const selectStyle: React.CSSProperties = {
  background: 'var(--space-mid)',
  border: '1px solid var(--border-rest)',
  color: 'var(--cockpit-amber)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '12px',
  letterSpacing: '0.06em',
  padding: '8px 12px',
  borderRadius: '3px',
  minHeight: '36px',
  cursor: 'pointer',
  outline: 'none',
}

// ------- Event type dot color mapping -------

const EVENT_DOT_COLORS: Record<EventType, string> = {
  grab: 'var(--cockpit-purple)',
  download_complete: 'var(--cockpit-amber)',
  health_issue: 'var(--cockpit-red)',
  health_restored: 'var(--cockpit-green)',
}

const EVENT_LABELS: Record<EventType, string> = {
  grab: 'GRAB',
  download_complete: 'DOWNLOAD',
  health_issue: 'DOWN',
  health_restored: 'RESTORED',
}

// ------- Time window to milliseconds mapping -------

function windowToMs(w: TimeWindow): number {
  switch (w) {
    case '24h': return 24 * 60 * 60 * 1000
    case '3d': return 3 * 24 * 60 * 60 * 1000
    case '7d': return 7 * 24 * 60 * 60 * 1000
  }
}

// ------- Event parsing -------

export function parseEventFromLog(entry: LogEntry): MediaEvent | null {
  try {
    const payload = JSON.parse(entry.payload ?? '{}') as Record<string, unknown>
    const eventCategory = payload['eventCategory'] as string | undefined
    const title = (payload['title'] ?? payload['movieTitle'] ?? payload['seriesTitle']) as string | undefined

    if (eventCategory === 'grab') {
      return {
        type: 'grab',
        summary: `${entry.service.toUpperCase()} GRAB - ${title ?? 'Unknown'}`,
        service: entry.service,
        timestamp: entry.timestamp,
      }
    }

    if (eventCategory === 'download_complete') {
      return {
        type: 'download_complete',
        summary: `${entry.service.toUpperCase()} DOWNLOAD - ${title ?? 'Unknown'}`,
        service: entry.service,
        timestamp: entry.timestamp,
      }
    }

    if (eventCategory === 'health_issue') {
      return {
        type: 'health_issue',
        summary: `SERVICE DOWN - ${entry.service}`,
        service: entry.service,
        timestamp: entry.timestamp,
      }
    }

    if (eventCategory === 'health_restored') {
      return {
        type: 'health_restored',
        summary: `SERVICE RESTORED - ${entry.service}`,
        service: entry.service,
        timestamp: entry.timestamp,
      }
    }
  } catch {
    // Malformed payload — fall through to message-based detection
  }

  // Fallback: check message text for health state changes (no eventCategory in payload)
  const msg = entry.message.toLowerCase()
  if (msg.includes('now offline') || msg.includes('went offline') || msg.includes('is down')) {
    return {
      type: 'health_issue',
      summary: `SERVICE DOWN - ${entry.service}`,
      service: entry.service,
      timestamp: entry.timestamp,
    }
  }
  if (msg.includes('back online') || msg.includes('is back') || msg.includes('recovered') || msg.includes('restored')) {
    return {
      type: 'health_restored',
      summary: `SERVICE RESTORED - ${entry.service}`,
      service: entry.service,
      timestamp: entry.timestamp,
    }
  }

  return null
}

// ------- ServiceTag component (matches LogsPage pattern) -------

function ServiceTag({ service }: { service: string }) {
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '11px',
      fontWeight: 400,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      background: 'rgba(232,160,32,0.2)',
      border: '1px solid rgba(232,160,32,0.4)',
      color: '#E8A020',
      padding: '2px 6px',
      borderRadius: '2px',
      maxWidth: '88px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
      flexShrink: 0,
    }}>
      {service}
    </span>
  )
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return '--'
  }
}

// ------- MediaEventList -------

export function MediaEventList({ window }: MediaEventListProps) {
  const viewport = useViewport()
  const isIphone = viewport.startsWith('iphone')
  const isLandscape = viewport === 'iphone-landscape'

  const [allEvents, setAllEvents] = useState<MediaEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const res = await fetch('/api/logs?limit=1000&offset=0&level=all&service=all')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as { entries: LogEntry[]; total: number }

        if (cancelled) return

        const cutoff = Date.now() - windowToMs(window)

        const parsed = data.entries
          .filter(entry => {
            try {
              return new Date(entry.timestamp).getTime() >= cutoff
            } catch {
              return false
            }
          })
          .map(entry => parseEventFromLog(entry))
          .filter((e): e is MediaEvent => e !== null)
          // newest first
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

        setAllEvents(parsed)
      } catch {
        if (!cancelled) {
          setError('EVENT DATA UNAVAILABLE — Raw logs may still be accessible in the RAW LOGS tab.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [window])

  // Derive unique service names from events for the dropdown
  const uniqueServices = Array.from(new Set(allEvents.map(e => e.service))).sort()

  // Client-side filtering
  const filteredEvents = allEvents.filter(e => {
    if (serviceFilter !== 'all' && e.service !== serviceFilter) return false
    if (typeFilter !== 'all' && e.type !== typeFilter) return false
    return true
  })

  // Scrollable list max-height per viewport
  const listMaxHeight = isLandscape
    ? 'calc(100dvh - 300px)'
    : isIphone
      ? 'calc(100dvh - 380px)'
      : 'calc(100vh - 420px)'

  return (
    <div>
      {/* Section heading */}
      <h2
        className="text-heading"
        style={{
          color: 'var(--cockpit-amber)',
          fontSize: '18px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          marginBottom: '12px',
        }}
      >
        MEDIA + SERVICE EVENTS
      </h2>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '12px',
          alignItems: 'center',
        }}
      >
        {/* Service filter */}
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          aria-label="Filter by service"
          style={{ ...selectStyle, minHeight: isIphone ? '44px' : '36px' }}
        >
          <option value="all">ALL SERVICES</option>
          {uniqueServices.map(svc => (
            <option key={svc} value={svc}>
              {svc.toUpperCase()}
            </option>
          ))}
        </select>

        {/* Event type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by event type"
          style={{ ...selectStyle, minHeight: isIphone ? '44px' : '36px' }}
        >
          <option value="all">ALL TYPES</option>
          <option value="grab">GRAB</option>
          <option value="download_complete">DOWNLOAD</option>
          <option value="health_issue">SERVICE DOWN</option>
          <option value="health_restored">SERVICE RESTORED</option>
        </select>
      </div>

      {/* Event list container */}
      <div
        style={{
          background: 'var(--space-mid)',
          border: '1px solid var(--border-rest)',
          borderRadius: '4px',
          overflowY: 'auto',
          maxHeight: listMaxHeight,
          minHeight: '120px',
        }}
      >
        {loading ? (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            color: 'var(--cockpit-amber)',
            letterSpacing: '0.08em',
          }}>
            LOADING...
          </div>
        ) : error ? (
          <div style={{
            padding: '16px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            color: 'var(--cockpit-red)',
            letterSpacing: '0.04em',
          }}>
            {error}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <h3
              className="text-heading"
              style={{
                color: 'var(--cockpit-amber)',
                fontSize: '16px',
                letterSpacing: '0.08em',
                marginBottom: '8px',
              }}
            >
              NO EVENTS
            </h3>
            <p
              className="text-body"
              style={{
                color: 'var(--text-offwhite)',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              No events match the current filter. Try broadening the service or event type selection.
            </p>
          </div>
        ) : (
          <div>
            {filteredEvents.map((event, idx) => (
              <div
                key={`${event.timestamp}-${event.type}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 12px',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(232,160,32,0.03)',
                  overflow: 'hidden',
                }}
              >
                {/* Type indicator dot */}
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: EVENT_DOT_COLORS[event.type],
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />

                {/* Event type tag */}
                <ServiceTag service={EVENT_LABELS[event.type]} />

                {/* Summary text */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '15px',
                  color: 'var(--text-offwhite)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {event.summary}
                </span>

                {/* Timestamp */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  color: 'rgba(var(--text-offwhite-rgb, 220,220,220), 0.7)',
                  opacity: 0.7,
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}>
                  {formatTime(event.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
