---
phase: 04-rich-service-integrations
plan: "04"
subsystem: frontend-header
tags: [nas, header, expand-panel, framer-motion, live-data]
dependencies:
  requires: ["04-02"]
  provides: [NasHeaderPanel, live-nas-strip, SVCRICH-05-nas-detail]
  affects: [AppHeader, App]
tech_stack:
  added: []
  patterns: [AnimatePresence-drawer, tap-to-expand, conditional-sections-D19]
key_files:
  created: []
  modified:
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/App.tsx
decisions:
  - "AppHeader expandable panel IS the NAS detail view (SVCRICH-05) — no separate route needed"
  - "nasConfigured uses strict !== false check — legacy/mock services without flag are not unconfigured"
  - "Backdrop overlay positioned top:44px (below header strip) to avoid covering header itself"
metrics:
  duration: "116s"
  completed: "2026-04-04"
  tasks: 2
  files: 2
---

# Phase 04 Plan 04: NAS Header Strip with Expandable Panel Summary

**One-liner:** AppHeader NAS strip wired to live snapshot data with tap-to-expand downward panel showing per-disk temps, Docker stats, fan speeds, and image update LED — serving as the NAS detail view (SVCRICH-05).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refactor AppHeader NAS strip to show live data with tap-to-expand | a9c01ab | packages/frontend/src/components/layout/AppHeader.tsx |
| 2 | Update App.tsx to pass nasConfigured prop to AppHeader | 4cfa5af | packages/frontend/src/App.tsx |

## What Was Built

### Task 1: AppHeader NAS strip refactor

The AppHeader center column was refactored from a static gauge stub to a three-state live data display:

1. **Unconfigured state** (`nasConfigured === false`): Renders "NAS NOT CONFIGURED" in grey (#666666). No expand interaction.

2. **Stale state** (`nasConfigured !== false && nas === null`): Renders CPU/RAM/DSK/TEMP columns with `—` values at zero fill. Indicates NAS is configured but data has not arrived yet.

3. **Live state** (`nasConfigured !== false && nas !== null`): Renders a clickable horizontal strip with CPU%, RAM%, DSK%, network up/down arrows, and CPU temp (when present). Tap toggles the `NasHeaderPanel` drawer open.

**NasHeaderPanel component** (inline in AppHeader.tsx): An `AnimatePresence`-driven `motion.div` that slides down from the header with:
- DISKS section: per-disk name, read/write MB/s, temp in Celsius — only rendered when `nas.disks` exists and has entries (D-19)
- DOCKER section: CPU%, RAM%, network up/down Mbps — only rendered when `nas.docker` exists (D-19)
- FANS section: fan ID and RPM for each fan — only rendered when `nas.fans` exists and has entries (D-19)
- Image update LED: amber pulsing when updates available, grey static when up to date

A backdrop overlay at `zIndex: 25` (above content, below panel at 30) allows tap-outside-to-close behavior, matching the NowPlayingBanner pattern.

### Task 2: App.tsx nasConfigured derivation

App.tsx now derives `nasConfigured` from the snapshot services array using the established `!== false` strict check pattern. This is passed to AppHeader so the header knows which display state to render.

## Decisions Made

1. **AppHeader tap-to-expand IS SVCRICH-05 NAS detail view**: The user confirmed the header strip expansion satisfies the NAS detail interaction requirement. No separate routable detail page is needed.

2. **`nasConfigured` uses strict `!== false` check**: Consistent with the Phase 03 pattern established for ServiceCard — legacy/mock services without the `configured` field are not treated as unconfigured. Only explicitly `configured: false` triggers the "NAS NOT CONFIGURED" state.

3. **Backdrop top offset `top: 44px`**: The backdrop's fixed position starts at 44px (below the header strip) so the header controls remain accessible when the panel is open.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. The only TypeScript error present (`globals.css` import in main.tsx) is pre-existing and unrelated to this plan's changes.

## Known Stubs

None. All data displayed in the NAS strip and expanded panel comes directly from `snapshot.nas` (live SSE data after Plan 02 wired the NAS adapter). The `nasConfigured` flag is derived from real `snapshot.services` data. No placeholder text or hardcoded values flow to the UI.

## Self-Check: PASSED

- packages/frontend/src/components/layout/AppHeader.tsx — FOUND, contains NasHeaderPanel, AnimatePresence, NAS NOT CONFIGURED, UPDATES AVAILABLE, UP TO DATE, DISKS, DOCKER, FANS, expanded, motion.div
- packages/frontend/src/App.tsx — FOUND, contains nasConfigured derivation and prop pass
- Commit a9c01ab — FOUND (Task 1)
- Commit 4cfa5af — FOUND (Task 2)
- TypeScript compilation: passes (pre-existing globals.css error in main.tsx unrelated to this plan)
