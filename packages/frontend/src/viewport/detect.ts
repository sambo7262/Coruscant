export type Viewport = 'kiosk' | 'iphone-portrait' | 'iphone-landscape' | 'desktop';

const VALID_VIEWPORTS: Record<string, Viewport> = {
  'kiosk': 'kiosk',
  'iphone-portrait': 'iphone-portrait',
  'iphone-landscape': 'iphone-landscape',
  'desktop': 'desktop',
};

const IPHONE_PORTRAIT_QUERY =
  '(orientation: portrait) and (max-width: 500px) and (-webkit-min-device-pixel-ratio: 2)';
const IPHONE_LANDSCAPE_QUERY =
  '(orientation: landscape) and (max-width: 950px) and (max-height: 500px) and (-webkit-min-device-pixel-ratio: 2)';

const KIOSK_UA_TOKEN = 'CoruscantKiosk';

/**
 * Pure viewport detection — same precedence as the inline <head> script.
 * SSR-safe: returns 'desktop' when window is undefined.
 *
 * Precedence (D-04):
 *   1. URL query param ?viewport=...
 *   2. navigator.userAgent contains 'CoruscantKiosk'
 *   3. matchMedia iPhone portrait / landscape (DPR>=2 gated)
 *   4. Fallthrough → 'desktop'
 */
export function detectViewport(): Viewport {
  if (typeof window === 'undefined') return 'desktop';

  // 1. URL query param override
  const params = new URLSearchParams(window.location.search);
  const override = params.get('viewport');
  if (override && VALID_VIEWPORTS[override]) {
    return VALID_VIEWPORTS[override];
  }

  // 2. UA substring — kiosk marker
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes(KIOSK_UA_TOKEN)) {
    return 'kiosk';
  }

  // 3. matchMedia iPhone queries (DPR>=2 gated)
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia(IPHONE_PORTRAIT_QUERY).matches) return 'iphone-portrait';
    if (window.matchMedia(IPHONE_LANDSCAPE_QUERY).matches) return 'iphone-landscape';
  }

  // 4. Fallthrough — desktop
  return 'desktop';
}
