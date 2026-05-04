---
phase: 22-nas-process-monitor
plan: "02"
subsystem: frontend-css
tags: [css, nas, process-monitor, iphone, viewport]
dependency_graph:
  requires: []
  provides:
    - ".nas-process-panel full-width dropdown CSS classes"
    - ".nas-tile__cpu-tap-btn CPU tap affordance button reset"
    - "iPhone viewport safe-area and touch target overrides for process panel"
  affects:
    - "packages/frontend/src/styles/globals.css"
    - "packages/frontend/src/styles/viewport-iphone.css"
tech_stack:
  added: []
  patterns:
    - "Fixed-position full-width dropdown panel (mirrors docker-update-panel and weather-forecast-panel)"
    - "CPU usage bar with CSS transition on width, color set via inline style by component"
    - "Skeleton loading state reusing existing arrDownloadPulse keyframe"
    - "iPhone viewport overrides scoped under html[data-viewport^=iphone] selector prefix"
key_files:
  created: []
  modified:
    - packages/frontend/src/styles/globals.css
    - packages/frontend/src/styles/viewport-iphone.css
decisions:
  - "z-index: 9 used for .nas-process-panel to match docker-update-panel and weather-forecast-panel stacking layer (plan specified 100 as a floor; matched existing peer value instead)"
metrics:
  duration_minutes: 7
  completed_date: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 22 Plan 02: NAS Process Panel CSS Summary

**One-liner:** Full-width NAS process monitor panel CSS with usage bars, skeleton loading, CPU tap affordance button, and iPhone safe-area/touch-target overrides matching docker-update-panel and weather-forecast-panel patterns.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | NAS process panel CSS + CPU tap affordance in globals.css | 8bfff88 | packages/frontend/src/styles/globals.css |
| 2 | iPhone viewport overrides in viewport-iphone.css | f0030dd | packages/frontend/src/styles/viewport-iphone.css |

## What Was Built

**Task 1 — globals.css additions (113 lines):**
- `.nas-process-panel` — fixed-position full-width dropdown, z-index 9, dark background, amber border-bottom
- `.nas-process-panel__inner` — 10px 16px padding container
- `.nas-process-panel__header` — 9px mono uppercase amber label for "NAS LOAD — CPU N%"
- `.nas-process-panel__row` — flex row with 8px gap for each process entry
- `.nas-process-panel__label` — 160px fixed-width mono label, ellipsis overflow, uppercase
- `.nas-process-panel__bar-wrap` — flex:1 container for usage bar track
- `.nas-process-panel__track` — 16px height bar with amber-tinted background
- `.nas-process-panel__fill` — bar fill with 0.6s width transition (color set via inline style by component)
- `.nas-process-panel__pct` — 38px right-aligned mono percentage text
- `.nas-process-panel__empty` — cockpit-green "NO PROCESS DATA" state
- `.nas-process-panel__error` — cockpit-red "DSM UNREACHABLE" state
- `.nas-process-panel__skeleton` — 70px pulsing skeleton using existing `arrDownloadPulse` keyframe
- `.nas-tile__cpu-tap-btn` — `all: unset` button reset, flex row, full width, tap highlight off
- `.nas-tile__cpu-chevron` — 10px amber chevron indicator

**Task 2 — viewport-iphone.css additions (12 lines):**
- `html[data-viewport^="iphone"] .nas-process-panel` — `top: calc(44px + env(safe-area-inset-top))` for notch/Dynamic Island offset
- `html[data-viewport^="iphone"] .nas-tile__cpu-tap-btn` — `min-height: 44px; touch-action: manipulation` for RESP-08 touch target compliance

## Verification

- `grep -c "nas-process-panel" packages/frontend/src/styles/globals.css` → 14 (required ≥ 10)
- `node scripts/verify-viewport-isolation.mjs` → OK — all selectors scoped to html[data-viewport^="iphone"]
- `npx vitest run` → 210 passed (25 test files), 0 failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Decision] z-index: 9 instead of plan's 100**
- **Found during:** Task 1
- **Issue:** Plan specified `z-index: 100` as a suggested value. Existing peer panels (`docker-update-panel`, `weather-forecast-panel`) both use `z-index: 9`. Using 100 would create an inconsistent stacking context.
- **Fix:** Used `z-index: 9` to match the established layer for full-width dropdown panels.
- **Files modified:** packages/frontend/src/styles/globals.css
- **Commit:** 8bfff88

## Known Stubs

None — this is a CSS-only plan. No data sources or component wiring involved.

## Threat Flags

None — CSS-only plan, no data flows, no network surface, no user input. T-22-05 mitigation (CI viewport isolation lint) verified passing.

## Self-Check: PASSED

- [x] packages/frontend/src/styles/globals.css modified and committed (8bfff88)
- [x] packages/frontend/src/styles/viewport-iphone.css modified and committed (f0030dd)
- [x] Both commits confirmed in git log
- [x] 14 `nas-process-panel` matches in globals.css (≥ 10 required)
- [x] CI viewport isolation lint passes
- [x] 210 vitest tests pass, no regressions
