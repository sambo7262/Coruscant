---
phase: 08-logging-polish-performance
plan: "04"
subsystem: frontend-visual-polish
tags: [css, ui, kiosk, 10ft, NAS-tile, crt-sweep, threshold-colors, arrow-indicators]
status: complete
dependency_graph:
  requires: [08-01, 08-02]
  provides: [polished-dashboard, NAS-standalone-tile, crt-sweep, threshold-bars, client-bar-gauge]
  affects: []
tech_stack:
  added: []
  patterns:
    - css-custom-properties
    - threshold-color-helpers
    - framer-motion-tile
    - text-glow-utility
key_files:
  modified:
    - packages/frontend/src/styles/globals.css
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/App.tsx
    - packages/frontend/src/pages/DashboardPage.tsx
decisions:
  - "Selected variant C hex #000D1A used for --space-deep (Tactical Dark — user selection from Plan 02)"
  - "paddingTop reduced from 128px to 76px after NAS data row removal from AppHeader"
  - "NasTileInstrument renders CPU/RAM/volumes/disk temps/docker as standalone tile with amber ribbon"
  - "UniFi clientCount/peakClients used directly from UnifiMetrics (not totalClients — type uses clientCount)"
  - "Shared package dist rebuilt to expose peakClients?: number added in Plan 01"
  - "Task 2 audit confirms 24px text-display fits: 480 - 76 - 40 = 364px available, grid uses ~238px"
metrics:
  duration: "546s"
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_changed: 6
---

# Phase 08 Plan 04: Frontend Visual Polish Summary

**One-liner:** Applied 10ft kiosk polish — Tactical Dark background (#000D1A), scaled text (24/18/15/12px), CRT sweep animation, NAS standalone tile with amber ribbon, threshold-colored CPU/RAM bars, UniFi client bar gauge, multi-arrow speed indicators, Plex stat colors, and download bar removal — all within 800x480 no-scroll constraint.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | CSS updates + download bar removal + CRT sweep + NAS tile restructure | Complete | 8e7c401 |
| 2 | Metric audit + viewport budget verification | Complete | (no file changes — verification pass) |

## Changes Made

### Task 1 — CSS Polish + Structural Changes

**globals.css:**
- `--space-deep` updated to `#000D1A` (Variant C: Tactical Dark, selected in Plan 02 checkpoint)
- Typography scaled up for 10ft kiosk: display 24px (was 20px), heading 18px (was 16px), body 15px (was 14px), label 12px (unchanged)
- `.text-glow` utility added: `text-shadow: 0 0 6px currentColor`
- `.chamfer-card` receives `box-shadow: inset 0 0 20px rgba(0,0,0,0.5)` for recessed panel depth
- `@keyframes crtSweep` + `.crt-sweep` class added (10s linear infinite, pointer-events: none, z-index: 10000)
- Reduced-motion guard added for `.crt-sweep`

**App.tsx:**
- `<div className="crt-sweep" aria-hidden="true" />` added as first child of root fragment
- `paddingTop` reduced from 128px to 76px (header is now ~68px after NAS data row removal)

**CardGrid.tsx:**
- `DOWNLOAD_IDS` set removed
- `downloadServices` filtering and full-width `gridColumn: '1 / -1'` SABnzbd section removed
- All non-arr services (including SABnzbd) now render in normal 2-column grid flow
- `alignItems: 'stretch'` set on grid container (was `'start'`)
- `NasStatus` imported; `nasStatus` prop added to `CardGridProps`
- NAS service no longer excluded from grid render
- `nasStatus` passed to NAS ServiceCard

**ServiceCard.tsx:**
- `getBarColor(percent)` helper: green (#4ADE80) <60%, amber (#E8A020) 60-85%, red (#FF3B3B) >85%
- `getArrowTier(mbps, direction)` helper: 1/2/3 arrows based on Mbps tier (<10/10-100/>100)
- `NasTileInstrument` component: amber ribbon header "NAS", CPU/RAM bars with threshold colors, volume bars, disk temps (°F), docker stats — all with `.text-glow` on values
- NasInstrument updated to use `getBarColor` for CPU/RAM and `.text-glow` on value labels
- `PlexInstrument` updated: stream count gets `.text-glow`, server stats row added (CPU=green, RAM=blue, bandwidth=white)
- `NetworkInstrument` updated: client bar gauge (green #4ADE80, no raw number), TX/RX arrows colored red/blue
- Pi-hole QPM and blocking status get `.text-glow`
- `ServiceCardProps` receives `nasStatus?: NasStatus | null`
- NAS early-return removed; NAS renders as standalone amber-ribbon chamfer tile when `service.id === 'nas'`
- `NasVolume` imported from shared types

**AppHeader.tsx:**
- Full NAS data row (DISKS + NAS stats + Docker three-column panel) removed
- Replaced with compact one-line temp/fan summary: CPU temp, disk temps (°F), fan RPM, image update LED
- Header now ~68px tall (was ~128px), freeing ~60px of vertical content space

**DashboardPage.tsx:**
- Passes `nasStatus={snapshot?.nas ?? null}` to `CardGrid`

### Task 2 — Metric Audit + Viewport Budget Verification (No File Changes)

**Viewport budget at 800×480:**
- Available = 480 - 76 (paddingTop) - 40 (paddingBottom/NowPlayingBanner) = **364px**
- Grid content ≈ Row1 (~110px) + gap (8px) + Row2 (~130px) = ~248px
- Headroom: ~116px — no scroll risk at 24px text-display
- Body scroll lock confirmed active: `document.body.style.overflow = isDashboard ? 'hidden' : ''`

**Metric legibility audit:**
- NAS: CPU%, RAM%, volumes, disk temps visible at 9px labels — pre-existing pattern; values highlighted with `.text-glow`
- MEDIA: 6 LED rows at 12px — identifiable at 10ft; glow on service labels not needed (binary LED state communicates health)
- NETWORK: QPM and blocking status get `.text-glow`; UniFi client bar communicates load visually
- SABnzbd: 20px speed number dominant; filename at 9px is supplementary info (pre-existing pattern)
- UniFi: 10px arrow indicators colored per direction (red TX, blue RX) — new addition scales with tier

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared package dist stale — peakClients missing**
- **Found during:** Task 1 TypeScript check
- **Issue:** `packages/shared/dist/types.d.ts` did not include `peakClients?: number` (added in Plan 01 but dist not rebuilt)
- **Fix:** Rebuilt `packages/shared` with `npm run build` to regenerate dist types
- **Files modified:** `packages/shared/dist/types.d.ts` (gitignored — not committed)
- **Impact:** TS2339 error on `um!.peakClients` resolved; no runtime impact (Vite uses project references)

**2. [Rule 2 - Deviation] UnifiMetrics uses `clientCount`, not `totalClients`**
- **Found during:** Task 1 — plan action referenced `metrics.totalClients` but interface uses `clientCount`
- **Fix:** Used `um!.clientCount` and `um!.peakClients` per actual type definition
- **Impact:** Correct field used; no behavioral change

**3. [Rule 2 - Missing Data Flow] DashboardPage must pass nasStatus to CardGrid**
- **Found during:** Task 1 — plan specified CardGrid receives nasStatus but DashboardPage is the intermediary
- **Fix:** Updated `DashboardPage.tsx` to pass `nasStatus={snapshot?.nas ?? null}` to CardGrid
- **Files modified:** `packages/frontend/src/pages/DashboardPage.tsx`

## Known Stubs

None — all data flows are wired. NAS tile uses `nasStatus` from `snapshot.nas`; Plex stats use `service.metrics.processCpuPercent/processRamPercent/bandwidthMbps` populated by the Plex adapter (Plan quick-260405-byq).

## Self-Check: PASSED

- [x] `packages/frontend/src/styles/globals.css` — `--space-deep: #000D1A`, `.text-display { font-size: 24px`, `.text-glow`, `inset 0 0 20px`, `@keyframes crtSweep`, `.crt-sweep`
- [x] `packages/frontend/src/App.tsx` — `crt-sweep`, `aria-hidden="true"`, `overflow`
- [x] `packages/frontend/src/components/cards/CardGrid.tsx` — no `DOWNLOAD_IDS`, no `downloadServices`
- [x] `packages/frontend/src/components/cards/ServiceCard.tsx` — `getBarColor`, `#4ADE80`, `#FF3B3B`, `getArrowTier`
- [x] Commit 8e7c401 exists
- [x] TypeScript: no errors (excluding pre-existing CSS false-positive in main.tsx)
- [x] Frontend tests: pass (vitest exits 0)
