import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectViewport } from './detect.js';

// Test state holders
let mockLocationSearch = '';
let mockUserAgent = '';
let mockMatches: Record<string, boolean> = {};

function installMatchMediaMock() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: mockMatches[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function installLocationMock() {
  Object.defineProperty(window, 'location', {
    value: { search: mockLocationSearch },
    writable: true,
    configurable: true,
  });
}

function installUserAgentMock() {
  Object.defineProperty(window.navigator, 'userAgent', {
    get: () => mockUserAgent,
    configurable: true,
  });
}

beforeEach(() => {
  mockLocationSearch = '';
  mockUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
  mockMatches = {};
  installMatchMediaMock();
  installLocationMock();
  installUserAgentMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectViewport — URL query param override (D-03)', () => {
  it('returns kiosk when ?viewport=kiosk', () => {
    mockLocationSearch = '?viewport=kiosk';
    installLocationMock();
    expect(detectViewport()).toBe('kiosk');
  });

  it('returns iphone-portrait when ?viewport=iphone-portrait', () => {
    mockLocationSearch = '?viewport=iphone-portrait';
    installLocationMock();
    expect(detectViewport()).toBe('iphone-portrait');
  });

  it('returns iphone-landscape when ?viewport=iphone-landscape', () => {
    mockLocationSearch = '?viewport=iphone-landscape';
    installLocationMock();
    expect(detectViewport()).toBe('iphone-landscape');
  });

  it('returns desktop when ?viewport=desktop', () => {
    mockLocationSearch = '?viewport=desktop';
    installLocationMock();
    expect(detectViewport()).toBe('desktop');
  });

  it('ignores unknown query values and falls through to UA/matchMedia', () => {
    mockLocationSearch = '?viewport=bogus';
    installLocationMock();
    mockUserAgent = 'Mozilla/5.0 CoruscantKiosk/1.0';
    installUserAgentMock();
    expect(detectViewport()).toBe('kiosk');
  });

  it('URL param beats UA marker when both present', () => {
    mockLocationSearch = '?viewport=iphone-portrait';
    installLocationMock();
    mockUserAgent = 'Mozilla/5.0 CoruscantKiosk/1.0';
    installUserAgentMock();
    expect(detectViewport()).toBe('iphone-portrait');
  });
});

describe('detectViewport — UA substring (D-01)', () => {
  it('returns kiosk when UA contains CoruscantKiosk', () => {
    mockUserAgent = 'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 Chrome/146 Safari/537.36 CoruscantKiosk/1.0';
    installUserAgentMock();
    expect(detectViewport()).toBe('kiosk');
  });

  it('matches regardless of position in UA string', () => {
    mockUserAgent = 'CoruscantKiosk/1.0 Mozilla/5.0';
    installUserAgentMock();
    expect(detectViewport()).toBe('kiosk');
  });

  it('does not match case-sensitively mangled variants', () => {
    mockUserAgent = 'Mozilla/5.0 coruscantkiosk/1.0';
    installUserAgentMock();
    expect(detectViewport()).toBe('desktop');
  });
});

describe('detectViewport — matchMedia iPhone (D-09)', () => {
  it('returns iphone-portrait when iPhone portrait query matches', () => {
    mockMatches = {
      '(orientation: portrait) and (max-width: 500px) and (-webkit-min-device-pixel-ratio: 2)': true,
    };
    installMatchMediaMock();
    expect(detectViewport()).toBe('iphone-portrait');
  });

  it('returns iphone-landscape when iPhone landscape query matches', () => {
    mockMatches = {
      '(orientation: landscape) and (max-width: 950px) and (max-height: 500px) and (-webkit-min-device-pixel-ratio: 2)': true,
    };
    installMatchMediaMock();
    expect(detectViewport()).toBe('iphone-landscape');
  });

  it('prefers portrait when both queries match (impossible in practice but ordering matters)', () => {
    mockMatches = {
      '(orientation: portrait) and (max-width: 500px) and (-webkit-min-device-pixel-ratio: 2)': true,
      '(orientation: landscape) and (max-width: 950px) and (max-height: 500px) and (-webkit-min-device-pixel-ratio: 2)': true,
    };
    installMatchMediaMock();
    expect(detectViewport()).toBe('iphone-portrait');
  });
});

describe('detectViewport — desktop fallthrough (D-10)', () => {
  it('returns desktop when no query param, no UA marker, no iPhone matchMedia', () => {
    expect(detectViewport()).toBe('desktop');
  });

  it('returns desktop, NOT kiosk, for unknown viewports (pivot from research)', () => {
    expect(detectViewport()).toBe('desktop');
  });
});

describe('detectViewport — precedence order (D-04)', () => {
  it('URL param > UA > matchMedia > desktop', () => {
    mockLocationSearch = '?viewport=desktop';
    installLocationMock();
    mockUserAgent = 'Mozilla/5.0 CoruscantKiosk/1.0';
    installUserAgentMock();
    mockMatches = {
      '(orientation: portrait) and (max-width: 500px) and (-webkit-min-device-pixel-ratio: 2)': true,
    };
    installMatchMediaMock();
    expect(detectViewport()).toBe('desktop');
  });

  it('UA > matchMedia when URL param absent', () => {
    mockUserAgent = 'Mozilla/5.0 CoruscantKiosk/1.0';
    installUserAgentMock();
    mockMatches = {
      '(orientation: portrait) and (max-width: 500px) and (-webkit-min-device-pixel-ratio: 2)': true,
    };
    installMatchMediaMock();
    expect(detectViewport()).toBe('kiosk');
  });
});
