---
phase: quick
plan: 260406-bko
subsystem: frontend-ui
tags: [uat, visual-polish, nas-tile, network-tile, plex-rail, download-section]
dependency_graph:
  requires: []
  provides: [nas-horizontal-bars, disk-led-centering, network-vertical-bars, plex-rail-stats, download-large-title]
  affects: [ServiceCard.tsx, CardGrid.tsx, NowPlayingBanner.tsx]
tech_stack:
  added: []
  patterns: [horizontal-bar-gauge, vertical-bar-gauge, cockpit-label-sizing-22px]
key_files:
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
decisions:
  - NasGaugeColumn vertical bars replaced with inline horizontal bar rendering — avoids component overhead and fits tile width constraint
  - Network vertical bars use flex:1 width so they spread evenly in the column, no fixed pixel width needed for responsive layout
  - imageUpdateCount skipped — field absent from NasStatus type; label text alone sufficient for UAT requirement
key_decisions:
  - NAS CENTER col uses inline horizontal bar map instead of NasGaugeColumn — component retained for potential future use
  - peakClients fallback uses clientCount when peak is 0 — prevents empty vertical bar on fresh boot
metrics:
  duration: ~8min
  completed: 2026-04-06
  tasks_completed: 2
  files_modified: 3
---

# Phase quick Plan 260406-bko: UAT Round 5 — Disk LED Centering, NAS Bars, Network Vertical Bars, Plex Rail Stats, Download Polish Summary

UAT round 5: 10-point UI polish pass across NAS tile, Network tile, Plex bottom rail, and Media tile download section — horizontal NAS bars, true disk LED row centering, vertical network bars under ONLINE, Plex server stats in the rail, and large 22px download titles with thick SABnzbd progress bar.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | NAS tile overhaul — horizontal bars, disk LED centering, IMG labels, Docker label sizing | c894d49 | ServiceCard.tsx |
| 2 | Plex rail stats, Network vertical bars, Download section large title/bar | c894d49 | NowPlayingBanner.tsx, ServiceCard.tsx, CardGrid.tsx |

## Changes Made

### Task 1: NAS Tile Overhaul (ServiceCard.tsx)

**Disk LED row 2 centering:** Added `alignItems: 'center'` to the outer column wrapper `div` (`display: 'flex', flexDirection: 'column', alignItems: 'center'`). The inner row `div`s already had `justifyContent: row.length < 4 ? 'center' : 'flex-start'` — the outer `alignItems: 'center'` ensures partial rows are centered within the full-width column rather than anchored left.

**CPU/RAM/HD horizontal bars:** Replaced the three `NasGaugeColumn` vertical bar calls (lines ~237-263) with an inline horizontal bar map. Each bar: `14px height`, `border-radius: 3px`, `amber glow boxShadow`, full-width flex layout with label on left (10px mono), bar in middle (flex:1), value on right (12px mono). Colors driven by `getBarColor()` with green/amber/red thresholds. Volumes map `/volume1` → `HD`, others → `V2`, `V3`.

**IMG labels renamed:** "IMG UPDATE" → "Update Available" (amber dot + amber text), "IMG OK" → "No Update Available" (grey dot + grey text). Font size scaled to `10px`.

**Docker label sizing:** Section header `9px` → `11px`. Docker CPU/RAM value spans `16px` → `22px`. IMG label `8px` → `10px`.

### Task 2: Plex Rail, Network Vertical Bars, Download Section (multiple files)

**NowPlayingBanner.tsx — Plex stats:** Added `plexServerStats` display block in both the idle rail and the active collapsed strip (40px bar). Three spans: CPU (green glow), RAM (blue glow), bandwidth (grey glow) — all `11px`, `fontWeight: 600`, mono. Removed the three stale "server stats shown in Plex tile" comments.

**ServiceCard.tsx — Network vertical bars:** Replaced the horizontal CLIENTS bar + two `ThroughputBar` calls with three vertical bars (UP / DOWN / CLIENTS) side by side. Each bar: `16px wide`, `60px tall`, `background: #222`, fill from bottom with `position:absolute`, `transition: height 0.3s ease`, `boxShadow` glow. Labels below bar: `8px` mono uppercase. Layout: `display:flex, gap:12px, justifyContent:center, alignItems:flex-end, flex:1, paddingTop:8px`.

**CardGrid.tsx — DownloadActivity:** DOWNLOADS label `9px` → `22px bold amber`. Active title `9px amber` → `22px purple with textShadow glow`. Count badge `9px` → `14px`. SABnzbd bar height `3px` → `16px`, added `boxShadow: 0 0 6px var(--cockpit-amber)` on fill, SAB label `8px` → `11px`. Outer container: `display:flex, flexDirection:column, justifyContent:flex-start, minHeight:120px`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed imageUpdateCount reference — field absent from NasStatus type**
- **Found during:** Task 1, IMG label rename
- **Issue:** Plan said to append `(count)` using `nasStatus.imageUpdateCount`, but this field is not defined in `NasStatus` interface (`packages/shared/src/types.ts`)
- **Fix:** Omitted the count suffix entirely; "Update Available" label text alone satisfies the UAT requirement
- **Files modified:** ServiceCard.tsx

## Known Stubs

None — all data sources are wired live.

## Self-Check: PASSED

- `/Users/Oreo/Projects/Coruscant/packages/frontend/src/components/cards/ServiceCard.tsx` — FOUND
- `/Users/Oreo/Projects/Coruscant/packages/frontend/src/components/cards/CardGrid.tsx` — FOUND
- `/Users/Oreo/Projects/Coruscant/packages/frontend/src/components/layout/NowPlayingBanner.tsx` — FOUND
- Commit c894d49 — FOUND
