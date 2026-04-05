---
plan: 05-03
phase: 05-ui-v2-instrument-panel-polish
status: complete
completed: 2026-04-05
subsystem: frontend/layout
tags: [nas-header, always-visible, disk-temps, docker-stats, image-update-led]
dependency-graph:
  requires: [05-01]
  provides: [always-visible-nas-header]
  affects: [AppHeader.tsx]
tech-stack:
  added: []
  patterns: [always-visible-inline-sections, fahrenheit-conversion]
key-files:
  created: []
  modified:
    - packages/frontend/src/components/layout/AppHeader.tsx
decisions:
  - "D-18 implemented: NAS header now always-visible with no expand/collapse mechanic"
  - "D-19: Disk temp bars render inline below stats strip, grouped with DISKS label, °F"
  - "D-20: Image update LED renders inline (always visible), blinks amber on updates"
  - "D-21: CPU temp and disk temps both display in °F throughout"
  - "D-22: Docker stats section renders inline when nas.docker is populated"
  - "AnimatePresence and motion imports removed — no longer used after drawer removal"
  - "useState removed — expanded state was the only stateful piece; header is now fully controlled by props"
metrics:
  duration: 127s
  completed: "2026-04-05"
  tasks: 1
  files: 1
---

# Phase 05 Plan 03: NAS Header Always-Visible Rework Summary

**One-liner:** Removed expand/collapse NAS drawer; disk temp bars (°F), Docker stats, and image update LED now render always-visible inline below the stats strip.

## What Was Built

**Task 1 — Remove expand/collapse mechanic and render all NAS data inline**

Rewrote `AppHeader.tsx` to eliminate the tap-to-expand NAS drawer (D-18). All NAS data is now always-visible in a vertical stack of inline sections below the 44px title/stats row:

- **Stats strip** (unchanged): CPU%, RAM%, DSK%, NET↑↓, TEMP — always visible in the 44px header row
- **Disk temp bars section** (new): horizontal row of `GaugeColumn` bars — one per disk returned by DSM. Each bar shows disk name (truncated to 6 chars), fill proportional to temp range 32°F–140°F, value in `°F`. Labeled with small `DISKS` prefix. Only renders when `nas.disks` is non-empty.
- **Docker stats row** (new): compact single row showing `DOCKER` label + CPU%, RAM%, ↑/↓ network. Only renders when `nas.docker` is populated.
- **Image update LED** (new, always visible): 6px dot + text. Blinks amber (`ledPulseWarn`) when `nas.imageUpdateAvailable` is true; static grey when images are current.
- **CPU temp** fixed from `${Math.round(nas.cpuTempC)}C` to `${Math.round(tempF)}°F` (D-21).

**Code removals:**
- `NasHeaderPanel` component function — deleted entirely
- `expanded` useState and `setExpanded` — deleted
- `AnimatePresence` and `motion` imports — removed (no longer used)
- Backdrop overlay `AnimatePresence` block — deleted
- Expanded panel `AnimatePresence` block — deleted
- `role="button"`, `tabIndex`, `aria-expanded`, `aria-label`, `cursor: 'pointer'` on stats strip — all deleted

## Verification

- TypeScript: no AppHeader-specific errors (one pre-existing `globals.css` side-effect import error in `main.tsx` unrelated to this plan)
- Tests: 86/86 pass
- All 11 acceptance criteria verified via grep

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All new sections use real NasStatus data (`nas.disks`, `nas.docker`, `nas.imageUpdateAvailable`). Sections conditionally render only when data exists — no placeholder content.

## Self-Check: PASSED

- File exists: packages/frontend/src/components/layout/AppHeader.tsx — FOUND
- Commit e23b984 exists in git log — FOUND
- All acceptance criteria verified — PASSED
- 86 tests pass — PASSED
