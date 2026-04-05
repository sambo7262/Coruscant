---
plan: 05-04
phase: 05-ui-v2-instrument-panel-polish
status: complete
completed: 2026-04-05
subsystem: frontend-plex-rail
tags: [plex, now-playing, stream-row, ui-polish]
dependency_graph:
  requires: [05-01]
  provides: [plex-rail-redesign, stream-media-type-badge]
  affects: [NowPlayingBanner, StreamRow]
tech_stack:
  added: []
  patterns: [framer-motion-cycling-titles, media-type-badge]
key_files:
  created: []
  modified:
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
    - packages/frontend/src/components/layout/StreamRow.tsx
    - packages/shared/src/types.ts
decisions:
  - "Cycling title uses AnimatePresence mode=wait with y-axis slide — clean cross-fade between stream titles at 4s interval"
  - "Audio badge uses purple (#BB86FC) to visually distinguish from VIDEO amber badge"
  - "Server stats in collapsed strip use .toFixed(0) for CPU/RAM and .toFixed(1) for Mbps — compact display at 10px font"
metrics:
  duration: ~8min
  tasks_completed: 2
  files_modified: 3
---

# Phase 05 Plan 04: NowPlayingBanner + StreamRow Polish Summary

Redesigned Plex rail collapsed strip with PLEX branding, cycling stream titles, and always-visible server stats. Added AUDIO/VIDEO media type badges to stream rows with audio-specific title formatting.

## What Was Built

**Task 1 — NowPlayingBanner collapsed rail redesign**
- Replaced marquee ticker (shouldScroll/tickerRef) with cycling title state using `setActiveIdx` and 4-second `setInterval`
- Added "PLEX" amber label as permanent left anchor in collapsed strip (D-29)
- Center zone: stream titles cycle via `AnimatePresence mode="wait"` with y-axis slide animation (D-24)
- Right zone: plexServerStats (CPU/RAM/Mbps) now always visible in collapsed state — no longer buried in expanded drawer (D-24)
- Reduced collapsed strip height from 48px to 40px for D-02 viewport budget
- Removed `buildTickerSegment`, `tickerRef`, `shouldScroll`, and marquee keyframe animation entirely

**Task 2 — StreamRow media type badge and audio display**
- Added `isAudio` guard from `stream.mediaType === 'audio'`
- AUDIO badge: purple/violet tint (`rgba(155,89,182,0.25)`, text `#BB86FC`)
- VIDEO badge: amber tint (`rgba(232,160,32,0.2)`, text `var(--cockpit-amber)`)
- Audio streams display "Track Title — Album Name" via `stream.albumName` (D-26)
- Audio quality uses codec string from backend ("FLAC 1411k") — no frontend change needed (D-27, fixed in Plan 01 adapter)
- TV streams retain "Title S1E5" format; movies retain "Title (2024)" format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added PlexStream mediaType/albumName/trackTitle to shared types**
- **Found during:** Task 2 — TypeScript errors on `stream.mediaType` and `stream.albumName`
- **Issue:** This worktree was created before Plan 01 ran in its own worktree. The Plan 01 additions to `packages/shared/src/types.ts` (mediaType, albumName, trackTitle fields) were not present.
- **Fix:** Added the three optional fields to `PlexStream` in this worktree's `packages/shared/src/types.ts`. Also ran `npm install` to restore workspace symlinks that were missing in the worktree.
- **Files modified:** `packages/shared/src/types.ts`
- **Commit:** 4c0cb46

## Self-Check: PASSED

Checked that both files were committed:
- `d937751` — NowPlayingBanner.tsx rework
- `4c0cb46` — StreamRow.tsx + shared types

All 77 tests pass. TypeScript compiles with only pre-existing CSS import warning (not introduced by this plan).

## Known Stubs

None — all data fields are wired from backend adapters. The audio quality fix (D-27) relied on Plan 01 backend changes; the display uses `stream.quality` directly.
