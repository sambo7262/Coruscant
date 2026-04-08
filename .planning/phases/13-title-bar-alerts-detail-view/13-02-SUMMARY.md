---
phase: 13-title-bar-alerts-detail-view
plan: 02
subsystem: frontend-plex-nowplaying
tags: [css-animation, transcode-indicator, plex, nowplaying]
dependency_graph:
  requires: [PlexStream.transcode boolean from backend adapter]
  provides: [transcodeGlow CSS keyframe, per-stream transcode visual indicator]
  affects: [NowPlayingBanner collapsed strip, StreamRow expanded drawer]
tech_stack:
  added: []
  patterns: [conditional CSS animation via inline style spread, comma-separated CSS animation composition]
key_files:
  created: []
  modified:
    - packages/frontend/src/styles/globals.css
    - packages/frontend/src/components/layout/StreamRow.tsx
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
decisions:
  - Used inline style spread for conditional animation rather than CSS class toggling -- consistent with existing codebase patterns
  - Combined transcodeGlow + downloadsMarquee via comma-separated animation values for long transcoding titles
metrics:
  duration: 60s
  completed: 2026-04-08T03:13:12Z
  tasks_completed: 1
  tasks_total: 1
  files_modified: 3
---

# Phase 13 Plan 02: Transcode Glow Animation Summary

Warm amber 3-second pulsing text-shadow glow on Now Playing stream titles when transcoding, applied per-stream in both collapsed banner strip and expanded drawer.

## What Was Done

### Task 1: Add transcodeGlow keyframe and apply warm amber glow to transcoding stream titles

**Commit:** c1ebdaa

**Changes:**

1. **globals.css** -- Added `@keyframes transcodeGlow` after the `ledFlashDown` block. The keyframe pulses `text-shadow` between a subtle 4px amber glow (30% opacity) and a brighter 10px+20px amber glow (70%/30%) over a 3-second ease-in-out cycle.

2. **StreamRow.tsx** -- Modified the title text `<span>` to conditionally apply `transcodeGlow 3s ease-in-out infinite` animation and `#FFD060` warm amber color when `stream.transcode` is true. Direct play streams retain the default `var(--text-offwhite)` color with no animation.

3. **NowPlayingBanner.tsx** -- Modified the collapsed strip title `<span>` to apply transcode glow per-stream. When a stream is transcoding AND has a long title (>28 chars), both `transcodeGlow` and `downloadsMarquee` animations run simultaneously via comma-separated CSS animation values with independent delays. When only transcoding (short title), just the glow runs. When only long title (direct play), just marquee runs.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `@keyframes transcodeGlow` present in globals.css (line 134)
- `transcodeGlow 3s` present in StreamRow.tsx (line 60)
- `stream.transcode` conditional check present in StreamRow.tsx (line 59)
- `transcodeGlow` present in NowPlayingBanner.tsx (lines 213-214)
- `#FFD060` warm amber color in StreamRow.tsx (line 61)
- TypeScript compilation: 2 pre-existing errors (unrelated to this plan), 0 new errors introduced

## Self-Check: PASSED
