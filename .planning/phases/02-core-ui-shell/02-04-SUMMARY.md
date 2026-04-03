---
phase: 02-core-ui-shell
plan: 04
subsystem: ui
tags: [react, framer-motion, sse, tron-design-system, typescript, accessibility]

# Dependency graph
requires:
  - phase: 02-core-ui-shell
    plan: 02
    provides: CSS design system, React Router, App shell, shared types
  - phase: 02-core-ui-shell
    plan: 01
    provides: SSE backend endpoint, useDashboardSSE hook
provides:
  - NowPlayingBanner fixed bottom component with expand/collapse drawer
  - StreamRow per-stream display component (title, progress, quality, transcode)
  - Enhanced ServiceDetailPage with StatusDot, live data, and mock metric slots
  - App.tsx wired with SSE snapshot driving NowPlayingBanner and ServiceDetailPage
affects: [02-05, phase-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NowPlayingBanner returns null when streams.length === 0 (D-14)
    - Framer Motion AnimatePresence handles banner mount/unmount slide (y + opacity transforms only)
    - Drawer expand uses Framer Motion height animation (exception per UI-SPEC — CSS cannot animate height:auto)
    - Marquee ticker uses shouldScroll ref measurement before activating animation
    - Backdrop div blocks pointer events and allows tap-outside-to-close pattern
    - ServiceDetailPage accepts snapshot prop from App.tsx (not useDashboardSSE internally)
    - Focus management: useEffect moves focus to h1#detail-heading on serviceId change

key-files:
  created:
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
    - packages/frontend/src/components/layout/StreamRow.tsx
  modified:
    - packages/frontend/src/pages/ServiceDetailPage.tsx
    - packages/frontend/src/App.tsx

key-decisions:
  - "SSE hook called in App.tsx (not DashboardPage or ServiceDetailPage) so snapshot data is available to all routes including detail page and NowPlayingBanner"
  - "ServiceDetailPage accepts snapshot as prop rather than calling useDashboardSSE — avoids second SSE connection per route"
  - "Marquee ticker overflow checked via ref.scrollWidth > ref.clientWidth in useEffect — only scrolls when text actually overflows"

# Metrics
duration: 5min
completed: 2026-04-03
---

# Phase 02 Plan 04: Now Playing Banner and ServiceDetailPage Summary

**Fixed-bottom Now Playing banner with Framer Motion expand/collapse drawer, marquee ticker for stream data, and enhanced ServiceDetailPage with live StatusDot and mock metric slots**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-03T15:10:00Z
- **Completed:** 2026-04-03T15:13:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created StreamRow component displaying per-stream data: title (with season/episode or year formatting), user badge, 4px progress bar with percentage fill, quality string, and TRANSCODE/DIRECT indicator with amber/blue color coding
- Created NowPlayingBanner with Framer Motion entrance animation (y/opacity), collapsed 48px strip with stream count + marquee ticker, backdrop for tap-outside-to-collapse, and AnimatePresence-driven drawer showing StreamRow list — returns null when streams empty (D-14)
- Enhanced ServiceDetailPage with live StatusDot (health glow animation), h1 focus management on mount, 5 mock metric slots (status, last checked, response time, uptime, version) using live SSE data for status/lastPollAt
- Updated App.tsx to call useDashboardSSE() at root level and pass snapshot to both NowPlayingBanner (streams) and ServiceDetailPage, ensuring live data flows to all routes

## Task Commits

1. **Task 1: Build NowPlayingBanner with expand/collapse drawer and StreamRow** - `d8d4235` (feat)
2. **Task 2: Enhance ServiceDetailPage with status display and mock metric slots** - `778e4b2` (feat)

## Files Created/Modified

- `packages/frontend/src/components/layout/StreamRow.tsx` - Per-stream display row: title formatting, progress bar, quality/transcode badge
- `packages/frontend/src/components/layout/NowPlayingBanner.tsx` - Fixed bottom banner: slide animation, collapsed ticker, expand/collapse drawer with backdrop
- `packages/frontend/src/pages/ServiceDetailPage.tsx` - Enhanced detail page: StatusDot, live status/lastPollAt, 5 mock metric slots, focus management
- `packages/frontend/src/App.tsx` - SSE hook at root level, snapshot passed to NowPlayingBanner and ServiceDetailPage

## Decisions Made

- SSE hook stays in App.tsx (not per-page) so snapshot is shared across all routes without multiple EventSource connections — NowPlayingBanner and ServiceDetailPage both receive data from same source
- ServiceDetailPage accepts `snapshot` as prop rather than calling `useDashboardSSE()` internally — clean data flow, no duplicate connections
- Marquee overflow detection uses `useEffect` with `ref.scrollWidth > ref.clientWidth` — only activates when title text actually overflows the available space

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `packages/frontend/src/pages/ServiceDetailPage.tsx` — "Response time", "Uptime", and "Version" metric slots display "---". These will be populated in Phase 3+ when service API integration is wired. Status and last checked show live data from SSE snapshot.
- `packages/frontend/src/pages/DashboardPage.tsx` — Still renders "Dashboard loading..." placeholder. Plan 02-03 replaces with CardGrid + SSE wiring.

## Issues Encountered

None — both tasks compiled and built cleanly on first attempt.

## Self-Check: PASSED

- FOUND: packages/frontend/src/components/layout/NowPlayingBanner.tsx
- FOUND: packages/frontend/src/components/layout/StreamRow.tsx
- FOUND: packages/frontend/src/pages/ServiceDetailPage.tsx
- FOUND: .planning/phases/02-core-ui-shell/02-04-SUMMARY.md
- FOUND commit: d8d4235 feat(02-04): build NowPlayingBanner with expand/collapse drawer and StreamRow
- FOUND commit: 778e4b2 feat(02-04): enhance ServiceDetailPage with status dot and mock metric slots

## Next Phase Readiness

- NowPlayingBanner fully operational — Phase 3 can pass real Plex stream data through the existing SSE snapshot
- ServiceDetailPage ready for metric population — Phase 3+ adds real metrics to the `---` slots
- App.tsx root-level SSE provides snapshot to all components — no architectural changes needed when adding new data consumers
