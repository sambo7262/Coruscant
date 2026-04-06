---
phase: quick
plan: 260406-gbd
subsystem: frontend-ui
tags: [uat, visual-polish, nas-volumes, download-title, plex-rail]
dependency_graph:
  requires: []
  provides: [index-based-hd-volume-labels, download-title-ellipsis, plex-rail-descender-fix]
  affects: [ServiceCard.tsx, CardGrid.tsx, NowPlayingBanner.tsx]
tech_stack:
  added: []
  patterns: [index-based-labeling, block-display-overflow, fixed-height-descender-room]
key_files:
  created: []
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
decisions:
  - volumeLabel() helper deleted in favor of inline index-based label derivation — simpler, no regex, deterministic
metrics:
  duration: ~5min
  completed: 2026-04-06
  tasks_completed: 2
  files_modified: 3
---

# Phase quick Plan 260406-gbd: UAT Round 9 Volume/Title/Plex Descender Fix Summary

Three targeted UAT round 9 visual fixes: index-based HD/HD2/HD3 volume labels (volumeLabel() deleted), download title block-display ellipsis overflow, and Plex rail descender room increased from 20px to 28px.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace volumeLabel() with index-based HD labels + download title overflow | 0593587 | ServiceCard.tsx, CardGrid.tsx |
| 2 | Fix Plex rail descender clipping | 3b46b3e | NowPlayingBanner.tsx |

## Changes Made

### Task 1: ServiceCard.tsx — volumeLabel() deleted

The `volumeLabel()` helper (14 lines with JSDoc + regex logic) was deleted entirely. Volume bars now derive their label inline:

```ts
...nasStatus.volumes.map((vol: NasVolume, idx: number) => ({
  label: idx === 0 ? 'HD' : `HD${idx + 1}`,
```

This is simpler, deterministic, and not dependent on DSM volume naming conventions.

### Task 1: CardGrid.tsx — download title overflow

The 22px purple title `<span>` was inline, which prevents `text-overflow: ellipsis` from activating. Added `display: 'block'` and `maxWidth: '100%'` to force block layout so the ellipsis triggers on overflow.

### Task 2: NowPlayingBanner.tsx — Plex rail descender fix

The cycling stream title container in the collapsed rail strip had `height: '20px'`. With 22px font, descenders on characters like g/y/p were clipped. Changed to `height: '28px'` to provide sufficient room.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes for frontend package (pre-existing CSS import noise unrelated to these changes)
- No references to `volumeLabel` remain in ServiceCard.tsx
- Volume bars use `idx === 0 ? 'HD' : \`HD${idx + 1}\`` (confirmed by grep)
- Download title span has `display: 'block'` and `maxWidth: '100%'`
- NowPlayingBanner title container height is 28px

## Known Stubs

None.

## Self-Check: PASSED

- `0593587` exists in git log
- `3b46b3e` exists in git log
- ServiceCard.tsx modified: volumeLabel deleted, index-based labels in place
- CardGrid.tsx modified: display:block + maxWidth:100% on download title span
- NowPlayingBanner.tsx modified: height 20px → 28px on collapsed strip title container
