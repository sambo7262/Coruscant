import type { PlexStream } from '@coruscant/shared'

interface StreamRowProps {
  stream: PlexStream
}

export function StreamRow({ stream }: StreamRowProps) {
  const isAudio = stream.mediaType === 'audio'

  // Format title based on media type (D-26)
  let titleText: string
  if (isAudio) {
    // Audio: "Track Title — Album Name"
    titleText = stream.albumName
      ? `${stream.title} — ${stream.albumName}`
      : stream.title
  } else if (stream.season != null && stream.episode != null) {
    // TV: "Title S1E5"
    titleText = `${stream.title} S${stream.season}E${stream.episode}`
  } else if (stream.year) {
    // Movie: "Title (2024)"
    titleText = `${stream.title} (${stream.year})`
  } else {
    titleText = stream.title
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '12px 0',
        borderBottom: '1px solid rgba(232, 160, 32, 0.08)',
      }}
    >
      {/* Row 1: USER > [BADGE] TITLE on left, QUAL / DIRECT on right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="text-body">
          <span style={{ color: 'var(--cockpit-amber)' }}>{stream.user}</span>
          {' '}
          <span style={{ color: 'var(--text-offwhite)' }}>&gt; </span>
          {/* Media type badge (D-25) */}
          <span style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            padding: '1px 4px',
            borderRadius: '2px',
            marginRight: '4px',
            background: isAudio ? 'rgba(155, 89, 182, 0.25)' : 'rgba(232, 160, 32, 0.2)',
            color: isAudio ? '#BB86FC' : 'var(--cockpit-amber)',
            border: `1px solid ${isAudio ? 'rgba(155, 89, 182, 0.4)' : 'rgba(232, 160, 32, 0.3)'}`,
          }}>
            {isAudio ? 'AUDIO' : 'VIDEO'}
          </span>
          <span style={{
            color: 'var(--text-offwhite)',
            ...(stream.transcode ? {
              animation: 'transcodeGlow 3s ease-in-out infinite',
              color: '#FFD060',
            } : {}),
          }}>{titleText}</span>
        </span>
        <span
          className="text-label"
          style={{ flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span style={{ color: 'var(--text-offwhite)' }}>{stream.quality}</span>
          {' / '}
          <span
            style={{
              color: stream.transcode ? 'var(--cockpit-amber)' : 'var(--cockpit-green, #4ADE80)',
              textTransform: 'uppercase',
            }}
          >
            {stream.transcode ? 'TRANSCODE' : 'DIRECT'}
          </span>
          {stream.state && stream.state !== 'buffering' && (
            <span style={{
              fontSize: '10px',
              color: stream.state === 'paused' ? '#666' : 'var(--cockpit-amber)',
              marginLeft: '4px',
              flexShrink: 0,
            }}>
              {stream.state === 'playing' ? '▶' : '⏸'}
            </span>
          )}
        </span>
      </div>

      {/* Progress bar — 1px amber line */}
      <div
        style={{
          height: '1px',
          backgroundColor: 'rgba(232, 160, 32, 0.15)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, stream.progressPercent))}%`,
            backgroundColor: 'var(--cockpit-amber)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}
