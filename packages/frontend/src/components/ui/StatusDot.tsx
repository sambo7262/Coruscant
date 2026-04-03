import type { ServiceStatus } from '@coruscant/shared'

const STATUS_COLORS: Record<ServiceStatus['status'], string> = {
  online: 'var(--cockpit-green)',
  warning: 'var(--cockpit-amber)',
  offline: 'var(--cockpit-red)',
  stale: 'var(--cockpit-grey)',
}

const STATUS_GLOW: Record<ServiceStatus['status'], string> = {
  online: '0 0 8px 3px rgba(74, 222, 128, 0.6)',
  warning: '0 0 8px 3px rgba(232, 160, 32, 0.6)',
  offline: '0 0 8px 3px rgba(255, 59, 59, 0.6)',
  stale: 'none',
}

const STATUS_ANIMATIONS: Record<ServiceStatus['status'], string> = {
  online: 'ledBreathe 3s ease-in-out infinite',
  warning: 'ledPulseWarn 1s ease-in-out infinite',
  offline: 'ledFlashDown 0.4s ease-in-out infinite',
  stale: 'none',
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
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: STATUS_COLORS[status],
        boxShadow: STATUS_GLOW[status],
        animation: STATUS_ANIMATIONS[status] === 'none' ? undefined : STATUS_ANIMATIONS[status],
        flexShrink: 0,
      }}
    />
  )
}
