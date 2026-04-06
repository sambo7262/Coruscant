/**
 * WeatherIcon — Animated SVG weather icons for 7 condition types.
 * All animations use CSS @keyframes on transform and opacity only — GPU-composited, ARM64-safe (DASH-08).
 * Colors: amber strokes (#E8A020) and warm fills (rgba(232, 160, 32, 0.3)).
 */

interface WeatherIconProps {
  wmoCode: number
  size?: number
}

type IconType = 'sun' | 'partlyCloudy' | 'overcast' | 'fog' | 'rain' | 'snow' | 'storm'

function getIconType(wmoCode: number): IconType {
  if (wmoCode === 0) return 'sun'
  if (wmoCode === 1 || wmoCode === 2) return 'partlyCloudy'
  if (wmoCode === 3) return 'overcast'
  if (wmoCode === 45 || wmoCode === 48) return 'fog'
  if (
    wmoCode === 51 || wmoCode === 53 || wmoCode === 55 ||
    wmoCode === 56 || wmoCode === 57 ||
    wmoCode === 61 || wmoCode === 63 || wmoCode === 65 ||
    wmoCode === 66 || wmoCode === 67 ||
    wmoCode === 80 || wmoCode === 81 || wmoCode === 82
  ) return 'rain'
  if (
    wmoCode === 71 || wmoCode === 73 || wmoCode === 75 || wmoCode === 77 ||
    wmoCode === 85 || wmoCode === 86
  ) return 'snow'
  if (wmoCode === 95 || wmoCode === 96 || wmoCode === 99) return 'storm'
  return 'overcast'
}

function SunIcon({ size }: { size: number }) {
  const cx = 16, cy = 16, r = 6
  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 * Math.PI) / 180
    const innerR = 9, outerR = 13
    const x1 = cx + innerR * Math.cos(angle)
    const y1 = cy + innerR * Math.sin(angle)
    const x2 = cx + outerR * Math.cos(angle)
    const y2 = cy + outerR * Math.sin(angle)
    return { x1, y1, x2, y2 }
  })

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <g style={{ transformOrigin: '16px 16px', animation: 'weatherSunRotate 20s linear infinite' }}>
        {rays.map((ray, i) => (
          <line
            key={i}
            x1={ray.x1} y1={ray.y1}
            x2={ray.x2} y2={ray.y2}
            stroke="#E8A020"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="rgba(232, 160, 32, 0.3)" stroke="#E8A020" strokeWidth="1.5" />
    </svg>
  )
}

function PartlyCloudyIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Sun behind cloud */}
      <circle cx="20" cy="12" r="5" fill="rgba(232, 160, 32, 0.3)" stroke="#E8A020" strokeWidth="1.2" />
      {/* Cloud — drifts slightly */}
      <g style={{ animation: 'weatherCloudDrift 6s ease-in-out infinite' }}>
        <path
          d="M8 22 C8 18 11 16 14 17 C15 14 18 13 20 15 C23 15 25 17 25 20 C25 22 24 23 22 23 H10 C8.9 23 8 22.5 8 22Z"
          fill="rgba(232, 160, 32, 0.3)"
          stroke="#E8A020"
          strokeWidth="1.2"
        />
      </g>
    </svg>
  )
}

function OvercastIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <g style={{ animation: 'weatherBreathe 4s ease-in-out infinite' }}>
        {/* Back cloud */}
        <path
          d="M6 20 C6 17 9 15 12 16 C13 13 17 12 19 14 C22 14 24 16 24 18 C24 20 23 21 21 21 H8 C6.9 21 6 20.5 6 20Z"
          fill="rgba(232, 160, 32, 0.15)"
          stroke="rgba(232, 160, 32, 0.4)"
          strokeWidth="1.2"
        />
        {/* Front cloud */}
        <path
          d="M8 24 C8 21 11 19 14 20 C15 17 18 16 21 18 C24 18 26 20 26 22 C26 24 25 25 23 25 H10 C8.9 25 8 24.5 8 24Z"
          fill="rgba(232, 160, 32, 0.3)"
          stroke="#E8A020"
          strokeWidth="1.2"
        />
      </g>
    </svg>
  )
}

function FogIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {[{ y: 10, delay: '0s' }, { y: 16, delay: '1s' }, { y: 22, delay: '0.5s' }].map(({ y, delay }, i) => (
        <line
          key={i}
          x1="6" y1={y}
          x2="26" y2={y}
          stroke="#E8A020"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ animation: `weatherFogFade 5s ease-in-out infinite`, animationDelay: delay }}
        />
      ))}
    </svg>
  )
}

function RainIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Cloud */}
      <path
        d="M7 14 C7 11 10 9 13 10 C14 7 18 6 20 8 C23 8 25 10 25 12 C25 14 24 15 22 15 H9 C7.9 15 7 14.5 7 14Z"
        fill="rgba(232, 160, 32, 0.3)"
        stroke="#E8A020"
        strokeWidth="1.2"
      />
      {/* Rain drops — 3 staggered */}
      {[{ x: 11, delay: '0s' }, { x: 16, delay: '0.7s' }, { x: 21, delay: '0.35s' }].map(({ x, delay }, i) => (
        <line
          key={i}
          x1={x} y1="17"
          x2={x - 1} y2="24"
          stroke="#E8A020"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ animation: `weatherRainDrop 2s ease-in infinite`, animationDelay: delay }}
        />
      ))}
    </svg>
  )
}

function SnowIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Cloud */}
      <path
        d="M7 14 C7 11 10 9 13 10 C14 7 18 6 20 8 C23 8 25 10 25 12 C25 14 24 15 22 15 H9 C7.9 15 7 14.5 7 14Z"
        fill="rgba(232, 160, 32, 0.3)"
        stroke="#E8A020"
        strokeWidth="1.2"
      />
      {/* Snowflake dots — 3 staggered */}
      {[{ cx: 11, delay: '0s' }, { cx: 16, delay: '0.6s' }, { cx: 21, delay: '1.2s' }].map(({ cx, delay }, i) => (
        <circle
          key={i}
          cx={cx} cy="21"
          r="1.5"
          fill="#E8A020"
          style={{ animation: `weatherSnowDrift 4s ease-in infinite`, animationDelay: delay }}
        />
      ))}
    </svg>
  )
}

function StormIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Cloud */}
      <path
        d="M7 14 C7 11 10 9 13 10 C14 7 18 6 20 8 C23 8 25 10 25 12 C25 14 24 15 22 15 H9 C7.9 15 7 14.5 7 14Z"
        fill="rgba(232, 160, 32, 0.3)"
        stroke="#E8A020"
        strokeWidth="1.2"
      />
      {/* Lightning bolt */}
      <path
        d="M18 17 L14 23 L17 23 L13 29 L20 21 L17 21 Z"
        fill="rgba(232, 160, 32, 0.3)"
        stroke="#E8A020"
        strokeWidth="1.2"
        strokeLinejoin="round"
        style={{ animation: 'weatherBoltFlash 3s ease-in-out infinite' }}
      />
    </svg>
  )
}

export function WeatherIcon({ wmoCode, size = 30 }: WeatherIconProps) {
  const iconType = getIconType(wmoCode)

  switch (iconType) {
    case 'sun':
      return <SunIcon size={size} />
    case 'partlyCloudy':
      return <PartlyCloudyIcon size={size} />
    case 'overcast':
      return <OvercastIcon size={size} />
    case 'fog':
      return <FogIcon size={size} />
    case 'rain':
      return <RainIcon size={size} />
    case 'snow':
      return <SnowIcon size={size} />
    case 'storm':
      return <StormIcon size={size} />
    default:
      return <OvercastIcon size={size} />
  }
}
