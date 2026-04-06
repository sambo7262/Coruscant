---
phase: quick
plan: 260406-fsu
subsystem: frontend
tags: [nas-tile, downloads, uat, volume-label, sabnzbd]
dependency_graph:
  requires: []
  provides: [NAS volume HD label, NAS TheRock name, clean download title, 22px SABnzbd speed]
  affects: [ServiceCard.tsx NasTileInstrument, CardGrid.tsx DownloadActivity]
tech_stack:
  added: []
  patterns: [volumeLabel helper, cleanFilename helper, three-tier title lookup]
key_files:
  created: []
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
decisions:
  - volumeLabel() normalizes via .replace(/^\//,'').replace(/\s+/g,'').toLowerCase() before regex — covers all DSM casing/spacing variants
  - NAS name uses || instead of ?? so empty string also triggers TheRock fallback
  - cleanFilename() truncates at first year (19xx/20xx), quality tag (480p/720p/1080p), or source (WEB/Bluray) — reliable for standard arr NZB naming
  - SABnzbd speed unit "MB/s" rendered at 11px inside the 22px span — matches SabnzbdInstrument pattern in ServiceCard.tsx line 522
metrics:
  duration: 8min
  completed: "2026-04-06T18:27:26Z"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 260406-fsu: UAT Round 8 — VOLU label, NAS name, download title, speed font

**One-liner:** Case-insensitive volumeLabel() helper eliminates VOLU regression; TheRock name fallback; three-tier arr title lookup with cleanFilename(); SABnzbd speed at 22px bold amber.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | NAS tile volume label fix + device name fallback | 4b41d87 | ServiceCard.tsx |
| 2 | Download title three-tier lookup + SABnzbd speed font | 7af6aa6 | CardGrid.tsx |

## Changes Made

### Task 1 — ServiceCard.tsx

**volumeLabel() helper** added above `NasTileInstrument`:
- Strips leading slash, collapses whitespace, lowercases before matching `/^volume(\d+)$/`
- `volume1` / `/volume1` / `Volume 1` / `Volume1` all produce `"HD"`
- `volume2` etc. produce `"HD2"`
- Short names (≤4 chars) returned as-is; longer names sliced to 4

**Device name fallback** on line 251:
- Changed `nasStatus.name ?? 'NAS'` to `nasStatus.name || 'TheRock'`
- `||` catches both `null`/`undefined` and empty string `""`

**Label column width:** 26px → 28px to give HD2 comfortable headroom.

### Task 2 — CardGrid.tsx

**cleanFilename() helper** added above `DownloadActivity`:
- Removes extension, replaces dots/underscores with spaces
- Truncates at 4-digit year, resolution tag, or source tag
- `"Movie.Name.2024.1080p.WEB-DL.GROUP.mkv"` → `"Movie Name"`

**activeTitle three-tier lookup:**
1. arr service with `downloading === true` AND `activeTitle` set
2. ANY arr service with `activeTitle` (handles arr-to-SABnzbd handoff gap)
3. `cleanFilename(sabCurrentFilename)` as last resort

**SABnzbd speed font:**
- `fontSize: '9px'` → `fontSize: '22px', fontWeight: 600`
- `textShadow: '0 0 8px var(--cockpit-amber)'`
- Unit `MB/s` in nested `<span>` at `11px / fontWeight: 400`

## Verification

- TypeScript: only pre-existing `main.tsx` CSS side-effect import warning — no new errors
- Frontend build: `vite build` succeeded in 717ms, 2700 modules transformed

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `4b41d87` exists in git log
- `7af6aa6` exists in git log
- `packages/frontend/src/components/cards/ServiceCard.tsx` modified with `volumeLabel` function
- `packages/frontend/src/components/cards/CardGrid.tsx` modified with `cleanFilename` function and speed font fix
