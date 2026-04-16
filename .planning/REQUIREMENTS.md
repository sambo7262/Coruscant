# Requirements: Coruscant v1.2 — iPhone Responsive Polish

**Hard constraint:** The 800×480 Raspberry Pi kiosk layout must remain pixel-identical. All requirements below target iPhone portrait + iPhone landscape only. Any change that regresses the kiosk at 800×480 is a failure, even if the iPhone work is correct.

## Kiosk Isolation Infrastructure

- [x] **RESP-01**: A runtime viewport module tags `<html data-viewport="kiosk" | "iphone-portrait" | "iphone-landscape" | "desktop">` before first paint, driven by an inline blocking `<head>` script so the correct attribute is set before React mounts
- [x] **RESP-02**: A CI/pre-commit lint (`verify-viewport-isolation.mjs`) asserts every selector in the iPhone stylesheet begins with `html[data-viewport^="iphone"]` and fails the build on any `!important` or `@media` inside that file
- [x] **RESP-03**: A canonical kiosk visual baseline is captured at 800×480 and committed; every phase close gates on a zero-pixel-diff against this baseline
- [x] **RESP-04**: Inline `style={{…}}` layout values on CardGrid, ServiceCard, AppHeader, NowPlayingBanner, and PiHealthPanel are extracted into className rules so CSS can override them from iPhone scope without `!important`

## iPhone Portrait

- [x] **RESP-05**: `<meta viewport-fit=cover>` is set and `env(safe-area-inset-*)` padding is applied to the header (top inset), NowPlayingBanner (bottom inset), and any edge-anchored element so content never hides behind the notch or home indicator
- [x] **RESP-06**: Dashboard tiles render in a single-column grid in iPhone portrait with padding and gap values scaled down from kiosk defaults, and all tiles fit within the viewport without horizontal scroll
- [x] **RESP-07**: Typography and LED sizing in iPhone portrait are calibrated for arm's-length viewing (~30 cm) — body, labels, metric numerals, tile headers, and the CORUSCANT title all render legibly at hand-held distance while preserving the cockpit aesthetic
- [ ] **RESP-08**: All interactive elements (tiles, LEDs, title bar, banner expand, settings rows) have touch targets of at least 44×44 pt in iPhone portrait per Apple HIG
- [x] **RESP-09**: `100vh` is replaced by `100dvh` in iPhone scope so the NowPlayingBanner and other viewport-height-relying elements do not jump when Safari's address bar collapses
- [ ] **RESP-10**: NowPlayingBanner renders as a mini-bar (56–64 pt tall, plus safe-area bottom inset) in iPhone portrait following the Apple Music / Spotify / Plex pattern, with main content `padding-bottom` adjusted so the last tile is never hidden under the banner
- [ ] **RESP-11**: AppHeader renders as a compact title bar in iPhone portrait (with safe-area top inset), and Pi health severity colors on the CORUSCANT title (amber/warning/critical) remain unmistakable at the compressed height
- [ ] **RESP-12**: The expandable Pi health panel adapts to the iPhone portrait width so all 6 metric rows remain readable without horizontal scroll or truncation

## iPhone Landscape

- [ ] **RESP-13**: Dashboard tiles render in a 2-column grid in iPhone landscape so vertical content fits within the ~320–360 pt available after safe areas, while the 800×480 kiosk is untouched
- [ ] **RESP-14**: NowPlayingBanner renders with a landscape-specific variant (either inline strip or further-compressed mini-bar) that reclaims vertical space and honors `env(safe-area-inset-left)` / `env(safe-area-inset-right)` for Dynamic Island clearance
- [ ] **RESP-15**: Orientation transitions (portrait ↔ landscape) re-tag the viewport, re-measure Framer Motion layouts, and settle without layout thrash or animation glitches on iOS 17+
- [ ] **RESP-16**: AppHeader landscape variant compresses title bar height further while still conveying Pi health severity and weather

## Quality & Guardrails

- [x] **RESP-17**: `:hover` rules in iPhone scope are wrapped in `@media (hover: hover) and (pointer: fine)` so iOS taps do not leave sticky ghost-hover LED glows
- [x] **RESP-18**: Marquee and other animated text in iPhone scope uses `filter: drop-shadow()` on a compositing-layer parent (not stacked `text-shadow`) to avoid paint storms on DPR-3 iPhones
- [ ] **RESP-19**: Every phase close verifies kiosk pixel-diff = zero at 800×480, real iPhone portrait + landscape smoke test, and CI grep/lint gates green before proceeding

## Future Requirements

*(Table-stakes features recognized during research but deferred beyond v1.2)*

- Playwright visual regression automation (graduate from manual diffs — optional during landscape phase)
- PWA install manifest (home-screen add, themed status bar)
- iPad portrait/landscape layout
- Full accessibility pass (`prefers-reduced-motion`, high-contrast, VoiceOver labels on LEDs and tiles)

## Out of Scope

- **Changing the 800×480 kiosk layout in any way** — kiosk is the hard constraint; only iPhone-targeted changes land in v1.2
- **New device targets** — Android Chrome, iPad, in-app browsers
- **New features / new tiles / new data sources** — v1.2 is pure responsive polish on existing UI
- **Dark mode toggle / alternate themes** — cockpit aesthetic stays the only theme
- **Offline/PWA install** — deferred to future milestone
- **Media query-based scoping** — attribute selectors only; no `@media (max-width: …)` in iPhone CSS
- **`!important` as a specificity hammer** — hard banned in iPhone scope
- **Modifying `:root` CSS tokens in globals.css** — iPhone overrides live exclusively under `html[data-viewport^="iphone"]` selectors
- **Changes to SSE polling, data contracts, backend** — v1.2 is frontend-only

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RESP-01 | Phase 14 — Kiosk-Isolation Infrastructure | Complete |
| RESP-02 | Phase 14 — Kiosk-Isolation Infrastructure | Complete |
| RESP-03 | Phase 14 — Kiosk-Isolation Infrastructure | Complete |
| RESP-04 | Phase 14 — Kiosk-Isolation Infrastructure | Complete |
| RESP-05 | Phase 15 — iPhone Portrait | Complete |
| RESP-06 | Phase 15 — iPhone Portrait | Complete |
| RESP-07 | Phase 15 — iPhone Portrait | Complete |
| RESP-08 | Phase 15 — iPhone Portrait | Pending |
| RESP-09 | Phase 15 — iPhone Portrait | Complete |
| RESP-10 | Phase 15 — iPhone Portrait | Pending |
| RESP-11 | Phase 15 — iPhone Portrait | Pending |
| RESP-12 | Phase 15 — iPhone Portrait | Pending |
| RESP-13 | Phase 16 — iPhone Landscape | Pending |
| RESP-14 | Phase 16 — iPhone Landscape | Pending |
| RESP-15 | Phase 16 — iPhone Landscape | Pending |
| RESP-16 | Phase 16 — iPhone Landscape | Pending |
| RESP-17 | Phase 14 — Kiosk-Isolation Infrastructure | Complete |
| RESP-18 | Phase 15 — iPhone Portrait | Complete |
| RESP-19 | Phases 14, 15, 16 — per-phase close gate (appears in every phase's success criteria) | Pending |

**Coverage:** 19/19 requirements mapped. Every RESP-XX maps to exactly one phase, except RESP-19 which is a cross-phase close gate codified in each phase's success criteria.

---
*Created: 2026-04-15 — based on v1.2 research SUMMARY.md*
*Traceability filled: 2026-04-15 — roadmapper agent*
