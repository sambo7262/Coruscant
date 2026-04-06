import { useEffect, useRef, useState } from 'react'
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
  const prevStatusRef = useRef<ServiceStatus['status']>(status)
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    if (prevStatusRef.current !== status) {
      prevStatusRef.current = status
      setPulsing(true)
    }
  }, [status])

  const handleAnimationEnd = () => {
    setPulsing(false)
  }

  // When over-pulsing, override animation with the over-pulse burst
  const animationStyle = pulsing
    ? 'ledOverPulse 0.6s ease-out'
    : STATUS_ANIMATIONS[status] === 'none'
    ? undefined
    : STATUS_ANIMATIONS[status]

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
        animation: animationStyle,
        color: STATUS_COLORS[status], // currentColor for ledOverPulse box-shadow
        flexShrink: 0,
      }}
      onAnimationEnd={pulsing ? handleAnimationEnd : undefined}
    />
  )
}
