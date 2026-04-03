export function SettingsPage() {
  return (
    <div style={{ padding: '0 16px' }}>
      <h1 className="text-heading" style={{ marginBottom: '16px' }}>Settings</h1>
      <p className="text-body" style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Service configuration coming in Phase 3.
      </p>
      <div style={{ marginBottom: '16px' }}>
        <label className="text-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
          Animation Intensity
        </label>
        <input
          type="range"
          min="0"
          max="0.3"
          step="0.01"
          defaultValue="0.18"
          onChange={(e) => {
            document.documentElement.style.setProperty('--grid-pulse-opacity', e.target.value)
          }}
          style={{ width: '100%', maxWidth: '300px' }}
          aria-label="Grid animation intensity"
        />
      </div>
    </div>
  )
}
