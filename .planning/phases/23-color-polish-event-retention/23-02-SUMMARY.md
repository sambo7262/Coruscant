---
phase: 23-color-polish-event-retention
plan: "02"
subsystem: frontend
tags: [color-polish, disk-colors, process-panel, service-card, timeline]
dependency_graph:
  requires: []
  provides: [DISK_COLORS shared palette, per-index process bar colors, unified disk LED colors]
  affects: [NasProcessPanel, TimelinePage, ServiceCard]
tech_stack:
  added: [packages/frontend/src/utils/diskColors.ts]
  patterns: [shared color constant, per-index coloring]
key_files:
  created:
    - packages/frontend/src/utils/diskColors.ts
  modified:
    - packages/frontend/src/components/layout/NasProcessPanel.tsx
    - packages/frontend/src/pages/TimelinePage.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
decisions:
  - DISK_COLORS is a single source of truth for disk identity colors across ServiceCard LEDs and timeline sparklines
  - Process bars use a dedicated PROC_BAR_COLORS array (different from disk colors since they represent CPU processes, not storage devices)
  - temp-threshold dotColor logic removed from ServiceCard — per-disk identity color replaces it entirely
metrics:
  duration: ~10 minutes
  completed: "2026-05-03"
  tasks_completed: 2
  files_changed: 4
---

# Phase 23 Plan 02: Per-Index Colors and Shared Disk Palette Summary

**One-liner:** Shared DISK_COLORS palette unifies disk identity colors across ServiceCard LEDs and timeline sparklines; NAS process bars now use 5 distinct per-index cockpit colors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Per-index process bar colors and extract DISK_COLORS to shared constant | beeff58 | diskColors.ts (created), NasProcessPanel.tsx, TimelinePage.tsx |
| 2 | ServiceCard disk LEDs use per-disk identity colors | fdf167c | ServiceCard.tsx |

## What Was Built

### Task 1 — Shared DISK_COLORS palette + process bar per-index colors

Created `packages/frontend/src/utils/diskColors.ts` exporting a 6-color `DISK_COLORS` constant:
`['#E8A020', '#00c8ff', '#4ADE80', '#FF3B3B', '#8B5CF6', '#FF8C00']`

In `NasProcessPanel.tsx`:
- Removed `getProcBarColor(pct)` (threshold-based, all bars amber/orange/red)
- Added `PROC_BAR_COLORS = ['#E8A020', '#00c8ff', '#4ADE80', '#FF9500', '#8B5CF6']`
- Process map callback now uses `idx` to assign `PROC_BAR_COLORS[idx % PROC_BAR_COLORS.length]`

In `TimelinePage.tsx`:
- Imported `DISK_COLORS` from shared util
- Removed local `DISK_TEMP_COLORS` declaration
- Updated `NAS_DISK_CONFIG` to accept `idx: number` parameter, uses `DISK_COLORS[idx % DISK_COLORS.length]`
- Volume sparkline `.map()` now passes index: `.map((k, idx) => NAS_DISK_CONFIG(k, ..., idx))`
- Disk temp sparklines already used array index coloring — now reference `DISK_COLORS` directly

### Task 2 — ServiceCard disk LEDs use per-disk identity colors

In `ServiceCard.tsx`:
- Imported `DISK_COLORS` from `../../utils/diskColors.js`
- Replaced temp-threshold `dotColor` logic with `DISK_COLORS[idx % DISK_COLORS.length]`
- LED background, glow boxShadow, and temp text color all inherit the per-disk identity color
- Disk D1 is always amber, D2 cyan, D3 green, D4 red, D5 purple, D6 orange — matching timeline charts exactly

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — changes are purely visual color assignments with no security-relevant surface.

## Self-Check: PASSED

- `packages/frontend/src/utils/diskColors.ts` — created, exported DISK_COLORS
- `packages/frontend/src/components/layout/NasProcessPanel.tsx` — PROC_BAR_COLORS per-index, getProcBarColor removed
- `packages/frontend/src/pages/TimelinePage.tsx` — DISK_COLORS imported, NAS_DISK_CONFIG updated, DISK_TEMP_COLORS removed
- `packages/frontend/src/components/cards/ServiceCard.tsx` — DISK_COLORS imported, dotColor uses per-disk identity
- Commits beeff58 and fdf167c present
- TypeScript: only pre-existing CSS import errors, no new errors
