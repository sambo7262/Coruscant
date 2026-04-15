/** Returns true if the device supports a real hover-capable pointer (mouse/trackpad). */
export function canHover(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}
