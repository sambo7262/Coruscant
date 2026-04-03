---
phase: 02-core-ui-shell
plan: 11
subsystem: frontend/layout
tags: [header, nas, instrument-panel, gauges, fahrenheit, TheRock]
dependency_graph:
  requires: [02-01, 02-02, 02-03]
  provides: [nas-header-panel]
  affects: [AppHeader, CardGrid, NasStatus types]
tech_stack:
  added: []
  patterns: [vertical-bar-gauge, single-row-header, css-flexbox-3col-grid]
key_files:
  created: []
  modified:
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/backend/src/mock/generator.ts
    - packages/shared/src/types.ts
    - packages/frontend/src/components/cards/CardGrid.tsx
decisions:
  - "Single-row header uses CSS grid with 3 columns (1fr auto 1fr) to keep title left-aligned, NAS panel centered, icons right-aligned at 800px"
  - "NasVolume interface added to shared types to export the volume shape with tempF support"
  - "Mock data uses two volumes: TheRock (primary) and TheRock2 — realistic 88-100°F range"
  - "CardGrid filters by id 'nas-detail' to exclude NAS from grid; ServiceCard NAS body kept intact for detail page"
metrics:
  duration: 188s
  completed: 2026-04-03
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 11: NAS Header Instrument Panel Summary

NAS stats moved from a standalone card into the AppHeader center section as a compact vertical bar gauge panel — CPU/RAM/Disk usage bars plus per-drive temperature bars in °F with amber/orange/red thresholds.

## What Was Built

The AppHeader was restructured from a 2-row layout (title row + NAS strip) to a **single-row 3-column layout** (`1fr auto 1fr`):

- **Left column:** CORUSCANT title or ← CORUSCANT back link
- **Center column:** NAS instrument panel (hidden when `showBack=true`)
- **Right column:** Settings and Logs icon links

### NAS Instrument Panel

The center panel renders compact vertical bar gauges for each stat:

- **CPU / RAM / DSK** — 4px × 20px bars, fill amber from bottom, numeric percent below
- **Separator** — 1px × 24px vertical divider (rgba amber 25%)
- **Drive temp bars** — one per volume from mock data; fill mapped to 32–140°F range; color thresholds: amber below 95°F, orange (#FF8C00) at 95–113°F, red above 113°F
- Labels 9px uppercase amber at 60% opacity; values 10px monospace amber

### Data Changes

- `NasVolume` interface exported from `packages/shared/src/types.ts` with `tempF?: number` added alongside existing `tempC`
- Mock generator updated: volumes named `TheRock` and `TheRock2` with realistic Fahrenheit temps (88–100°F range). Both tempF and computed tempC provided.
- `nas-detail` service metric updated to use `tempF` instead of `tempC`

### CardGrid

Added filter `s.id !== 'nas-detail'` to exclude the NAS entry from the rendered card grid. The `renderInstrumentBody` case for 'nas' in ServiceCard is preserved for the detail page.

## Verification

- AppHeader renders NAS panel in middle with vertical bars for CPU/RAM/DSK + drive temps
- Volume shows "TheRock" and "TheRock2" (not /vol1 or generic name)
- Temperature displayed as °F (e.g. 91°F), not °C
- `showBack=true` hides the NAS panel entirely
- Dashboard grid no longer shows NAS card; all other cards (Plex, Radarr, etc.) continue rendering
- TypeScript compiles clean for backend and frontend (CSS import error is pre-existing Vite TSX issue, not from this plan)

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | Add NAS instrument panel to AppHeader | `6620fae` |
| 2 | Remove NAS card from CardGrid | `2911db3` |

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Added NasVolume exported interface to shared types**
- Found during: Task 1
- Issue: The plan mentioned adding `tempF` to volumes but the inline type `{ name: string; usedPercent: number; tempC?: number }` in NasStatus wasn't exportable for reuse
- Fix: Extracted to named `NasVolume` interface with `tempF?: number` added; NasStatus.volumes now uses `NasVolume[]`
- Files modified: `packages/shared/src/types.ts`
- Commit: `6620fae`

**2. [Rule 2 - Missing functionality] Added second mock volume (TheRock2)**
- Found during: Task 1
- Issue: A single volume in mock data meant the drive temp separator and multi-drive bar feature couldn't be visually verified; the plan calls for "one per drive"
- Fix: Added second mock volume `TheRock2` at 34% usage and 90–100°F to exercise multi-bar rendering
- Files modified: `packages/backend/src/mock/generator.ts`
- Commit: `6620fae`

## Known Stubs

None — all gauges are wired to live SSE data via the existing `useDashboardSSE` hook. The `nas` prop in AppHeader receives real mock data. No placeholder values flow to UI rendering.

## Self-Check: PASSED

- AppHeader.tsx exists: FOUND
- generator.ts exists: FOUND
- types.ts exists: FOUND
- CardGrid.tsx exists: FOUND
- Commit 6620fae exists: FOUND
- Commit 2911db3 exists: FOUND
- "TheRock" in generator.ts: FOUND (AppHeader renders vol.name dynamically — name arrives from SSE data, not hardcoded)
- NasVolume with tempF exported from shared types: VERIFIED
