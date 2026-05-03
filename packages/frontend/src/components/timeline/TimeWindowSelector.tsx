export type TimeWindow = '24h' | '3d' | '7d'

interface TimeWindowSelectorProps {
  value: TimeWindow
  onChange: (w: TimeWindow) => void
}

const btnBase: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  padding: '8px 16px',
  borderRadius: '3px',
  cursor: 'pointer',
  textTransform: 'uppercase' as const,
  minHeight: '36px',
  whiteSpace: 'nowrap' as const,
}

const WINDOWS: { label: string; value: TimeWindow }[] = [
  { label: '24H', value: '24h' },
  { label: '3D', value: '3d' },
  { label: '7D', value: '7d' },
]

export function TimeWindowSelector({ value, onChange }: TimeWindowSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {WINDOWS.map((w) => {
        const isActive = w.value === value
        return (
          <button
            key={w.value}
            type="button"
            onClick={() => onChange(w.value)}
            style={{
              ...btnBase,
              background: isActive ? 'rgba(232,160,32,0.15)' : 'transparent',
              border: isActive
                ? '1px solid var(--cockpit-amber)'
                : '1px solid var(--border-rest)',
              color: isActive ? 'var(--cockpit-amber)' : 'var(--text-offwhite)',
            }}
          >
            {w.label}
          </button>
        )
      })}
    </div>
  )
}
