---
phase: quick-260405-byq
plan: "01"
subsystem: backend/plex-adapter
tags: [plex, polling, server-stats, bandwidth, tdd]
dependency_graph:
  requires: []
  provides: [fetchPlexServerStats, fetchPlexSessions-with-bandwidth]
  affects: [poll-manager.ts, plex.ts, plex-adapter.test.ts]
tech_stack:
  added: []
  patterns: [TDD-red-green, graceful-degradation, destructured-return]
key_files:
  created: []
  modified:
    - packages/backend/src/adapters/plex.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/__tests__/plex-adapter.test.ts
decisions:
  - fetchPlexServerStats accepts sessionBandwidthKbps parameter (pre-computed by caller) to avoid double-fetching /status/sessions
  - fetchPlexSessions return type changed from PlexStream[] to { streams, totalBandwidthKbps } — cleanest approach per plan FINAL DECISION
  - doPollPlex uses updatePlexState (instead of direct assignment + broadcastSnapshot) to avoid duplicate broadcast
metrics:
  duration: "39min"
  completed: "2026-04-05T16:20:11Z"
  tasks: 2
  files: 3
---

# Phase quick-260405-byq Plan 01: Extend Plex Adapter to Populate PlexServerStats Summary

**One-liner:** Direct PMS /statistics/resources polling for CPU/RAM/bandwidth via `fetchPlexServerStats`, replacing the Tautulli-only path for all Plex users.

## What Was Built

Two functions now populate `plexServerStats` in the dashboard snapshot from a direct PMS poll:

1. **`fetchPlexSessions`** (updated) — now returns `{ streams: PlexStream[], totalBandwidthKbps: number }`. Session bandwidth is summed from `Session.bandwidth` (kbps) across all active metadata items.

2. **`fetchPlexServerStats`** (new export) — calls `GET /statistics/resources?timespan=6&X-Plex-Token=...`, reads the first (most recent) `StatisticsResources` entry, computes:
   - `processCpuPercent` = `cpuPercentage` rounded to 1 decimal
   - `processRamPercent` = `(physMemMB / totalPhysMemMB) * 100` rounded to 1 decimal
   - `bandwidthMbps` = `sessionBandwidthKbps / 1000` rounded to 1 decimal
   - Returns `undefined` on empty response, network error, or non-200 (graceful degradation)

3. **`doPollPlex`** (updated in poll-manager.ts) — destructures `{ streams, totalBandwidthKbps }` from `fetchPlexSessions`, then calls `fetchPlexServerStats(baseUrl, apiKey, totalBandwidthKbps)`, and passes both to `updatePlexState(streams, serverStats)` which sets `plexServerStats` and triggers `broadcastSnapshot`.

## Tautulli Backward Compatibility

`tautulli-webhook.ts` was intentionally NOT modified. It still calls `pollManager.updatePlexState(streams, serverStats)` with its own `serverStats` derived from webhook payload fields (`plex_server_cpu`, `plex_server_ram`). The webhook path continues to function as a backward-compatible override for users who run Tautulli.

## Test Coverage

24 tests pass across two `describe` blocks:

- `fetchPlexSessions` (15 tests): all existing tests updated to use `result.streams` and `result.totalBandwidthKbps`; two new tests for bandwidth summation
- `fetchPlexServerStats` (9 tests): happy path, multi-entry (first used), empty array, missing key, network error, zero bandwidth, rounding, URL params

## Deviations from Plan

None — plan executed exactly as written. The `doPollPlex` refactor (using `updatePlexState` instead of separate `this.plexStreams = streams` + `broadcastSnapshot()`) was explicitly specified in Task 2 action step.

## Known Stubs

None. `fetchPlexServerStats` returns real data from PMS `/statistics/resources` on every 5-second Plex poll cycle.

## Self-Check: PASSED

- packages/backend/src/adapters/plex.ts — FOUND
- packages/backend/src/poll-manager.ts — FOUND
- packages/backend/src/__tests__/plex-adapter.test.ts — FOUND
- Commit 7fd0d86 — FOUND
- Commit 90bd9a5 — FOUND
