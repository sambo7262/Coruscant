/**
 * WiringOverlay — Decorative SVG cable-run / PCB-trace overlay
 *
 * Renders static SVG wiring paths behind instrument cards to reinforce
 * the physical panel aesthetic (D-09). Amber at 8% opacity, pointer-events: none.
 */
export function WiringOverlay() {
  return (
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
      viewBox="0 0 800 480"
      preserveAspectRatio="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Thick bundle: horizontal run across bottom panel area */}
      <path
        d="M 50 420 L 200 420 Q 215 420 215 405 L 215 380 Q 215 365 230 365 L 750 365"
        stroke="rgba(232, 160, 32, 0.05)"
        strokeWidth="2.5"
        fill="none"
      />

      {/* Thin trace: upper-left toward center — main data bus */}
      <path
        d="M 20 120 L 80 120 Q 95 120 95 135 L 95 200 Q 95 215 110 215 L 380 215 Q 395 215 395 230 L 395 300"
        stroke="rgba(232, 160, 32, 0.08)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Thin trace: vertical spine from top-right down */}
      <path
        d="M 620 30 L 620 180 Q 620 200 600 200 L 560 200 Q 540 200 540 220 L 540 440"
        stroke="rgba(232, 160, 32, 0.08)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Thin trace: diagonal connector from lower-right corner toward center */}
      <path
        d="M 780 440 L 780 350 Q 780 335 765 335 L 480 335 Q 465 335 465 320 L 465 270"
        stroke="rgba(232, 160, 32, 0.08)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Thick bundle: top panel seam connector */}
      <path
        d="M 60 60 L 260 60 Q 275 60 275 75 L 275 100 Q 275 115 290 115 L 500 115"
        stroke="rgba(232, 160, 32, 0.05)"
        strokeWidth="2.5"
        fill="none"
      />

      {/* Thin trace: cross-panel link mid-height */}
      <path
        d="M 20 280 L 140 280 Q 155 280 155 265 L 155 240 Q 155 225 170 225 L 330 225"
        stroke="rgba(232, 160, 32, 0.08)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Thin trace: right-side vertical drop to banner area */}
      <path
        d="M 720 80 L 720 160 Q 720 175 705 175 L 660 175 Q 645 175 645 190 L 645 400 Q 645 415 630 415 L 580 415"
        stroke="rgba(232, 160, 32, 0.08)"
        strokeWidth="1.5"
        fill="none"
      />

      {/* Thick bundle: horizontal run across bottom of cards area */}
      <path
        d="M 30 400 L 350 400 Q 365 400 365 385 L 365 370"
        stroke="rgba(232, 160, 32, 0.05)"
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  )
}
