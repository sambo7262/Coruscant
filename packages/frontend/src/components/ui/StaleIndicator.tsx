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
        color: 'var(--tron-amber)',
        padding: '2px 6px',
        borderRadius: '3px',
        border: '1px solid rgba(255, 170, 0, 0.3)',
      }}
    >
      stale
    </span>
  )
}
