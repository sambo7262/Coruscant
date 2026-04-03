import type { PlexStream } from '@coruscant/shared'

interface StreamRowProps {
  stream: PlexStream
}

export function StreamRow({ stream }: StreamRowProps) {
  // Format title: "Title" or "Title S1E5"
  const titleText =
    stream.season != null && stream.episode != null
      ? `${stream.title} S${stream.season}E${stream.episode}`
      : stream.year
        ? `${stream.title} (${stream.year})`
        : stream.title

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '12px 0',
        borderBottom: '1px solid rgba(0, 200, 255, 0.08)',
      }}
    >
      {/* Row 1: user/player + title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="text-body" style={{ color: 'var(--tron-blue)' }}>
          {titleText}
        </span>
        <span
          className="text-label"
          style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}
        >
          {stream.user}
        </span>
      </div>

      {/* Row 2: progress bar */}
      <div
        style={{
          height: '4px',
          borderRadius: '2px',
          backgroundColor: 'rgba(0, 200, 255, 0.15)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, stream.progressPercent))}%`,
            backgroundColor: 'var(--tron-blue)',
            borderRadius: '2px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Row 3: quality + transcode indicator */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span className="text-label" style={{ color: 'var(--text-muted)' }}>
          {stream.quality}
        </span>
        <span
          className="text-label"
          style={{
            color: stream.transcode ? 'var(--tron-amber)' : 'var(--tron-blue)',
            textTransform: 'uppercase',
          }}
        >
          {stream.transcode ? 'TRANSCODE' : 'DIRECT'}
        </span>
      </div>
    </div>
  )
}
