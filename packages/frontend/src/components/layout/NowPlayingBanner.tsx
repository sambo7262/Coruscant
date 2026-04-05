import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { PlexStream, PlexServerStats } from '@coruscant/shared'
import { StreamRow } from './StreamRow.js'

interface NowPlayingBannerProps {
  streams: PlexStream[]
  plexServerStats?: PlexServerStats
  plexConfigured?: boolean
}

export function NowPlayingBanner({ streams, plexServerStats, plexConfigured }: NowPlayingBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  // Cycle through stream titles every ~4 seconds when multiple streams active (D-24)
  useEffect(() => {
    if (streams.length <= 1) {
      setActiveIdx(0)
      return
    }
    const id = setInterval(() => setActiveIdx(i => (i + 1) % streams.length), 4000)
    return () => clearInterval(id)
  }, [streams.length])

  // D-11: When Plex is not configured at all, hide the rail entirely
  if (!plexConfigured) return null

  // When configured but no streams, show idle rail (NOT null)
  const hasStreams = streams.length > 0

  // Idle state: Plex configured but no streams active
  if (!hasStreams) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40px',
          zIndex: 30,
          background: 'var(--bg-panel)',
          borderTop: '1px solid rgba(232,160,32,0.2)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '8px',
        }}
      >
        {/* Left: PLEX label */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--cockpit-amber)',
          letterSpacing: '0.08em',
          flexShrink: 0,
          fontWeight: 600,
        }}>
          PLEX
        </span>

        {/* Center: idle label */}
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            color: '#666666',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
          }}
        >
          NO ACTIVE STREAMS
        </span>

        {/* Right: server stats — shows CPU/RAM/BW even in idle so the block is always visible */}
        {plexServerStats && (
          <div style={{
            display: 'flex',
            gap: '8px',
            flexShrink: 0,
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: '#555555',
          }}>
            <span>CPU {(plexServerStats.processCpuPercent ?? 0).toFixed(0)}%</span>
            <span>RAM {(plexServerStats.processRamPercent ?? 0).toFixed(0)}%</span>
            <span>{(plexServerStats.bandwidthMbps ?? 0).toFixed(1)} Mbps</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <AnimatePresence>
      {/* Backdrop when expanded — tap outside to collapse (D-17) */}
      {expanded && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 25,
            background: 'rgba(0, 0, 0, 0.4)',
          }}
        />
      )}

      <motion.div
        key="banner"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: expanded ? 30 : 20,
          background: 'rgba(13, 13, 13, 0.95)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(232, 160, 32, 0.30)',
        }}
      >
        {/* Collapsed strip — 40px (D-02 viewport budget) */}
        <div
          onClick={() => setExpanded(!expanded)}
          role="button"
          tabIndex={0}
          aria-label={expanded ? 'Collapse Now Playing' : 'Expand Now Playing'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded)
          }}
          style={{
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: '8px',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          {/* Left: PLEX label — always visible (D-29) */}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--cockpit-amber)',
            letterSpacing: '0.08em',
            flexShrink: 0,
            fontWeight: 600,
          }}>
            PLEX
          </span>

          {/* Center: cycling stream title (D-24) */}
          <div style={{
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            position: 'relative',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
          }}>
            <AnimatePresence mode="wait">
              <motion.span
                key={activeIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-body"
                style={{
                  color: 'var(--text-offwhite)',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {(() => {
                  const s = streams[activeIdx] ?? streams[0]
                  if (!s) return ''
                  // For audio: title already contains artist/track info from backend
                  // For video with season/episode: "Title S1E5"
                  const titleText = (s.season != null && s.episode != null)
                    ? `${s.title} S${s.season}E${s.episode}`
                    : s.title
                  return (
                    <>
                      {s.state && s.state !== 'buffering' && (
                        <span style={{
                          fontSize: '9px',
                          color: s.state === 'paused' ? '#666' : 'var(--cockpit-amber)',
                          flexShrink: 0,
                        }}>
                          {s.state === 'playing' ? '▶' : '⏸'}
                        </span>
                      )}
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {titleText}
                      </span>
                    </>
                  )
                })()}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Right: Plex server stats (D-24) — always visible in collapsed state */}
          {plexServerStats && (
            <div style={{
              display: 'flex',
              gap: '8px',
              flexShrink: 0,
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-offwhite)',
            }}>
              <span>CPU {(plexServerStats.processCpuPercent ?? 0).toFixed(0)}%</span>
              <span>RAM {(plexServerStats.processRamPercent ?? 0).toFixed(0)}%</span>
              <span>{(plexServerStats.bandwidthMbps ?? 0).toFixed(1)} Mbps</span>
            </div>
          )}
        </div>

        {/* Expanded drawer (D-16) */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{
                overflow: 'hidden',
                maxHeight: 'min(60vh, 320px)',
                overflowY: 'auto',
                padding: '0 16px',
                borderTop: '1px solid var(--cockpit-amber)',
              }}
            >
              {streams.map((stream, i) => (
                <StreamRow key={`${stream.user}-${stream.title}-${i}`} stream={stream} />
              ))}

              {/* Plex Server Stats — also in expanded state for detail (D-10) */}
              {plexServerStats && (
                <div
                  style={{
                    borderTop: '1px solid rgba(232,160,32,0.2)',
                    paddingTop: '8px',
                    marginTop: '8px',
                    paddingBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--cockpit-amber)',
                      letterSpacing: '0.08em',
                      marginBottom: '4px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    PLEX SERVER
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      fontSize: '14px',
                      color: 'var(--text-offwhite)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span>CPU {(plexServerStats.processCpuPercent ?? 0).toFixed(1)}%</span>
                    <span>RAM {(plexServerStats.processRamPercent ?? 0).toFixed(1)}%</span>
                    <span>BW {(plexServerStats.bandwidthMbps ?? 0).toFixed(1)} Mbps</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
