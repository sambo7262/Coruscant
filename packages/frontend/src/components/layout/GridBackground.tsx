export function GridBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        backgroundColor: 'var(--bg-dominant)',
        backgroundImage: `
          linear-gradient(var(--grid-line-color) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-line-color) 1px, transparent 1px)
        `,
        backgroundSize: 'var(--grid-size) var(--grid-size)',
        pointerEvents: 'none',
      }}
    >
      {/* Vertical pulse sweep */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to bottom, transparent 0%, rgba(0, 200, 255, var(--grid-pulse-opacity)) 50%, transparent 100%)`,
          backgroundSize: '100% 200px',
          animation: 'gridPulseVertical var(--pulse-duration) linear infinite',
          willChange: 'transform',
          opacity: 1,
        }}
      />
      {/* Horizontal pulse sweep */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to right, transparent 0%, rgba(0, 200, 255, calc(var(--grid-pulse-opacity) * 0.6)) 50%, transparent 100%)`,
          backgroundSize: '200px 100%',
          animation: 'gridPulseHorizontal calc(var(--pulse-duration) * 1.3) linear infinite',
          animationDelay: 'calc(var(--pulse-duration) * 0.5)',
          willChange: 'transform',
          opacity: 1,
        }}
      />
    </div>
  )
}
