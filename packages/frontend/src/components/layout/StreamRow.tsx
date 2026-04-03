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
        borderBottom: '1px solid rgba(232, 160, 32, 0.08)',
      }}
    >
      {/* Row 1: USER > TITLE on left, QUAL / DIRECT on right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="text-body">
          <span style={{ color: 'var(--cockpit-amber)' }}>{stream.user}</span>
          {' '}
          <span style={{ color: 'var(--text-offwhite)' }}>&gt; {titleText}</span>
        </span>
        <span
          className="text-label"
          style={{ flexShrink: 0, marginLeft: '8px' }}
        >
          <span style={{ color: 'var(--text-offwhite)' }}>{stream.quality}</span>
          {' / '}
          <span
            style={{
              color: stream.transcode ? 'var(--cockpit-amber)' : 'var(--cockpit-green)',
              textTransform: 'uppercase',
            }}
          >
            {stream.transcode ? 'TRANSCODE' : 'DIRECT'}
          </span>
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
