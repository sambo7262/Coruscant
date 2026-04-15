import { detectViewport, type Viewport } from './detect.js';

type Listener = (vp: Viewport) => void;
const listeners = new Set<Listener>();
let current: Viewport = typeof window === 'undefined' ? 'desktop' : detectViewport();
let installed = false;

export function installViewportTagger(): void {
  if (typeof window === 'undefined') return;
  // Pitfall 6: idempotency guard — prevents duplicate resize/orientationchange
  // listeners across Vite HMR re-runs.
  if (installed) return;
  installed = true;

  const apply = () => {
    const next = detectViewport();
    if (next !== current) {
      current = next;
      document.documentElement.setAttribute('data-viewport', next);
      listeners.forEach((l) => l(next));
    } else {
      document.documentElement.setAttribute('data-viewport', next);
    }
  };

  apply();

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  };
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
}

export function subscribeViewport(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentViewport(): Viewport {
  return current;
}
