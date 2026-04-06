import { useState, useEffect, useRef } from 'react'

/**
 * Animates a numeric value from its previous to its new value using
 * an ease-out cubic tween. Returns the current display value (integer).
 *
 * Features:
 * - 400ms duration, ease-out cubic (D-19: 300–500ms range)
 * - Delta guard: skips animation when |delta| < 0.5 (prevents flicker on
 *   rapid 1s NAS polls where values barely change — Pitfall 7)
 * - Cleans up requestAnimationFrame on unmount and on value change
 */
export function useAnimatedNumber(value: number, duration = 400): number {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const frameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = value

    if (prev === value) return

    // Skip animation if delta is tiny (< 0.5 — prevents flicker on rapid polls)
    if (Math.abs(value - prev) < 0.5) {
      setDisplay(value)
      return
    }

    const start = performance.now()

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic: decelerate as it approaches target
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(prev + (value - prev) * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
    }
  }, [value, duration])

  return Math.round(display)
}
