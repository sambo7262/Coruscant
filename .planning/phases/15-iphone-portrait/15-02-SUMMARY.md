---
phase: 15-iphone-portrait
plan: 02
subsystem: ui
tags: [react, viewport, useViewport, appheader, conditional-rendering, battery-optimization]

requires:
  - phase: 14-kiosk-isolation-infrastructure
    provides: "useViewport hook, viewport detection module, data-viewport attribute"
  - phase: 15-iphone-portrait plan 01
    provides: "viewport-iphone.css with header CSS overrides for portrait"
provides:
  - "AppHeader useViewport branching: clock + logs hidden in iphone-portrait"
  - "useLocalClock enabled param to skip 1s setInterval in portrait (battery optimization)"
affects: [15-iphone-portrait plans 03-05, 16-iphone-landscape]

tech-stack:
  added: []
  patterns: ["useViewport() for JS-side conditional rendering (Path-B pattern)", "Hook enabled param to gate side-effects by viewport"]

key-files:
  created: []
  modified: ["packages/frontend/src/components/layout/AppHeader.tsx"]

key-decisions:
  - "Added enabled param to useLocalClock rather than conditional hook call -- preserves React rules of hooks while eliminating 1s timer in portrait"
  - "Disconnected dot rendered standalone in portrait (outside center column) so connection-loss indicator survives clock removal"

patterns-established:
  - "Path-B useViewport pattern: import hook, derive isPortrait boolean, use in JSX conditionals and hook params"
  - "Hook side-effect gating: pass enabled flag to hooks with intervals/timers to save battery on mobile viewports"

requirements-completed: [RESP-11, RESP-12]

duration: 1min
completed: 2026-04-16
---

# Phase 15 Plan 02: AppHeader Portrait Branching Summary

**useViewport branching in AppHeader hides clock (plus its 1s setInterval) and logs icon in iphone-portrait while preserving severity colors, weather, gear, ticker, and Pi Health panel**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-16T17:44:08Z
- **Completed:** 2026-04-16T17:45:27Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- AppHeader imports useViewport and derives isPortrait flag for conditional rendering
- useLocalClock accepts enabled parameter; 1s setInterval skipped in portrait (battery optimization per T-15-03)
- Clock center column and logs icon conditionally excluded from DOM in iphone-portrait
- Disconnected dot preserved as standalone element in portrait for connection-loss visibility
- SEVERITY_TITLE_STYLES, Pi Health panel trigger, ticker, weather, and settings gear all unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add useViewport branching to AppHeader for portrait element visibility** - `0641301` (feat)

## Files Created/Modified
- `packages/frontend/src/components/layout/AppHeader.tsx` - Added useViewport import, isPortrait flag, enabled param on useLocalClock, conditional clock/logs rendering

## Decisions Made
- Added `enabled` parameter to `useLocalClock` hook instead of conditionally calling the hook (would violate React rules of hooks). When `enabled=false`, the `useEffect` returns early without creating the interval.
- Kept disconnected dot as standalone element in portrait so connection loss is still visible even though the clock center column is hidden.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AppHeader portrait branching complete; CSS height/font overrides already in place from Plan 01
- Ready for Plan 03 (NowPlayingBanner portrait mini-bar)
- useViewport Path-B pattern established and reusable for NowPlayingBanner

## Self-Check: PASSED

- [x] AppHeader.tsx exists
- [x] Commit 0641301 exists in git log
- [x] useViewport references found (2)
- [x] isPortrait references found (5)
- [x] enabled references found (3)

---
*Phase: 15-iphone-portrait*
*Completed: 2026-04-16*
