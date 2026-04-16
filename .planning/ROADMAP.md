# Roadmap: Coruscant

## Milestones

- ✅ **v1.0 MVP** — Phases 1-11 (shipped 2026-04-07) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Pi Health Monitoring** — Phases 12-13 (shipped 2026-04-15)
- 🚧 **v1.2 iPhone Responsive Polish** — Phases 14-16 (in progress)

## Phases

- [x] **Phase 12: Pi Health Backend & Settings** - Backend adapter polls Pi health endpoint with configurable host, error handling, and debug diagnostics (completed 2026-04-07)
- [x] **Phase 13: Title Bar Alerts & Detail View** - CORUSCANT title reflects Pi health severity; tapping opens full diagnostics view (completed 2026-04-15)
- [x] **Phase 14: Kiosk-Isolation Infrastructure** - Viewport tagger, CI isolation lint, meta tags, kiosk baseline, and inline-style extraction sweep — zero visible iPhone change, rails proven kiosk-safe (completed 2026-04-16)
- [ ] **Phase 15: iPhone Portrait** - Portrait CSS overrides scoped under `html[data-viewport="iphone-portrait"]` — mini-bar banner, compact header, Pi health panel adaptation, safe-area insets
- [ ] **Phase 16: iPhone Landscape** - Landscape CSS overrides scoped under `html[data-viewport="iphone-landscape"]` — 2-column grid, landscape banner variant, orientation transition hardening

## Phase Details

### Phase 12: Pi Health Backend & Settings
**Goal**: Pi health data flows from the Raspberry Pi into the Coruscant SSE snapshot, configurable through the Settings page
**Depends on**: v1.0 shipped (existing SSE pipeline, Settings page, polling infrastructure)
**Requirements**: PIHEALTH-01, PIHEALTH-02, PIHEALTH-03, PIHEALTH-04, PIHEALTH-05, PIHEALTH-10
**Success Criteria** (what must be TRUE):
  1. Dashboard SSE snapshot includes Pi health metrics (temperature, CPU, memory, throttle flags, WiFi RSSI, NAS latency, SD free space, uptime, display status) when Pi is reachable
  2. When Pi is offline or unreachable, dashboard continues working and Pi health section shows stale/error state instead of crashing
  3. User can configure Pi host IP and port in the Settings page, and test the connection before saving
  4. GET /debug/pi-health returns the raw Pi health endpoint response for troubleshooting
  5. User can restart the Pi health service from Settings via SSH (password prompted at use time, not stored)
**Plans:** 2/2 plans complete
Plans:
- [x] 12-01-PLAN.md — Pi health types, adapter, and PollManager integration
- [x] 12-02-PLAN.md — Settings CRUD, test-connection, debug endpoint, SSH restart route

### Phase 13: Title Bar Alerts & Detail View
**Goal**: Users see Pi health status at a glance through the CORUSCANT title bar and can tap through to full diagnostics
**Depends on**: Phase 12 (Pi health data in SSE snapshot)
**Requirements**: PIHEALTH-06, PIHEALTH-07, PIHEALTH-08, PIHEALTH-09, PIHEALTH-11
**Success Criteria** (what must be TRUE):
  1. CORUSCANT title text is default amber when normal, brighter amber when warning, red with pulse when critical
  2. Tapping CORUSCANT on the home page expands an inline panel with 6 Pi health metrics (CPU temp, CPU%, memory, throttle flags, WiFi signal, NAS latency); tapping again dismisses it
  3. On sub-pages, tapping CORUSCANT navigates back to dashboard (existing behavior preserved)
  4. Stale Pi data shown with dimmed values and "Last seen" timestamp
  5. Now Playing stream title text glows warm amber when that stream is transcoding
**Plans:** 2/2 plans complete
Plans:
- [x] 13-01-PLAN.md — Title bar severity styling + Pi health expand panel
- [x] 13-02-PLAN.md — Now Playing transcode glow indicator
**UI hint**: yes

### Phase 14: Kiosk-Isolation Infrastructure
**Goal**: All rails for iPhone responsive work are in place and provably kiosk-safe — no visible iPhone changes yet
**Depends on**: v1.1 shipped (React 19 + Vite 8 frontend, validated 800x480 kiosk layout)
**Requirements**: RESP-01, RESP-02, RESP-03, RESP-04, RESP-17
**Success Criteria** (what must be TRUE):
  1. On hard-reload of any route, `<html>` carries a `data-viewport` attribute of `kiosk`, `iphone-portrait`, `iphone-landscape`, or `desktop` BEFORE first paint — set by an inline blocking `<head>` script, not a React effect
  2. CI and pre-commit fail the build if any selector in `viewport-iphone.css` does not begin with `html[data-viewport^="iphone"]`, or if the file contains `!important` or `@media`
  3. A canonical 800x480 kiosk visual baseline (home, services/plex, settings, logs) is committed to the repo and the Phase 14 close shows zero-pixel diff against it
  4. CardGrid, ServiceCard, AppHeader, NowPlayingBanner, and PiHealthPanel no longer carry layout-affecting inline `style={{...}}` values — those values live as className rules on `:root` tokens so iPhone scope can override without `!important`
  5. All existing `:hover` rules in the codebase are wrapped in `@media (hover: hover) and (pointer: fine)` so a future iOS tap cannot leave sticky ghost-hover LED glows
  6. Phase 14 close gate: kiosk pixel-diff = zero at 800x480, CI lint + vitest green, and the dashboard on the real Raspberry Pi kiosk looks identical to before
**Plans**: 6 plans
- [x] 14-01-PLAN.md — Viewport module (detect/tagger/useViewport/hoverCapability) + inline <head> script + main.tsx wiring [RESP-01, RESP-03 mechanism-satisfied]
- [x] 14-02-PLAN.md — Zero-dep isolation lint script + self-test fixtures + frontend lint script [RESP-02]
- [x] 14-03-PLAN.md — viewport-fit=cover + color-scheme=dark meta tags + empty viewport-iphone.css placeholder + main.tsx import [RESP-01]
- [x] 14-04-PLAN.md — Tile-sizing tokens + ~38 className rules + inline-style extraction across CardGrid/ServiceCard/AppHeader/NowPlayingBanner/PiHealthPanel [RESP-04]
- [x] 14-05-PLAN.md — ServiceCard hover state gated on canHover() + matchMedia test [RESP-17]
- [x] 14-06-PLAN.md — husky 9 + lint-staged 16 install + .husky/pre-commit + .github/workflows/ci.yml [RESP-02]

Task sequence (non-negotiable per research SUMMARY.md):
  - T1: Viewport module (`src/viewport/`) — `detect.ts` with kiosk exact-match first and iPhone queries gated on DPR >= 2, `tagger.ts` with rAF-debounced resize, `useViewport.ts` via `useSyncExternalStore`, 7-device matchMedia vitest matrix; installed in `main.tsx` before `createRoot`
  - T2: CI lint `scripts/verify-viewport-isolation.mjs` + grep guards for `!important` and `@media`, wired into package.json lint + CI + pre-commit
  - T3: `<meta name="viewport" content="..., viewport-fit=cover">` + `<meta name="color-scheme" content="dark">` in `index.html`; empty `src/styles/viewport-iphone.css` imported AFTER `globals.css`
  - T4: Kiosk visual baseline capture at 800x480 (home, services/plex, settings, logs) committed to `packages/frontend/test/visual/kiosk-baseline/`
  - T5: Path-A inline-style extraction sweep on CardGrid, ServiceCard, AppHeader, NowPlayingBanner, PiHealthPanel — move layout inline values to classNames; add tile-sizing tokens (`--tile-padding`, `--tile-gap`, `--tile-font-label`, `--tile-font-value`, `--led-size`) on `:root` with current kiosk defaults; per-component kiosk diff = zero
  - T6: `:hover` gating sweep (RESP-17) across existing CSS
  - T7: Phase 14 close gate — lint + vitest + kiosk pixel diff = zero + real-kiosk smoke

### Phase 15: iPhone Portrait
**Goal**: The dashboard is comfortable to read and operate on a real iPhone in portrait, with the 800x480 kiosk layout untouched
**Depends on**: Phase 14 (viewport rails, lint, baseline, extracted components)
**Requirements**: RESP-05, RESP-06, RESP-07, RESP-08, RESP-09, RESP-10, RESP-11, RESP-12, RESP-18
**Success Criteria** (what must be TRUE):
  1. On a real iPhone in portrait, dashboard tiles render in a single-column grid with no horizontal scroll, padding/gap scaled down from kiosk defaults, and body/labels/metric numerals legible at arm's-length (~30 cm) viewing distance
  2. Header (top inset), NowPlayingBanner (bottom inset), and edge-anchored elements clear the notch and home indicator via `env(safe-area-inset-*)` padding, and `100dvh` replaces `100vh` in iPhone scope so banner position does not jump when Safari's URL bar collapses
  3. NowPlayingBanner renders as a 56-64 pt mini-bar above the home indicator with main-content `padding-bottom` adjusted so the last tile is never hidden beneath it; marquee uses `filter: drop-shadow()` on a composited parent (not stacked `text-shadow`) and produces no paint >16.6 ms on DPR-3 iPhones
  4. AppHeader renders as a compact title bar in which Pi health severity (normal amber / warning / critical red-pulse) remains unmistakable, and the expandable Pi health panel shows all 6 metric rows readable without horizontal scroll or truncation
  5. Every interactive element (tiles, LEDs, title bar, banner expand, settings rows) has a touch target >= 44x44 pt
  6. Phase 15 close gate: kiosk pixel-diff = zero at 800x480, CI lint + vitest green, real iPhone 15 portrait smoke test passes
**Plans:** 3/5 plans executed
Plans:
- [x] 15-01-PLAN.md — Portrait CSS foundation: token overrides, grid, safe-area, typography, touch targets, scroll, 100dvh, RESP-18 drop-shadow
- [x] 15-02-PLAN.md — AppHeader portrait: useViewport to hide clock + logs icon, disable useLocalClock timer
- [x] 15-03-PLAN.md — NowPlayingBanner portrait: useViewport for Framer Motion mini-bar heights, RESP-18 transcode glow fix
- [ ] 15-04-PLAN.md — App.tsx + pages adaptations: body overflow, main padding, LogsPage 100dvh, SettingsPage stacking
- [ ] 15-05-PLAN.md — Close gate: automated checks + real iPhone 15 portrait smoke test + kiosk regression check
**UI hint**: yes

### Phase 16: iPhone Landscape
**Goal**: The dashboard adapts cleanly to iPhone landscape (distinct from the 800x480 kiosk aspect) and survives repeated portrait-landscape rotation without layout thrash
**Depends on**: Phase 14 (viewport rails, lint, baseline, extracted components) — NOT Phase 15; portrait and landscape are independent CSS branches on shared rails
**Requirements**: RESP-13, RESP-14, RESP-15, RESP-16
**Success Criteria** (what must be TRUE):
  1. On a real iPhone in landscape, dashboard tiles render in a 2-column grid that fits the ~320-360 pt available vertical space after safe areas, while a test gated on exact `(width: 800px) and (height: 480px)` confirms the kiosk still resolves to `data-viewport="kiosk"` and 932x430 resolves to `iphone-landscape`
  2. NowPlayingBanner renders with a landscape-specific variant that reclaims vertical space and honors `env(safe-area-inset-left)` / `env(safe-area-inset-right)` for Dynamic Island clearance
  3. AppHeader landscape variant further compresses title bar height while still conveying Pi health severity and weather legibly
  4. Rotating the real iPhone portrait-landscape repeatedly re-tags `data-viewport`, re-measures Framer Motion layouts, and settles without jank, double-fire, or animation glitches on iOS 17+
  5. Phase 16 close gate: kiosk pixel-diff = zero at 800x480, CI lint + vitest green, real iPhone 15 portrait + landscape + rotation smoke test passes, 18-item "Looks done but isn't" checklist passes
**Plans**: TBD
**UI hint**: yes

## Backlog

### Phase 999.1: CRT Signal Interference Screen Refresh Animation (BACKLOG)

**Goal:** Periodic full-screen "signal interference" animation — a horizontal static-noise band sweeps top-to-bottom on a configurable interval, doubling as a pixel refresh mechanism for the Raspberry Pi kiosk display

### Phase 999.2: Plex Now Playing — Vertical Bar Stats (BACKLOG)

**Goal:** Add vertical bar meters (instrument-panel style) to the right side of each Now Playing stream row, showing bitrate and transcode load at a glance without expanding the tile

## Known Gaps (deferred from v1.0)

| Requirement | Description | Reason Deferred |
|-------------|-------------|-----------------|
| NET-03 | UniFi detail view with per-device uptime/model/clients | Frontend plan not executed |
| NOTIF-02-06 | Pushover threshold alerts (offline, numeric, debounce, deep-link) | Reframed as webhook signaling; threshold alerts deferred |
| SMRTH-01-04 | Smart Home (Nest, Ring) | OAuth complexity, unofficial APIs |

## Progress

**Execution Order:** Phase 12 -> Phase 13 -> Phase 14 -> Phase 15 -> Phase 16 (Phase 16 may begin in parallel with Phase 15 after Phase 14 closes)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 12. Pi Health Backend & Settings | v1.1 | 2/2 | Complete   | 2026-04-07 |
| 13. Title Bar Alerts & Detail View | v1.1 | 2/2 | Complete   | 2026-04-15 |
| 14. Kiosk-Isolation Infrastructure | v1.2 | 6/6 | Complete   | 2026-04-16 |
| 15. iPhone Portrait | v1.2 | 3/5 | In Progress|  |
| 16. iPhone Landscape | v1.2 | 0/? | Not started | - |
