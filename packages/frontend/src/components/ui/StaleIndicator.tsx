interface StaleIndicatorProps {
  lastPollAt: string
}

export function StaleIndicator({ lastPollAt }: StaleIndicatorProps) {
  const lastPoll = new Date(lastPollAt).getTime()
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000

  if (now - lastPoll < fiveMinutes) return null

  return (
    <span
      className="text-label"
      style={{
        color: 'var(--cockpit-amber)',
        padding: '1px 6px',
        borderRadius: '3px',
        border: '1px solid var(--cockpit-amber)',
        textTransform: 'uppercase',
      }}
    >
      stale
    </span>
  )
}
