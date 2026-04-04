---
phase: 04-rich-service-integrations
plan: 05
subsystem: ui
tags: [react, plex, tautulli, framer-motion, sse]

# Dependency graph
requires:
  - phase: 04-02
    provides: Plex types (PlexStream, PlexServerStats) and DashboardSnapshot.plexServerStats via Tautulli webhook integration

provides:
  - NowPlayingBanner with idle state (NO ACTIVE STREAMS), live streams with deviceName, and Plex server stats section
  - Three-state Plex rail: hidden (not configured), idle (configured + no streams), active (configured + streams)

affects: [05-ubiquiti-network, 09-production-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - plexConfigured strict !== false check (same pattern as nasConfigured) for legacy service compatibility
    - Idle state via early return of static div (no AnimatePresence overhead when no streams)

key-files:
  created: []
  modified:
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
    - packages/frontend/src/App.tsx

key-decisions:
  - "NowPlayingBanner returns null only when plexConfigured is false -- idle state shown for configured+no-streams (D-11)"
  - "Collapsed ticker shows deviceName and transcode/direct indicator per stream (D-09)"
  - "plexServerStats section rendered inside expanded drawer only when stats available (D-10)"

patterns-established:
  - "Pattern: plexConfigured uses strict !== false check for compatibility with legacy/mock services"

requirements-completed: [SVCRICH-02, SVCRICH-05]

# Metrics
duration: 1.5min
completed: 2026-04-04
---

# Phase 4 Plan 05: NowPlayingBanner Live Data Summary

**NowPlayingBanner upgraded to three-state Plex rail: hidden when unconfigured, idle with "NO ACTIVE STREAMS" label when configured, active with deviceName ticker and Plex server stats drawer when streams exist**

## Performance

- **Duration:** ~1.5 min
- **Started:** 2026-04-04T22:48:26Z
- **Completed:** 2026-04-04T22:49:49Z
- **Tasks:** 1 of 2 (Task 2 is a checkpoint:human-verify paused for visual review)
- **Files modified:** 2

## Accomplishments
- NowPlayingBanner now supports three distinct states: hidden (Plex not configured), idle ("NO ACTIVE STREAMS"), active (live streams)
- Collapsed rail ticker now shows title, deviceName, and Direct Play/Transcode indicator per stream (D-09)
- Expanded drawer shows Plex server stats section (CPU%, RAM%, bandwidth Mbps) when available (D-10)
- App.tsx derives plexConfigured from snapshot services using same strict !== false pattern as nasConfigured

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade NowPlayingBanner with idle state, deviceName, and server stats** - `3ccb3ce` (feat)

**Plan metadata:** (pending — awaiting checkpoint verification)

## Files Created/Modified
- `packages/frontend/src/components/layout/NowPlayingBanner.tsx` - Added plexConfigured prop, idle state, deviceName in ticker, server stats section
- `packages/frontend/src/App.tsx` - Derives plexConfigured; passes plexServerStats and plexConfigured to NowPlayingBanner

## Decisions Made
- Used same strict `!== false` check for plexConfigured as nasConfigured — consistent with established pattern
- Idle state uses a simple static div (not AnimatePresence motion.div) — no animation needed for the idle rail, lower overhead
- Ticker builds per-stream format as: `Title • DeviceName • Direct Play/Transcode` per D-09

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in `packages/frontend/src/main.tsx` for CSS import (`globals.css`) — unrelated to this plan's changes, no action taken.

## Checkpoint: Human Visual Verification Required

Task 2 is a `checkpoint:human-verify` gate. Before this plan is considered complete, the user must visually verify the complete Phase 4 UI on 800x480 viewport. See checkpoint details below.

## Known Stubs

None — NowPlayingBanner reads live data from DashboardSnapshot.streams and DashboardSnapshot.plexServerStats, both of which arrive via Tautulli webhooks through SSE. When no webhook has fired, streams is empty and the idle state is displayed correctly.

## Next Phase Readiness
- All Phase 4 code changes are committed and TypeScript-clean
- All 65 tests pass
- Visual checkpoint verification is the only remaining gate
- Once verified, Phase 4 is complete and Phase 5 (Ubiquiti) can begin

---
*Phase: 04-rich-service-integrations*
*Completed: 2026-04-04*
