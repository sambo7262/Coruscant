import { useSyncExternalStore } from 'react';
import { subscribeViewport, getCurrentViewport } from './tagger.js';
import type { Viewport } from './detect.js';

export function useViewport(): Viewport {
  return useSyncExternalStore(
    (cb) => subscribeViewport(() => cb()),
    getCurrentViewport,
    getCurrentViewport,
  );
}
