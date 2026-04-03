import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { PlexStream } from '@coruscant/shared'
import { StreamRow } from './StreamRow.js'

interface NowPlayingBannerProps {
  streams: PlexStream[]
}

export function NowPlayingBanner({ streams }: NowPlayingBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const tickerRef = useRef<HTMLSpanElement>(null)
  const [shouldScroll, setShouldScroll] = useState(false)

  // Check if ticker text overflows and needs marquee (UI-SPEC Animation Contract)
  useEffect(() => {
    if (tickerRef.current) {
      setShouldScroll(tickerRef.current.scrollWidth > tickerRef.current.clientWidth)
    }
  }, [streams])

  if (streams.length === 0) return null // D-14: hidden completely when no streams

  const firstStream = streams[0]
  const tickerText =
    firstStream.season != null && firstStream.episode != null
      ? `${firstStream.title} S${firstStream.season}E${firstStream.episode} \u2022 ${firstStream.user}`
      : `${firstStream.title} \u2022 ${firstStream.user}`

  const pluralS = streams.length === 1 ? '' : 's'

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
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
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
        {/* Collapsed strip — 48px (UI-SPEC Spacing) */}
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
            padding: '0 16px',
            gap: '8px',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <span className="text-body" style={{ color: 'var(--cockpit-amber)', flexShrink: 0 }}>
            &#9654; {streams.length} stream{pluralS}
          </span>
          <span
            ref={tickerRef}
            className="text-body"
            style={{
              color: 'var(--text-offwhite)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              flex: 1,
              position: 'relative',
            }}
          >
            {shouldScroll && !expanded ? (
              <span
                style={{
                  display: 'inline-block',
                  animation: 'marquee 12s linear infinite',
                  paddingRight: '50%',
                }}
              >
                {tickerText}&nbsp;&nbsp;&nbsp;{tickerText}
              </span>
            ) : (
              tickerText
            )}
          </span>
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
