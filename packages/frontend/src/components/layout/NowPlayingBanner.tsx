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
          height: '48px',
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
          fontSize: '22px',
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
            fontSize: '22px',
            fontWeight: 600,
            color: '#666666',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
          }}
        >
          NO ACTIVE STREAMS
        </span>

        {/* Plex server stats */}
        {plexServerStats && (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
            {plexServerStats.processCpuPercent != null && (
              <span style={{ fontSize: '22px', color: '#4ADE80', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                CPU {plexServerStats.processCpuPercent.toFixed(1)}%
              </span>
            )}
            {plexServerStats.processRamPercent != null && (
              <span style={{ fontSize: '22px', color: '#00c8ff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                RAM {plexServerStats.processRamPercent.toFixed(1)}%
              </span>
            )}
            {plexServerStats.bandwidthMbps != null && (
              <span style={{ fontSize: '22px', color: '#C8C8C8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {plexServerStats.bandwidthMbps.toFixed(1)}M
              </span>
            )}
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
        className="banner-blur-bg"
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
          borderTop: '1px solid rgba(232, 160, 32, 0.30)',
        }}
      >
        {/* Collapsed strip — 48px (D-02 viewport budget) */}
        <div
          onClick={() => setExpanded(!expanded)}
          role="button"
          tabIndex={0}
          aria-label={expanded ? 'Collapse Now Playing' : 'Expand Now Playing'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded)
          }}
          style={{
            height: '48px',
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
            fontSize: '22px',
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
            height: '28px',
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
                  fontSize: '22px',
                  fontWeight: 600,
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
                        display: 'inline-block',
                        whiteSpace: 'nowrap',
                        ...(titleText.length > 28
                          ? { animation: 'downloadsMarquee 8s linear infinite', animationDelay: '2s' }
                          : {}),
                      }}>
                        {titleText}
                      </span>
                    </>
                  )
                })()}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Plex server stats in collapsed strip */}
          {plexServerStats && (
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
              {plexServerStats.processCpuPercent != null && (
                <span style={{ fontSize: '22px', color: '#4ADE80', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  CPU {plexServerStats.processCpuPercent.toFixed(1)}%
                </span>
              )}
              {plexServerStats.processRamPercent != null && (
                <span style={{ fontSize: '22px', color: '#00c8ff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  RAM {plexServerStats.processRamPercent.toFixed(1)}%
                </span>
              )}
              {plexServerStats.bandwidthMbps != null && (
                <span style={{ fontSize: '22px', color: '#C8C8C8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {plexServerStats.bandwidthMbps.toFixed(1)}M
                </span>
              )}
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
