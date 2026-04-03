import type { ServiceStatus } from '@coruscant/shared'

const STATUS_COLORS: Record<ServiceStatus['status'], string> = {
  online: 'var(--tron-blue)',
  warning: 'var(--tron-amber)',
  offline: 'var(--tron-red)',
  stale: 'var(--tron-blue)',
}

const STATUS_ANIMATIONS: Record<ServiceStatus['status'], string> = {
  online: 'breathe 3s ease-in-out infinite',
  warning: 'pulseAmber 1.2s ease-in-out infinite',
  offline: 'flashRed 0.7s ease-in-out infinite',
  stale: 'breathe 4s ease-in-out infinite',
}

interface StatusDotProps {
  status: ServiceStatus['status']
}

export function StatusDot({ status }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: STATUS_COLORS[status],
        boxShadow: `0 0 6px 1px ${STATUS_COLORS[status]}`,
        animation: STATUS_ANIMATIONS[status],
        flexShrink: 0,
      }}
    />
  )
}
