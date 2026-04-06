---
phase: quick-260406-9rb
plan: 01
subsystem: frontend-ui, backend-adapters
tags: [uat, nas-tile, download-activity, network-tile, arr-adapter]
depends_on: []
provides: [activeTitle-in-arr-metrics, nas-3col-layout, pihole-percent-blocked, unifi-font-parity]
affects: [ServiceCard.tsx, CardGrid.tsx, arr.ts]
tech_stack:
  added: []
  patterns: [css-grid-3col, conditional-metrics-display]
key_files:
  created: []
  modified:
    - packages/backend/src/adapters/arr.ts
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
decisions:
  - imageUpdateAvailable (NasStatus field) used for Docker update indicator — dockerContainers array not in NasStatus type
  - percentBlocked rendered at 13px secondary size below QPM 20px primary to maintain hierarchy
  - activeTitle falls back to s.name.slice(0,7) when backend field is empty (idle state)
metrics:
  duration: ~8min
  completed: 2026-04-06
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 260406-9rb: Phase 8 UAT Round 2 — NAS/Media/Network Polish Summary

**One-liner:** Six targeted UAT fixes: arr adapter emits activeTitle/downloadQuality/downloadProgress; NAS tile restructured as 3-column grid with disk temp LEDs; download rows display clean title; Pi-hole shows XX.X% BLOCKED; UniFi font size matches Pi-hole visual weight.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend arr adapter with activeTitle, downloadQuality, downloadProgress | 3fa95b2 | packages/backend/src/adapters/arr.ts |
| 2 | Frontend — NAS 3-col layout, download title display, network tile polish | 1b89dd1 | packages/frontend/src/components/cards/ServiceCard.tsx, packages/frontend/src/components/cards/CardGrid.tsx |

## Changes Implemented

### Task 1 — arr adapter (arr.ts)
- Queue `pageSize` increased from 1 to 10 to capture actively-downloading records
- Queue records type-annotated with `movie`, `series`, `episode`, `artist`, `album`, `sizeleft`, `size` fields
- `downloadingRecords` filtered from records array; `activeDownloads` and `downloading` derived from filter result
- `activeTitle` derived per serviceId: Radarr = `movie.title`; Sonarr = `series.title — episode.title`; Lidarr = `album.title — artist.artistName`
- `downloadQuality` from `quality.quality.name`; `downloadProgress` calculated from `(1 - sizeleft/size) * 100`
- All three fields added to both metrics return objects (warning path and online path)

### Task 2 — Frontend
**NasTileInstrument (ServiceCard.tsx):**
- Replaced flex-column vertical stack with `display: grid, gridTemplateColumns: '1fr 2fr 1fr'`
- LEFT col: disk temp LED dots (8x8px circle) colored green/amber/red by threshold; temp in Fahrenheit; DISK N label
- CENTER col: NasGaugeColumn bars with `barWidth="6px"` `barHeight="45px"` (25% smaller than default 8px/60px)
- RIGHT col: Docker section label "Docker", CPU/RAM percent values; `imageUpdateAvailable` amber dot + "UPDATE" indicator
- `NasGaugeColumn` updated to accept optional `barWidth` and `barHeight` props (defaults `'8px'` / `'60px'`)

**NetworkInstrument (ServiceCard.tsx):**
- Pi-hole: `percentBlocked` rendered below QPM row at 13px (secondary weight vs 20px QPM)
- UniFi: health status label increased from `9px` to `14px`
- `ThroughputBar` value text increased from `10px` to `13px`

**DownloadActivity (CardGrid.tsx):**
- `activeTitle` extracted from `s.metrics.activeTitle`; falls back to `s.name.slice(0, 7)` when empty
- Label `width: '44px'` replaced with `maxWidth: '80px'` + `overflow: hidden` + `textOverflow: ellipsis`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `dockerContainers` field does not exist on NasStatus type**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified `nasStatus.dockerContainers.some(c => c.updateAvailable)` but `NasStatus` only has `docker?: NasDockerStats` and `imageUpdateAvailable?: boolean`
- **Fix:** Used `nasStatus.imageUpdateAvailable === true` for the Docker update dot indicator — semantically equivalent
- **Files modified:** packages/frontend/src/components/cards/ServiceCard.tsx

## Checkpoint Reached

Tasks 1 and 2 complete. Stopped at Task 3 (checkpoint:human-verify) — awaiting visual verification.

## Self-Check: PASSED

- packages/backend/src/adapters/arr.ts — exists, modified
- packages/frontend/src/components/cards/ServiceCard.tsx — exists, modified
- packages/frontend/src/components/cards/CardGrid.tsx — exists, modified
- Commit 3fa95b2 — exists
- Commit 1b89dd1 — exists
- Backend build: passes (0 TypeScript errors)
- Frontend build: passes (0 TypeScript errors, 721KB bundle)
