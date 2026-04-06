---
phase: 09-local-weather-ui-polish
plan: 02
subsystem: ui
tags: [react, css, typescript, framer-motion, fastify, polish]

# Dependency graph
requires:
  - phase: 05-ui-v2-instrument-panel-polish
    provides: AppHeader, CardGrid, NowPlayingBanner, globals.css foundation
  - phase: 07-notifications-pushover-inbox
    provides: arr-webhooks.ts route, ArrWebhookEvent classification
provides:
  - Red 10px disconnect dot in AppHeader (#ff4444 with glow)
  - CORUSCANT title 28px, nav icons 26px (larger than body text)
  - Backdrop blur isolated to ::before pseudo-elements on header and banner
  - DOWNLOADS tile capped at 320px max-height
  - Long download title CSS marquee scroll (downloadsMarquee keyframes)
  - Download speed number colored Tron blue (#00c8ff)
  - Structured [WEBHOOK] log format in arr-webhooks.ts
affects: [09-03, production-deploy, ui-regression-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backdrop blur isolation: use ::before pseudo-element with z-index:-1 instead of inline backdropFilter so child text renders without blur bleed"
    - "Conditional CSS marquee: check title.length > 25 to apply animation only when overflow would occur"

key-files:
  created: []
  modified:
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
    - packages/frontend/src/styles/globals.css
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/backend/src/routes/arr-webhooks.ts

key-decisions:
  - "Disconnect dot uses ledFlashDown animation (not ledPulseWarn) to visually distinguish disconnect (red flash) from warning (amber pulse)"
  - "Marquee threshold is title.length > 25 chars — simple, no ref measurement needed at this scale"
  - "classifyArrEvent and extractArrTitle imported from poll-manager.ts (both already exported) — no inline duplication needed"
  - "backdrop-filter moved to ::before pseudo pattern for both AppHeader and NowPlayingBanner — consistent approach across all blurred elements"

patterns-established:
  - "Blur pseudo pattern: .some-class { position: relative } .some-class::before { content:''; position:absolute; inset:0; backdrop-filter:blur(Xpx); z-index:-1 }"

requirements-completed:
  - WTHR-02

# Metrics
duration: 12min
completed: 2026-04-06
---

# Phase 09 Plan 02: UI Polish Pass Summary

**Red disconnect dot, larger header text, isolated backdrop blur, height-capped DOWNLOADS tile with marquee scroll, Tron-blue download speed, and structured [WEBHOOK] log format**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-06T20:30:00Z
- **Completed:** 2026-04-06T20:42:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Disconnect dot is now red (#ff4444), 10px, with red glow — easily visible at kiosk distance
- CORUSCANT title 28px + nav icons 26px — clearly larger than 15px body text
- Backdrop blur moved to CSS ::before pseudo on `.app-header-blur` and `.banner-blur-bg` — eliminates blur bleed into child text rendering
- DOWNLOADS tile capped at `var(--tile-max-height, 320px)` so it cannot overflow beyond NETWORK tile height
- Long download titles (>25 chars) animate with `downloadsMarquee` CSS keyframes instead of truncating with ellipsis
- Download speed number now Tron blue (`#00c8ff`) instead of amber — visually distinct from status indicators
- Webhook events logged as `[WEBHOOK] RADARR -> grab -> "Movie Title"` — structured, filterable format

## Task Commits

1. **Task 1: Disconnect dot + header sizing + text sharpness** - `8104e4f` (feat)
2. **Task 2: DOWNLOADS tile cap + marquee + speed colors + webhook log format** - `e4e6af4` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `packages/frontend/src/components/layout/AppHeader.tsx` - Red dot, 28px title, 26px icons, app-header-blur class, removed inline backdropFilter
- `packages/frontend/src/components/layout/NowPlayingBanner.tsx` - banner-blur-bg class, removed inline backdropFilter on motion.div
- `packages/frontend/src/styles/globals.css` - Added @keyframes downloadsMarquee, .app-header-blur::before, .banner-blur-bg::before
- `packages/frontend/src/components/cards/CardGrid.tsx` - maxHeight cap on Media tile, marquee span, #00c8ff speed color
- `packages/backend/src/routes/arr-webhooks.ts` - Import classifyArrEvent + extractArrTitle, structured [WEBHOOK] log line

## Decisions Made

- Used `ledFlashDown` animation (0.4s rapid flash) on disconnect dot instead of `ledPulseWarn` — red flash is a stronger visual signal than amber pulse for connection loss
- Marquee threshold of `> 25 chars` chosen as heuristic — avoids ref measurement overhead while covering all realistic download titles that overflow the tile
- Both `classifyArrEvent` and `extractArrTitle` were already exported from `poll-manager.ts` — imported directly, no inline duplication required

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Backend has no `npm run test` script — verified correctness via `tsc --noEmit` (TypeScript type check), which passed with zero errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02 polish changes are complete and isolated — no impact on Plan 01 (weather backend) or Plan 03 (settings restructure)
- `downloadsMarquee` animation requires no CSS variable override for default 320px tile cap
- Blur pseudo pattern is ready to apply to any future blurred containers

## Self-Check: PASSED

All created/modified files confirmed present on disk. Both task commits (8104e4f, e4e6af4) verified in git log.

---
*Phase: 09-local-weather-ui-polish*
*Completed: 2026-04-06*
