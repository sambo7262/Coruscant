import { describe, it, expect } from 'vitest';
import { installViewportTagger, getCurrentViewport } from './tagger.js';

describe('installViewportTagger', () => {
  // NOTE: installViewportTagger() is idempotent (Pitfall 6 guard). Tests below
  // rely on shared state — the first install sets <html data-viewport>, and
  // subsequent calls are no-ops. Do NOT wipe the attribute between tests or
  // the idempotent call won't re-apply it.

  it('sets <html data-viewport> on install', () => {
    installViewportTagger();
    expect(document.documentElement.getAttribute('data-viewport')).toBeTruthy();
  });

  it('exposes current viewport via getCurrentViewport', () => {
    installViewportTagger();
    expect(getCurrentViewport()).toBe(document.documentElement.getAttribute('data-viewport'));
  });
});
