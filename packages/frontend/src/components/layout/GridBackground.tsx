export function GridBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        backgroundColor: '#0A0A0A',
        backgroundImage: [
          'repeating-linear-gradient(to bottom, transparent 0px, transparent 119px, rgba(232, 160, 32, 0.15) 119px, rgba(232, 160, 32, 0.15) 120px)',
          'repeating-linear-gradient(to right, transparent 0px, transparent 199px, rgba(232, 160, 32, 0.15) 199px, rgba(232, 160, 32, 0.15) 200px)',
        ].join(', '),
        pointerEvents: 'none',
      }}
    />
  )
}
