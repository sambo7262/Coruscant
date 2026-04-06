---
phase: quick
plan: 260406-dwj
subsystem: frontend-ui
tags: [uat, nas, network, downloads, prowlarr, polish]
dependency_graph:
  requires: []
  provides: [nas-section-labels, volu-hd-fix, network-bar-values, download-simplification, prowlarr-flash]
  affects: [ServiceCard.tsx, CardGrid.tsx, NasStatus type, nas adapter]
tech_stack:
  added: []
  patterns: [CSSProperties-const-style, React-NAS-section-labels, DSM-system-info-endpoint]
key_files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/adapters/nas.ts
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/styles/globals.css
decisions:
  - NasStatus.name populated from SYNO.Core.System info (no type param) — separate from storage call
  - Volume label logic uses regex match for both "volume1" and "/volume1" forms
  - Network bar value text placed above each bar as first child in flex column
  - Download section idle state shows DOWNLOADS header only; active shows title+bar+speed
  - Prowlarr warning flash uses existing ledPulseWarn keyframe (affects all arr services with warning)
metrics:
  duration: 12m
  completed_date: "2026-04-06T17:09:44Z"
  tasks: 2
  files: 5
---

# Phase quick Plan 260406-dwj: UAT Round 7 Polish Summary

**One-liner:** NAS section labels (DISKS/name/DOCKER), VOLU->HD root cause fix, network LOAD removal + bar values, download simplification, Prowlarr amber flash.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | NAS labels, VOLU fix, Prowlarr flash, network bar values, LOAD removal | e70a886 | types.ts, nas.ts, ServiceCard.tsx, globals.css |
| 2 | Simplify download section — title + SABnzbd bar + speed only | 23d7fc4 | CardGrid.tsx |

## What Was Built

### Task 1 Changes

**NasStatus.name field (types.ts + nas.ts)**
Added optional `name?: string` to NasStatus. The backend now makes a 5th parallel DSM request to `SYNO.Core.System` with `method: info` (no `type` param) to extract `server_name`. If the call fails or returns no server_name, the field is omitted (backward-compatible).

**VOLU -> HD root cause fix (ServiceCard.tsx)**
The DSM API returns volume names as `"volume1"` (no leading slash). Previous code checked `vol.name === '/volume1'` which never matched. Fixed with regex `vol.name.match(/^\/?volume(\d+)$/)` covering both `volume1` and `/volume1`. Single volume now shows `HD`, multi-volume shows `HD2`, `HD3`, etc.

**NAS section labels (ServiceCard.tsx)**
Added `NAS_SECTION_LABEL_STYLE` constant (9px amber mono, centered, uppercase). Three labels:
- LEFT column: "DISKS" above disk LED grid
- CENTER column: `nasStatus.name ?? 'NAS'` above CPU/RAM/HD bars
- RIGHT column: "DOCKER" replacing left-aligned "Docker" label, column now `alignItems: 'center'`

**LOAD removal (ServiceCard.tsx)**
Removed `load` variable declaration and both the LOAD value span and LOAD label div from NetworkInstrument's Pi-hole section.

**Network bar values (ServiceCard.tsx)**
Each vertical bar (UP/DOWN/CLIENTS) now has a value text element as the first child in its flex column, above the bar: e.g. `"12.4 Mbps"` for UP/DOWN, `"24"` for CLIENTS. Style: 8px mono, rgba(200,200,200,0.5).

**Prowlarr warning LED flash (ServiceCard.tsx)**
Added `animation: 'ledPulseWarn 1s ease-in-out infinite'` to the warning state return in `getLedStyle()`. Affects all arr services with warning status — flashing amber instead of solid.

**ledFlashPurple keyframe (globals.css)**
Added missing `@keyframes ledFlashPurple` (0%/100% opacity 0.4, 50% opacity 1.0) that was referenced in code but never defined.

### Task 2 Changes

**DownloadActivity rewrite (CardGrid.tsx)**
Active state now shows exactly: title (22px bold purple, uppercase mono) + SABnzbd progress bar (12px amber with glow) + speed text (right-aligned). Removed: per-arr service tag rows, arr-specific progress bars, "SAB" label prefix. Idle state shows only "DOWNLOADS" header with nothing below. Title derived from first `activeArr[n].metrics.activeTitle`, falling back to SABnzbd `currentFilename`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

Files verified present:
- packages/shared/src/types.ts — has `name?: string` in NasStatus
- packages/backend/src/adapters/nas.ts — has systemInfoRes 5th parallel call
- packages/frontend/src/components/cards/ServiceCard.tsx — DISKS label, HD fix, LOAD removed, bar values, warning animation
- packages/frontend/src/components/cards/CardGrid.tsx — simplified DownloadActivity
- packages/frontend/src/styles/globals.css — ledFlashPurple keyframe added

Commits verified:
- e70a886 feat(quick-260406-dwj-01)
- 23d7fc4 feat(quick-260406-dwj-02)

TypeScript: shared clean, backend clean, frontend pre-existing main.tsx CSS import error only (not introduced by this plan).
