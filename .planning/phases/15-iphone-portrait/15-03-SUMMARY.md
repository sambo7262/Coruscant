---
phase: 15-iphone-portrait
plan: 03
subsystem: ui
tags: [react, framer-motion, viewport, iphone, resp-18, performance]

requires:
  - phase: 15-iphone-portrait/15-01
    provides: viewport-iphone.css with RESP-18 drop-shadow filter and portrait mini-bar CSS
  - phase: 14-kiosk-isolation-infrastructure
    provides: useViewport hook, viewport detection, isolation lint

provides:
  - NowPlayingBanner viewport-aware Framer Motion heights (56px portrait, 48px kiosk)
  - RESP-18 JS-side text-shadow skip on iPhone in both NowPlayingBanner and StreamRow
  - Pattern for useViewport branching in layout components

affects: [15-iphone-portrait/15-04, 15-iphone-portrait/15-05, 16-iphone-landscape]

tech-stack:
  added: []
  patterns: [useViewport branching for Framer Motion animation values, isIphone guard for inline animation styles]

key-files:
  created: []
  modified:
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
    - packages/frontend/src/components/layout/StreamRow.tsx

key-decisions:
  - "collapsedHeight 56px for portrait (matching CSS), 48px for kiosk (existing) -- drives Framer Motion initial/exit y-values"
  - "RESP-18 implemented via JS branching (isIphone skip) rather than CSS !important override -- respects isolation lint ban on !important"
  - "No poster thumbnail in portrait mini-bar -- PlexStream has no posterUrl field; PLEX label retained"

patterns-established:
  - "useViewport + isIphone guard: skip CPU-heavy inline animations on iPhone, let CSS filter handle effects"
  - "collapsedHeight variable: viewport-aware Framer Motion animation targets derived from useViewport"

requirements-completed: [RESP-10, RESP-18]

duration: 2min
completed: 2026-04-16
---

# Phase 15 Plan 03: NowPlayingBanner Portrait Mini-Bar Summary

**Viewport-aware Framer Motion heights (56px portrait / 48px kiosk) and RESP-18 text-shadow skip on iPhone for both NowPlayingBanner and StreamRow**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-16T17:47:27Z
- **Completed:** 2026-04-16T17:49:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- NowPlayingBanner imports useViewport and derives isPortrait/isIphone/collapsedHeight for viewport-aware Framer Motion animation
- Framer Motion initial/exit y-values use collapsedHeight (56px portrait, 48px kiosk) instead of hardcoded 40
- transcodeGlow text-shadow animation skipped on all iPhone viewports in both NowPlayingBanner and StreamRow (RESP-18)
- Idle state "NO ACTIVE STREAMS" strip unchanged -- CSS handles portrait sizing at 56px

## Task Commits

Each task was committed atomically:

1. **Task 1: Add useViewport branching to NowPlayingBanner for portrait mini-bar** - `6026eb3` (feat)
2. **Task 2: Update StreamRow transcode style for iPhone RESP-18 compliance** - `0d52a72` (feat)

## Files Created/Modified
- `packages/frontend/src/components/layout/NowPlayingBanner.tsx` - Added useViewport import, viewport-aware collapsedHeight, Framer Motion y-value branching, RESP-18 transcodeGlow skip on iPhone
- `packages/frontend/src/components/layout/StreamRow.tsx` - Added useViewport import, RESP-18 transcodeGlow text-shadow skip on iPhone

## Decisions Made
- Used 56px for portrait collapsedHeight (matching the CSS value in viewport-iphone.css) and kept 48px for kiosk
- RESP-18 implemented via JS-side `isIphone` branching to skip the `transcodeGlow` animation property entirely, rather than attempting CSS override (which would require banned `!important`)
- No poster thumbnail added to portrait mini-bar -- PlexStream type has no posterUrl field; retained PLEX label pattern consistent with kiosk
- Non-transcode marquee (`downloadsMarquee` for long titles) left active on iPhone -- it is a CSS transform animation, not text-shadow, and does not cause paint storms

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- NowPlayingBanner and StreamRow are now viewport-aware
- Ready for Plan 15-04 (AppHeader compact portrait variant)
- The useViewport + isIphone pattern established here can be reused in AppHeader

---
*Phase: 15-iphone-portrait*
*Completed: 2026-04-16*
