export function GridBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Deep-space base layer with two-tone amber+blue seam grid */}
      <div
        className="grid-bg-layer"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'var(--space-deep)',
          backgroundImage: [
            /* Amber structural seams every 120px vertical */
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 119px, rgba(232, 160, 32, 0.15) 119px, rgba(232, 160, 32, 0.15) 120px)',
            /* Cold blue atmosphere seams at 60px offset */
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 59px, rgba(60, 100, 180, 0.06) 59px, rgba(60, 100, 180, 0.06) 60px)',
            /* Amber structural seams every 200px horizontal */
            'repeating-linear-gradient(to right, transparent 0px, transparent 199px, rgba(232, 160, 32, 0.15) 199px, rgba(232, 160, 32, 0.15) 200px)',
            /* Cold blue atmosphere seams at 100px offset horizontal */
            'repeating-linear-gradient(to right, transparent 0px, transparent 99px, rgba(60, 100, 180, 0.06) 99px, rgba(60, 100, 180, 0.06) 100px)',
          ].join(', '),
          willChange: 'transform',
          animation: 'spaceFloat 90s ease-in-out infinite',
        }}
      />
      {/* Nebula glow overlay — faint blue depth in lower-left corner */}
      <div
        className="grid-nebula-layer"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 30% 60%, rgba(20, 40, 100, 0.15) 0%, transparent 60%)',
          animation: 'nebulaBreath 120s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
