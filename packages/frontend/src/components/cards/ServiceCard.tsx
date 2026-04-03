import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { ServiceStatus } from '@coruscant/shared'
import { StatusDot } from '../ui/StatusDot.js'
import { StaleIndicator } from '../ui/StaleIndicator.js'

// Health state glow config — per UI-SPEC Animation Contract
const GLOW_CONFIG: Record<ServiceStatus['status'], { animation: string; shadow: string }> = {
  online: {
    animation: 'breathe 3s ease-in-out infinite',
    shadow: '0 0 12px 2px rgba(0, 200, 255, 0.5)',
  },
  warning: {
    animation: 'pulseAmber 1.2s ease-in-out infinite',
    shadow: '0 0 16px 3px rgba(255, 170, 0, 0.6)',
  },
  offline: {
    animation: 'flashRed 0.7s ease-in-out infinite',
    shadow: '0 0 20px 4px rgba(255, 68, 68, 0.5)',
  },
  stale: {
    animation: 'breathe 4s ease-in-out infinite',
    shadow: '0 0 12px 2px rgba(0, 200, 255, 0.2)',
  },
}

const BORDER_COLORS: Record<ServiceStatus['status'], string> = {
  online: 'var(--tron-blue)',
  warning: 'var(--tron-amber)',
  offline: 'var(--tron-red)',
  stale: 'var(--tron-blue)',
}

interface ServiceCardProps {
  service: ServiceStatus
  index: number
}

export function ServiceCard({ service, index }: ServiceCardProps) {
  const navigate = useNavigate()
  const glow = GLOW_CONFIG[service.status]

  const handleClick = () => {
    // Save scroll position for restoration on back nav (UI-SPEC Scroll behavior)
    sessionStorage.setItem('dashboardScrollY', window.scrollY.toString())
    navigate(`/services/${service.id}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${service.name}, status: ${service.status}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      style={{
        position: 'relative',
        height: '88px',
        padding: '12px',
        borderRadius: '6px',
        background: 'rgba(13, 17, 23, 0.85)',
        backdropFilter: 'blur(4px)',
        border: `1px solid rgba(0, 200, 255, 0.15)`,
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: glow.shadow,
        animation: glow.animation,
        // CSS custom property for per-card border trace stagger (D-11)
        // @ts-expect-error CSS custom property
        '--card-trace-delay': `${index * 0.3}s`,
      }}
    >
      {/* Border trace pseudo-element via CSS class */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-1px',
          borderRadius: 'inherit',
          background: `conic-gradient(from var(--angle), transparent 20%, ${BORDER_COLORS[service.status]} 40%, transparent 60%)`,
          animation: `borderTrace 3s linear infinite`,
          animationDelay: `${index * 0.3}s`,
          opacity: 0.5,
          zIndex: -1,
          willChange: 'transform',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <StatusDot status={service.status} />
        <span className="text-body" style={{ color: 'var(--tron-blue)' }}>
          {service.name}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <StaleIndicator lastPollAt={service.lastPollAt} />
      </div>
    </motion.div>
  )
}
