---
phase: 05-ui-v2-instrument-panel-polish
plan: "09"
subsystem: frontend-ui
tags: [ui, cards, layout, led, banner]
dependency_graph:
  requires: [05-06, 05-07, 05-08]
  provides: [consistent-card-banners, downloads-row-isolation, uniform-tile-heights, purple-downloads-led]
  affects: [ServiceCard, CardGrid, AppHeader]
tech_stack:
  added: []
  patterns: [conditional-banner-header, css-grid-full-width-row, stretch-align-items]
key_files:
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
decisions:
  - SabnzbdLed active state changed from amber to purple to match ARR instrument LED convention
  - pihole and sabnzbd get full 20px banner (matching MEDIA tile) instead of 6px strip + inline header
  - DOWNLOADS row isolated via gridColumn 1/-1 wrapper div with inner auto-fit grid
  - alignItems changed from start to stretch for uniform MEDIA/NETWORK tile height
  - AppHeader middle section already had flex:1 + justifyContent:center — no change needed
metrics:
  completed_date: "2026-04-04"
  tasks_completed: 5
  tasks_total: 6
  files_modified: 2
---

# Phase 05 Plan 09: Gap Closure — LED Color, Banners, Tile Layout Summary

Five targeted frontend UI fixes applied during kiosk visual QA. Purple DOWNLOADS LED, consistent 20px amber banner headers for NETWORK and DOWNLOADS tiles, DOWNLOADS row forced to its own grid row, and MEDIA/NETWORK tiles stretched to uniform height.

## Tasks Completed

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Fix DOWNLOADS LED color (amber → purple) | Done | SabnzbdLed isActive branch: amber → var(--cockpit-purple) |
| 2 | Add NETWORK and DOWNLOADS banner strips | Done | Replaced 6px strip + inline header for pihole/sabnzbd with 20px full banner; other services unchanged |
| 3 | Force DOWNLOADS tile to its own row | Done | Wrapped downloadServices in gridColumn:'1/-1' div with inner auto-fit grid |
| 4 | Uniform MEDIA + NETWORK tile heights | Done | Changed alignItems from 'start' to 'stretch'; added height:'100%' to arr tile outer div |
| 5 | Center NAS stats middle section in header | No-op | AppHeader middle section already had flex:1 + justifyContent:'center' — correct as-is |
| 6 | Build and commit | Partial | Build succeeded (✓ built in 795ms, 0 errors); commit blocked by Bash permission denial |

## Deviations from Plan

### Task 5 — No-op (already correct)

The plan specified ensuring the middle NAS stats section has `justifyContent: 'center'` and `flex: 1`. On inspection, `AppHeader.tsx` lines 283-288 already had both properties set correctly. No change was made to `AppHeader.tsx`.

### Task 6 — Bash permission blocked commit

The `git add` and `git commit` commands were denied by the Bash tool permission check. The build succeeded but the commit could not be created automatically. The user must commit manually:

```bash
git add packages/frontend/src/components/cards/ServiceCard.tsx
git add packages/frontend/src/components/cards/CardGrid.tsx
git commit -m "feat(05-gap): UI polish — purple DOWNLOADS LED, consistent banners, tile layout

DOWNLOADS LED corrected to purple. NETWORK and DOWNLOADS tiles now have
same amber header banner as MEDIA. DOWNLOADS tile forced to own row.
MEDIA/NETWORK tiles stretch to uniform height. Header NAS stats centered."
```

## Build Verification

```
✓ 2700 modules transformed.
✓ built in 795ms
0 errors, 0 type errors
```

The chunk size warning (>500kB) is pre-existing and not caused by these changes.

## Key Changes Detail

### ServiceCard.tsx

**SabnzbdLed** (line ~358): `background` and `boxShadow` changed from `var(--cockpit-amber)` to `var(--cockpit-purple)` in the `isActive` branch.

**ServiceCard render** (line ~446): Replaced the unconditional 6px strip + inline header with a conditional:
- `pihole` or `sabnzbd`: 20px amber banner with label left + LED right (LED in banner, no duplicate header below)
- All other services: 6px strip + inline header row (existing behavior preserved)

### CardGrid.tsx

**Outer grid** (line ~59): `alignItems: 'start'` → `alignItems: 'stretch'`

**Arr tile** (line ~66): Added `height: '100%'` to outer div so it fills the stretch-aligned cell.

**Downloads section** (line ~97): Wrapped in `<div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>` to force a new row.

## Known Stubs

None — all changes wire real data or correct existing visual behavior.

## Self-Check: PARTIAL

- [x] `packages/frontend/src/components/cards/ServiceCard.tsx` — modified and verified via Read
- [x] `packages/frontend/src/components/cards/CardGrid.tsx` — modified and verified via Read
- [x] Build passes (npm run build --workspace=packages/frontend)
- [ ] Commit hash — not available (Bash blocked)
