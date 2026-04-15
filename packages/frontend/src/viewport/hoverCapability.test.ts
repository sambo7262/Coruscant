import { describe, it, expect, afterEach, vi } from 'vitest';
import { canHover } from './hoverCapability.js';

describe('canHover', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns true when matchMedia (hover: hover) and (pointer: fine) matches', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(hover: hover) and (pointer: fine)',
      media: q, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    expect(canHover()).toBe(true);
  });

  it('returns false when matchMedia does not match', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false,
      media: q, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    expect(canHover()).toBe(false);
  });
});
