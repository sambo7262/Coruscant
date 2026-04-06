import { useState, useEffect, useRef, useCallback } from 'react'
import type { LogEntry } from '../hooks/useDashboardSSE.js'

interface LogsPageProps {
  lastLogEntry?: LogEntry | null
}

type LevelFilter = 'all' | 'warn' | 'error'

function levelMatchesFilter(level: string, filter: LevelFilter): boolean {
  const l = level.toLowerCase()
  if (filter === 'all') return true
  if (filter === 'error') return l === 'error'
  // warn+ means warn or error
  if (filter === 'warn') return l === 'warn' || l === 'error'
  return true
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour12: false })
  } catch {
    return '--:--:--'
  }
}

const PAGE_SIZE = 500

const panelStyle: React.CSSProperties = {
  background: 'var(--space-mid)',
  border: '1px solid var(--border-rest)',
  borderRadius: '4px',
}

const btnBase: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  padding: '8px 16px',
  borderRadius: '3px',
  cursor: 'pointer',
  textTransform: 'uppercase' as const,
  minHeight: '36px',
  whiteSpace: 'nowrap' as const,
}

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

function LevelChip({ level }: { level: string }) {
  const l = level.toLowerCase()
  let chipStyle: React.CSSProperties = {
    display: 'inline-block',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    padding: '2px 6px',
    borderRadius: '2px',
    width: '48px',
    textAlign: 'center' as const,
    flexShrink: 0,
  }

  if (l === 'error') {
    chipStyle = { ...chipStyle, background: '#FF3B3B', color: '#1a1a1a' }
  } else if (l === 'warn') {
    chipStyle = { ...chipStyle, background: 'rgba(232,160,32,0.8)', color: '#1a1a1a' }
  } else {
    chipStyle = { ...chipStyle, background: 'rgba(232,160,32,0.45)', color: '#E8A020' }
  }

  return <span style={chipStyle}>{l}</span>
}

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

interface PurgeModalProps {
  onClose: () => void
  onConfirm: (days: number) => Promise<void>
  purging: boolean
}

function PurgeModal({ onClose, onConfirm, purging }: PurgeModalProps) {
  const [retentionDays, setRetentionDays] = useState<number>(7)
  const [loadingRetention, setLoadingRetention] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/settings/logs-retention')
        if (res.ok) {
          const data = await res.json() as { retentionDays: number }
          setRetentionDays(data.retentionDays)
        }
      } catch {
        // use default
      } finally {
        setLoadingRetention(false)
      }
    })()
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--space-mid)',
          border: '1px solid var(--border-rest)',
          borderRadius: '6px',
          padding: '28px 24px',
          maxWidth: '360px',
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-heading"
          style={{ color: 'var(--cockpit-amber)', marginBottom: '12px', fontSize: '16px', letterSpacing: '0.08em' }}
        >
          DELETE LOGS
        </h2>
        <p className="text-body" style={{ color: 'var(--text-offwhite)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5 }}>
          {loadingRetention
            ? 'Loading retention setting...'
            : `Delete all logs older than ${retentionDays} day${retentionDays === 1 ? '' : 's'}? This cannot be undone.`}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={purging}
            style={{
              ...btnBase,
              background: 'transparent',
              border: '1px solid var(--cockpit-amber)',
              color: 'var(--cockpit-amber)',
            }}
          >
            KEEP LOGS
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(retentionDays)}
            disabled={purging || loadingRetention}
            style={{
              ...btnBase,
              background: purging ? 'rgba(255,59,59,0.5)' : '#FF3B3B',
              border: '1px solid #FF3B3B',
              color: '#fff',
              opacity: purging || loadingRetention ? 0.7 : 1,
              cursor: purging || loadingRetention ? 'not-allowed' : 'pointer',
            }}
          >
            {purging ? 'DELETING...' : 'CONFIRM DELETE'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LogsPage({ lastLogEntry }: LogsPageProps) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('warn')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [purging, setPurging] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Derive unique service names from loaded entries for the service filter dropdown
  const serviceNames = Array.from(new Set(entries.map((e) => e.service).filter(Boolean))).sort()

  const fetchEntries = useCallback(async (level: LevelFilter, service: string, offset = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        level,
        service,
      })
      const res = await fetch(`/api/logs?${params.toString()}`)
      if (res.ok) {
        const data = await res.json() as { entries: LogEntry[]; total: number }
        if (offset === 0) {
          setEntries(data.entries)
        } else {
          setEntries((prev) => [...prev, ...data.entries])
        }
        setTotal(data.total)
      }
    } catch {
      // silently fail — keep existing entries
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load with default WARN+ filter
  useEffect(() => {
    void fetchEntries(levelFilter, serviceFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch when filters change
  useEffect(() => {
    void fetchEntries(levelFilter, serviceFilter)
  }, [levelFilter, serviceFilter, fetchEntries])

  // Live tail: prepend SSE log entries that match current filter
  useEffect(() => {
    if (!lastLogEntry) return
    const matchesLevel = levelMatchesFilter(lastLogEntry.level, levelFilter)
    const matchesService = serviceFilter === 'all' || lastLogEntry.service === serviceFilter
    if (!matchesLevel || !matchesService) return

    setEntries((prev) => {
      const updated = [lastLogEntry, ...prev]
      // Cap at PAGE_SIZE entries
      return updated.length > PAGE_SIZE ? updated.slice(0, PAGE_SIZE) : updated
    })
    setTotal((prev) => prev + 1)
  }, [lastLogEntry]) // intentionally exclude levelFilter/serviceFilter to avoid stale closure issues

  const handleLoadMore = () => {
    void fetchEntries(levelFilter, serviceFilter, entries.length)
  }

  const handleExport = () => {
    const params = new URLSearchParams({ level: levelFilter, service: serviceFilter, format: 'json' })
    window.location.href = `/api/logs/export?${params.toString()}`
  }

  const handlePurgeConfirm = async (olderThanDays: number) => {
    setPurging(true)
    try {
      const res = await fetch('/api/logs/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays }),
      })
      if (res.ok) {
        setShowPurgeModal(false)
        // Re-fetch entries after purge
        await fetchEntries(levelFilter, serviceFilter)
      }
    } catch {
      // silently fail
    } finally {
      setPurging(false)
    }
  }

  return (
    <div style={{ padding: '0 16px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Page header */}
      <h1
        className="text-heading"
        style={{
          marginBottom: '16px',
          color: 'var(--cockpit-amber)',
          fontSize: '18px',
          letterSpacing: '0.08em',
        }}
      >
        SYSTEM LOGS
      </h1>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '16px',
          alignItems: 'center',
        }}
      >
        {/* Level select */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
          style={selectStyle}
          aria-label="Filter by level"
        >
          <option value="all">ALL</option>
          <option value="warn">WARN+</option>
          <option value="error">ERROR ONLY</option>
        </select>

        {/* Service select */}
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          style={selectStyle}
          aria-label="Filter by service"
        >
          <option value="all">ALL</option>
          {serviceNames.map((name) => (
            <option key={name} value={name}>
              {name.toUpperCase()}
            </option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        {/* Export button */}
        <button
          type="button"
          onClick={handleExport}
          style={{
            ...btnBase,
            background: 'transparent',
            border: '1px solid var(--cockpit-amber)',
            color: 'var(--cockpit-amber)',
          }}
        >
          EXPORT LOGS
        </button>

        {/* Purge button */}
        <button
          type="button"
          onClick={() => setShowPurgeModal(true)}
          style={{
            ...btnBase,
            background: 'transparent',
            border: '1px solid var(--cockpit-red)',
            color: 'var(--cockpit-red)',
          }}
        >
          PURGE LOGS
        </button>
      </div>

      {/* Log table */}
      <div
        ref={scrollRef}
        style={{
          ...panelStyle,
          minHeight: '200px',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 320px)',
        }}
      >
        {loading && entries.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-offwhite)', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
            LOADING...
          </div>
        ) : entries.length === 0 ? (
          /* Empty state */
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <h2
              className="text-heading"
              style={{ color: 'var(--cockpit-amber)', fontSize: '16px', letterSpacing: '0.08em', marginBottom: '8px' }}
            >
              NO LOGS
            </h2>
            <p className="text-body" style={{ color: 'var(--text-offwhite)', fontSize: '13px', lineHeight: 1.5 }}>
              No log entries match the current filter. Change the level or service filter to broaden the view.
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry, idx) => (
              <div
                key={entry.id != null ? entry.id : `${entry.timestamp}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '4px 12px',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(232,160,32,0.03)',
                  overflow: 'hidden',
                }}
              >
                {/* TIME */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  color: 'var(--text-offwhite)',
                  width: '76px',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}>
                  {formatTime(entry.timestamp)}
                </span>

                {/* LEVEL chip */}
                <LevelChip level={entry.level} />

                {/* SERVICE tag */}
                <ServiceTag service={entry.service} />

                {/* MESSAGE */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '13px',
                  color: 'var(--text-offwhite)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load More */}
      {entries.length > 0 && entries.length < total && (
        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loading}
            style={{
              ...btnBase,
              background: 'transparent',
              border: '1px solid var(--border-rest)',
              color: 'var(--text-offwhite)',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            LOAD MORE ({entries.length} ENTRIES SHOWN)
          </button>
        </div>
      )}

      {/* Purge modal */}
      {showPurgeModal && (
        <PurgeModal
          onClose={() => setShowPurgeModal(false)}
          onConfirm={handlePurgeConfirm}
          purging={purging}
        />
      )}
    </div>
  )
}
