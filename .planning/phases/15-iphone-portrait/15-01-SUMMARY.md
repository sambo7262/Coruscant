---
phase: 15-iphone-portrait
plan: 01
subsystem: ui
tags: [css, iphone, responsive, safe-area, 100dvh, touch-targets, typography]

# Dependency graph
requires:
  - phase: 14-kiosk-isolation-infrastructure
    provides: "data-viewport attribute tagger, isolation lint, tile-sizing tokens on :root, extracted classNames in globals.css"
provides:
  - "viewport-iphone.css populated with 172 lines of iPhone-scoped CSS"
  - "Shared iPhone rules: safe-area insets, body scroll release, 100dvh, CRT disable, touch targets, touch-action, input zoom prevention, RESP-18 drop-shadow"
  - "Portrait-only rules: token overrides, single-column grid, typography scale, AppHeader compact, NowPlayingBanner mini-bar, component font overrides"
affects: [15-02, 15-03, 15-04, 15-05, 16-iphone-landscape]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS token override under html[data-viewport] attribute selector — components use var(--tile-*) so overrides cascade without JS"
    - "Three-section file structure: shared (portrait+landscape), portrait-only, landscape placeholder"

key-files:
  created: []
  modified:
    - "packages/frontend/src/styles/viewport-iphone.css"

key-decisions:
  - "LED size kept at 8px for portrait (D-20) — 6px too small to perceive glow state at phone distance"
  - "All rules CSS-only — no JS changes in this plan, component Path-B branching deferred to 15-02/15-03"

patterns-established:
  - "Shared vs portrait section split: html[data-viewport^='iphone'] for both orientations, html[data-viewport='iphone-portrait'] for portrait-only"
  - "Portrait token values: --tile-padding 10px, --tile-gap 10px, --tile-font-label 12px, --tile-font-value 20px"

requirements-completed: [RESP-05, RESP-06, RESP-07, RESP-09, RESP-18]

# Metrics
duration: 2min
completed: 2026-04-16
---

# Phase 15 Plan 01: iPhone Portrait CSS Foundation Summary

**172 lines of iPhone-scoped CSS covering safe-area insets, single-column grid, 100dvh, typography scale, touch targets, and RESP-18 drop-shadow -- all cascading via token overrides with zero JS changes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-16T17:40:33Z
- **Completed:** 2026-04-16T17:42:23Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments
- Populated viewport-iphone.css from empty contract header to 172 lines with 49 scoped selectors
- Shared iPhone rules cover safe-area insets (RESP-05), body scroll release with 100dvh (RESP-09), CRT sweep disable, touch targets >= 44px (RESP-08), touch-action manipulation, input zoom prevention, and RESP-18 drop-shadow filter
- Portrait-only rules cover token overrides, single-column grid (RESP-06), released tile heights, typography scale (RESP-07), AppHeader compact, NowPlayingBanner mini-bar sizing, and component font overrides

## Task Commits

Each task was committed atomically:

1. **Task 1: Write shared iPhone CSS rules (both orientations)** - `750f05f` (feat)
2. **Task 2: Write portrait-only CSS rules (tokens, grid, typography, component overrides)** - `b0462eb` (feat)

## Files Created/Modified
- `packages/frontend/src/styles/viewport-iphone.css` - All iPhone-scoped CSS: shared rules (safe-area, scroll, touch, RESP-18) + portrait-only rules (tokens, grid, typography, component overrides)

## Decisions Made
- LED size kept at 8px for portrait per D-20 -- 6px would be too small to perceive glow state at phone distance
- No JS changes in this plan -- pure CSS foundation; component Path-B branching (NowPlayingBanner, AppHeader useViewport) deferred to Plans 15-02 and 15-03

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- viewport-iphone.css CSS foundation complete; Plans 15-02 (NowPlayingBanner JS) and 15-03 (AppHeader JS) can now add useViewport() branching that works with these CSS overrides
- Isolation lint passes on every commit; kiosk cannot regress
- Build and vitest both green

---
*Phase: 15-iphone-portrait*
*Completed: 2026-04-16*
