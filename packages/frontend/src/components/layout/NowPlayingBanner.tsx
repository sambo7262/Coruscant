import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { PlexStream, PlexServerStats } from '@coruscant/shared'
import { StreamRow } from './StreamRow.js'
import { useViewport } from '../../viewport/index.js'

/** Return green / amber / red based on utilization percent */
function statColor(pct: number, baseColor: string): string {
  if (pct >= 90) return 'var(--cockpit-red)'
  if (pct >= 70) return 'var(--cockpit-amber)'
  return baseColor
}

interface NowPlayingBannerProps {
  streams: PlexStream[]
  plexServerStats?: PlexServerStats
  plexConfigured?: boolean
}

export function NowPlayingBanner({ streams, plexServerStats, plexConfigured }: NowPlayingBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const viewport = useViewport()
  const isPortrait = viewport === 'iphone-portrait'
  const isIphone = viewport.startsWith('iphone')
  const collapsedHeight = isPortrait ? 56 : 48

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
      <div className="now-playing-banner--idle">
        {/* Left: PLEX label */}
        <span className="now-playing-banner__label">
          PLEX
        </span>

        {/* Center: idle label */}
        <span className="now-playing-banner__message">
          NO ACTIVE STREAMS
        </span>

        {/* Plex server stats */}
        {plexServerStats && (
          <div className="now-playing-banner__stats">
            {plexServerStats.processCpuPercent != null && (
              <span className="now-playing-banner__stat" style={{ color: statColor(plexServerStats.processCpuPercent, '#4ADE80') }}>
                CPU {plexServerStats.processCpuPercent.toFixed(1)}%
              </span>
            )}
            {plexServerStats.processRamPercent != null && (
              <span className="now-playing-banner__stat" style={{ color: statColor(plexServerStats.processRamPercent, '#00c8ff') }}>
                RAM {plexServerStats.processRamPercent.toFixed(1)}%
              </span>
            )}
            {plexServerStats.bandwidthMbps != null && (
              <span className="now-playing-banner__stat now-playing-banner__stat--bw">
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
          className="now-playing-banner__backdrop"
        />
      )}

      <motion.div
        key="banner"
        className={`banner-blur-bg now-playing-banner__active ${expanded ? 'now-playing-banner__active--expanded' : ''}`}
        initial={{ y: collapsedHeight, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: collapsedHeight, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        aria-live="polite"
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
          className="now-playing-banner"
        >
          {/* Left: PLEX label — always visible (D-29) */}
          <span className="now-playing-banner__label">
            PLEX
          </span>

          {/* Center: cycling stream title (D-24) */}
          <div className="now-playing-banner__title-wrap">
            <AnimatePresence mode="wait">
              <motion.span
                key={activeIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-body now-playing-banner__title"
              >
                {(() => {
                  const s = streams[activeIdx] ?? streams[0]
                  if (!s) return ''
                  // For audio: title already contains artist/track info from backend
                  // For video with season/episode: "Title S1E5"
                  const titleText = (s.season != null && s.episode != null)
                    ? `${s.title} S${s.season}E${s.episode}`
                    : s.title
                  // Transcode glow style — per D-05/D-06
                  // RESP-18: Skip text-shadow animation on iPhone; CSS filter: drop-shadow() handles glow
                  const transcodeStyle = s.transcode
                    ? isIphone
                      ? { color: '#FFD060' }
                      : {
                          animation: `transcodeGlow 3s ease-in-out infinite${titleText.length > 28 ? ', downloadsMarquee 8s linear infinite' : ''}`,
                          animationDelay: titleText.length > 28 ? '0s, 2s' : undefined,
                          color: '#FFD060',
                        }
                    : {}

                  return (
                    <>
                      {s.state && s.state !== 'buffering' && (
                        <span
                          className="now-playing-banner__state-icon"
                          style={{ color: s.state === 'paused' ? '#666' : 'var(--cockpit-amber)' }}
                        >
                          {s.state === 'playing' ? '▶' : '⏸'}
                        </span>
                      )}
                      <span
                        className="now-playing-banner__title-inner"
                        style={{
                          ...(titleText.length > 28 && !s.transcode
                            ? { animation: 'downloadsMarquee 8s linear infinite', animationDelay: '2s' }
                            : {}),
                          ...transcodeStyle,
                        }}
                      >
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
            <div className="now-playing-banner__stats">
              {plexServerStats.processCpuPercent != null && (
                <span className="now-playing-banner__stat" style={{ color: statColor(plexServerStats.processCpuPercent, '#4ADE80') }}>
                  CPU {plexServerStats.processCpuPercent.toFixed(1)}%
                </span>
              )}
              {plexServerStats.processRamPercent != null && (
                <span className="now-playing-banner__stat" style={{ color: statColor(plexServerStats.processRamPercent, '#00c8ff') }}>
                  RAM {plexServerStats.processRamPercent.toFixed(1)}%
                </span>
              )}
              {plexServerStats.bandwidthMbps != null && (
                <span className="now-playing-banner__stat now-playing-banner__stat--bw">
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
              className="now-playing-banner__expanded"
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
