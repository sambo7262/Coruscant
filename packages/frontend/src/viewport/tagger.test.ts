import { describe, it, expect, beforeEach } from 'vitest';
import { installViewportTagger, getCurrentViewport } from './tagger.js';

describe('installViewportTagger', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-viewport');
  });

  it('sets <html data-viewport> on install', () => {
    installViewportTagger();
    expect(document.documentElement.getAttribute('data-viewport')).toBeTruthy();
  });

  it('exposes current viewport via getCurrentViewport', () => {
    installViewportTagger();
    expect(getCurrentViewport()).toBe(document.documentElement.getAttribute('data-viewport'));
  });
});
