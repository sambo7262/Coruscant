import { Link } from 'react-router-dom'
import { Settings, List } from 'lucide-react'
import type { NasStatus } from '@coruscant/shared'

interface AppHeaderProps {
  nas: NasStatus | null
  connected: boolean
  showBack?: boolean
}

export function AppHeader({ nas, connected, showBack = false }: AppHeaderProps) {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'rgba(13, 13, 13, 0.95)',
        backdropFilter: 'blur(4px)',
        borderBottom: '1px solid rgba(232, 160, 32, 0.30)',
        boxShadow: '0 1px 8px rgba(232, 160, 32, 0.15)',
      }}
    >
      {/* Title row — 44px height */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '44px',
          padding: '0 16px',
        }}
      >
        {showBack ? (
          <Link
            to="/"
            className="text-display"
            style={{
              color: 'var(--cockpit-amber)',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            ← CORUSCANT
          </Link>
        ) : (
          <span className="text-display" style={{ color: 'var(--cockpit-amber)' }}>
            CORUSCANT
          </span>
        )}
        {!showBack && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <Link
              to="/settings"
              aria-label="Open Settings"
              style={{
                color: 'var(--cockpit-amber)',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={24} />
            </Link>
            <Link
              to="/logs"
              aria-label="Open Logs"
              style={{
                color: 'var(--cockpit-amber)',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <List size={24} />
            </Link>
          </div>
        )}
      </div>

      {/* NAS stats strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '28px',
          padding: '0 16px',
          borderTop: '1px solid rgba(232, 160, 32, 0.10)',
        }}
      >
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {!connected && (
            <span
              title="Connection lost. Reconnecting..."
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--cockpit-amber)',
                boxShadow: '0 0 6px 2px rgba(232, 160, 32, 0.6)',
                animation: 'ledPulseWarn 1s ease-in-out infinite',
                flexShrink: 0,
              }}
            />
          )}
          <span>
            <span className="text-label" style={{ color: 'var(--text-offwhite)' }}>CPU </span>
            <span className="text-body" style={{ color: 'var(--cockpit-amber)' }}>
              {nas ? `${Math.round(nas.cpu)}%` : '---'}
            </span>
          </span>
          <span>
            <span className="text-label" style={{ color: 'var(--text-offwhite)' }}>RAM </span>
            <span className="text-body" style={{ color: 'var(--cockpit-amber)' }}>
              {nas ? `${Math.round(nas.ram)}%` : '---'}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {nas?.volumes.map((vol) => (
            <span key={vol.name}>
              <span className="text-label" style={{ color: 'var(--text-offwhite)' }}>{vol.name} </span>
              <span className="text-body" style={{ color: 'var(--cockpit-amber)' }}>
                {Math.round(vol.usedPercent)}%
              </span>
              {vol.tempC != null && (
                <span className="text-body" style={{ color: 'var(--cockpit-amber)', marginLeft: '8px' }}>
                  {vol.tempC}&deg;C
                </span>
              )}
            </span>
          )) ?? (
            <span className="text-body" style={{ color: 'var(--text-offwhite)' }}>---</span>
          )}
        </div>
      </div>
    </header>
  )
}
