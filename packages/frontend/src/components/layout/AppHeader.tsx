import { useNavigate } from 'react-router-dom'
import { Settings, List } from 'lucide-react'
import type { NasStatus } from '@coruscant/shared'

interface AppHeaderProps {
  nas: NasStatus | null
}

export function AppHeader({ nas }: AppHeaderProps) {
  const navigate = useNavigate()

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'rgba(13, 17, 23, 0.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0, 200, 255, 0.1)',
      }}
    >
      {/* Title row — 44px height per UI-SPEC */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '44px',
          padding: '0 16px',
        }}
      >
        <span className="text-display" style={{ color: 'var(--tron-blue)' }}>
          CORUSCANT
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => navigate('/settings')}
            aria-label="Open Settings"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--tron-blue)',
              cursor: 'pointer',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Settings size={24} />
          </button>
          <button
            onClick={() => navigate('/logs')}
            aria-label="Open Logs"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--tron-blue)',
              cursor: 'pointer',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <List size={24} />
          </button>
        </div>
      </div>

      {/* NAS stats strip — 44px height per UI-SPEC D-05 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '44px',
          padding: '0 16px',
          borderTop: '1px solid rgba(0, 200, 255, 0.06)',
        }}
      >
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>
            <span className="text-label" style={{ color: 'var(--text-muted)' }}>CPU </span>
            <span className="text-body" style={{ color: 'var(--tron-blue)' }}>
              {nas ? `${Math.round(nas.cpu)}%` : '---'}
            </span>
          </span>
          <span>
            <span className="text-label" style={{ color: 'var(--text-muted)' }}>RAM </span>
            <span className="text-body" style={{ color: 'var(--tron-blue)' }}>
              {nas ? `${Math.round(nas.ram)}%` : '---'}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {nas?.volumes.map((vol) => (
            <span key={vol.name}>
              <span className="text-label" style={{ color: 'var(--text-muted)' }}>{vol.name} </span>
              <span className="text-body" style={{ color: 'var(--tron-blue)' }}>
                {Math.round(vol.usedPercent)}%
              </span>
              {vol.tempC != null && (
                <span className="text-body" style={{ color: 'var(--tron-blue)', marginLeft: '8px' }}>
                  {vol.tempC}&deg;C
                </span>
              )}
            </span>
          )) ?? (
            <span className="text-body" style={{ color: 'var(--text-muted)' }}>---</span>
          )}
        </div>
      </div>
    </header>
  )
}
