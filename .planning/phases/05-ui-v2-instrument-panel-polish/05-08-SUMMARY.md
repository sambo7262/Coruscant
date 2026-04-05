---
phase: 05-ui-v2-instrument-panel-polish
plan: 08
subsystem: plex-stream-display
tags: [plex, stream, ui, state-indicator, types]
dependency_graph:
  requires: [05-05]
  provides: [PlexStream.state, plex-state-icon]
  affects: [NowPlayingBanner, StreamRow]
tech_stack:
  added: []
  patterns: [unicode-icon, optional-type-field]
key_files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/adapters/plex.ts
    - packages/frontend/src/components/layout/StreamRow.tsx
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
decisions:
  - Unicode characters (▶ ⏸) used for state icons — no new icon library dependency added
  - Icon omitted for 'buffering' state to avoid visual noise during transition
  - Icon placement in StreamRow: far right of quality/transcode row, not a separate row
  - NowPlayingBanner rail: icon precedes title text with gap, truncation applied to title span only
metrics:
  duration: ~8min
  completed: 2026-04-04
  tasks: 6
  files: 4
---

# Phase 5 Plan 08: Plex Play/Pause State Indicator Summary

**One-liner:** Plex `state` field added end-to-end (shared types → plex adapter → StreamRow icon → NowPlayingBanner rail icon) using Unicode ▶/⏸, no new dependencies.

## What Was Built

The Plex `/status/sessions` API returns a `state` attribute on each session (`'playing'`, `'paused'`, `'buffering'`). This data was previously discarded. This plan wires it through all layers and displays it visually.

### Task 1 — PlexStream.state field (shared/types.ts)

Added optional `state?: 'playing' | 'paused' | 'buffering'` to `PlexStream`. Shared package rebuilt cleanly.

### Task 2 — Plex adapter extraction (adapters/plex.ts)

Added `state?: string` to `PlexMetadataItem`. In the session mapping, extracted with a narrow type guard:
```ts
state: (item.state === 'playing' || item.state === 'paused' || item.state === 'buffering')
  ? item.state
  : undefined,
```
Existing test fixtures lack a `state` attribute so all 14 tests continue passing with `state: undefined`.

### Task 3 — StreamRow icon

Added play/pause icon at far right of the quality/transcode span. Icon is 10px, amber when playing, dim `#666` when paused, absent when buffering or undefined. The containing `<span>` gained `display: flex` and `gap: 4px` to keep the icon visually tight to the preceding text.

### Task 4 — NowPlayingBanner collapsed rail icon

The `motion.span` for the cycling title now returns a JSX fragment containing:
1. The state icon (9px, same color logic as Task 3) — only rendered when state is playing or paused
2. The title text in its own `<span>` with `overflow: hidden` + `textOverflow: ellipsis`

The outer `motion.span` gained `display: flex` and `alignItems: center` so icon and title sit on the same baseline. Truncation is isolated to the title span so the icon always shows.

### Task 5 — Build and test verification

- `npm run build --workspace=packages/shared` — clean
- `npx vitest run packages/backend/src/__tests__/plex-adapter.test.ts` — 14/14 passed
- `npm run build --workspace=packages/frontend` — clean (2700 modules, 693KB bundle; chunk size warning is pre-existing)

## Deviations from Plan

None — plan executed exactly as written. Unicode characters used as specified; no new icon library dependency added.

## Known Stubs

None. The `state` field flows from Plex API through to UI. When no `state` is present (e.g. older Plex versions or fixture data), the icon is simply omitted — which is the correct fallback behavior.

## Self-Check

Files modified:
- packages/shared/src/types.ts — PlexStream.state field added
- packages/backend/src/adapters/plex.ts — PlexMetadataItem.state and mapping
- packages/frontend/src/components/layout/StreamRow.tsx — icon in quality row
- packages/frontend/src/components/layout/NowPlayingBanner.tsx — icon in rail

Tests: 14/14 plex adapter tests passed
Build: shared and frontend builds clean
