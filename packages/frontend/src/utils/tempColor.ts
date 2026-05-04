/**
 * Returns a CSS color string on a blue → amber → red scale for WEATHER temperatures.
 * ~55F and below: blue (#00c8ff)
 * ~70F: amber (#E8A020)
 * ~95F and above: red (#FF3B3B)
 */
export function getTempColor(tempF: number): string {
  const stops = [
    { temp: 55, r: 0, g: 200, b: 255 },    // blue
    { temp: 70, r: 232, g: 160, b: 32 },    // amber
    { temp: 95, r: 255, g: 59, b: 59 },     // red
  ]

  if (tempF <= stops[0].temp) return `rgb(${stops[0].r},${stops[0].g},${stops[0].b})`
  if (tempF >= stops[2].temp) return `rgb(${stops[2].r},${stops[2].g},${stops[2].b})`

  let lo = stops[0], hi = stops[1]
  if (tempF > stops[1].temp) { lo = stops[1]; hi = stops[2] }

  const t = (tempF - lo.temp) / (hi.temp - lo.temp)
  const r = Math.round(lo.r + t * (hi.r - lo.r))
  const g = Math.round(lo.g + t * (hi.g - lo.g))
  const b = Math.round(lo.b + t * (hi.b - lo.b))
  return `rgb(${r},${g},${b})`
}
