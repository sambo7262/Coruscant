import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ServiceStatus } from '@coruscant/shared'
import { ServiceCard } from './ServiceCard.js'

/**
 * RESP-17 hover gate regression test.
 *
 * ServiceCard.tsx gates its setHovered state setters on canHover() from
 * ../../viewport/index.js. canHover() internally calls
 * window.matchMedia('(hover: hover) and (pointer: fine)').matches.
 *
 * These tests stub matchMedia before rendering to prove:
 *   (1) desktop/hover-capable path: mouseEnter flips the border to the amber
 *       hover color.
 *   (2) kiosk/touch path: mouseEnter does NOT flip the border; it remains
 *       at var(--border-rest).
 */

// jsdom normalizes rgba whitespace + strips trailing zeros, so we match on the
// amber RGB triple rather than the exact literal from the component.
const HOVER_BORDER_FRAGMENT = /rgba\(232,\s*160,\s*32,/
const REST_BORDER_FRAGMENT = 'var(--border-rest)'

// Minimal ServiceStatus satisfying the ServiceCard default-variant render path.
// 'radarr' deliberately chosen because it avoids the plex/sabnzbd/nas special cases
// and the pihole ribbon branch — it renders the plain chamfer-card with the
// onMouseEnter/onMouseLeave setHovered handlers under test.
const fakeService: ServiceStatus = {
  id: 'radarr',
  name: 'Radarr',
  tier: 'activity',
  status: 'online',
  lastPollAt: new Date().toISOString(),
  configured: true,
  metrics: {},
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function renderCard() {
  return render(
    <MemoryRouter>
      <ServiceCard service={fakeService} index={0} />
    </MemoryRouter>,
  )
}

describe('ServiceCard hover gate (RESP-17)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('engages hover border on mouseEnter when the device can hover', () => {
    stubMatchMedia(true)
    const { container } = renderCard()
    const card = container.querySelector('.service-card') as HTMLElement
    expect(card).toBeTruthy()

    // Rest state: no hover color
    expect(card.style.border).toContain(REST_BORDER_FRAGMENT)
    expect(card.style.border).not.toMatch(HOVER_BORDER_FRAGMENT)

    fireEvent.mouseEnter(card)

    // Hover state engaged: amber border
    expect(card.style.border).toMatch(HOVER_BORDER_FRAGMENT)
  })

  it('does NOT engage hover border on mouseEnter when the device cannot hover (kiosk/touch)', () => {
    stubMatchMedia(false)
    const { container } = renderCard()
    const card = container.querySelector('.service-card') as HTMLElement
    expect(card).toBeTruthy()

    expect(card.style.border).toContain(REST_BORDER_FRAGMENT)

    fireEvent.mouseEnter(card)

    // Setter gate intercepted: border unchanged
    expect(card.style.border).toContain(REST_BORDER_FRAGMENT)
    expect(card.style.border).not.toMatch(HOVER_BORDER_FRAGMENT)
  })
})
