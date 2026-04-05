---
phase: quick
plan: 260404-rxw
subsystem: backend/plex
tags: [plex, polling, adapter, tdd]
dependency_graph:
  requires: []
  provides: [fetchPlexSessions, plex-5s-poll]
  affects: [poll-manager, plex-streams, SSE-snapshot]
tech_stack:
  added: []
  patterns: [direct-poll-adapter, tdd-red-green]
key_files:
  created:
    - packages/backend/src/adapters/plex.ts
    - packages/backend/src/__tests__/plex-adapter.test.ts
  modified:
    - packages/backend/src/poll-manager.ts
decisions:
  - "fetchPlexSessions uses Accept: application/json header — avoids XML parsing complexity"
  - "httpsAgent with rejectUnauthorized=false — self-signed cert support for LAN PMS installs"
  - "updatePlexState() retained intact — Tautulli webhooks remain backward-compatible override path"
  - "plexConfig field added to PollManager — clears on config removal, ready for future use"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-05T03:11:46Z"
  tasks: 2
  files: 3
---

# Quick Task 260404-rxw: Switch Plex Data Source from Tautulli Webhook to Direct PMS Poll

**One-liner:** Direct 5-second poll of Plex `/status/sessions` JSON API via `fetchPlexSessions`, replacing the Tautulli-webhook-only data path in `PollManager`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create Plex adapter + unit tests (TDD) | e60cc8e | `adapters/plex.ts`, `__tests__/plex-adapter.test.ts` |
| 2 | Wire plex poller into PollManager | 0db78f8 | `poll-manager.ts` |

## What Was Built

### packages/backend/src/adapters/plex.ts

`fetchPlexSessions(baseUrl, token): Promise<PlexStream[]>` — polls `GET /status/sessions?X-Plex-Token=<token>` with `Accept: application/json`. Mapping rules:

- Movie type: bare `title`
- Episode/track type: `grandparentTitle - title`
- `TranscodeSession` present → `transcode: true`; absent → `transcode: false`
- `Player.title` → `deviceName`
- Empty/missing `Metadata` → `[]`
- Network errors → `[]` (never throws)
- Self-signed cert support via `https.Agent({ rejectUnauthorized: false })`

### packages/backend/src/poll-manager.ts

- Added `import { fetchPlexSessions } from './adapters/plex.js'`
- Added `PLEX_INTERVAL_MS = 5_000` constant
- Added `private plexConfig: { baseUrl: string; token: string } | null = null` field
- Replaced the Tautulli-only plex early-return block with a `setInterval(doPollPlex, PLEX_INTERVAL_MS)` loop — immediate first poll, then every 5 seconds
- On each poll: updates `this.plexStreams` and marks plex `status: 'online'`, then calls `broadcastSnapshot()`
- `updatePlexState()` retained unchanged for Tautulli webhook backward-compat
- `plexConfig` cleared to `null` when plex config is removed (null config branch)

## Verification

- 11 plex-adapter unit tests pass (movie, TV, music, transcode, idle, error paths)
- 5 tautulli-webhook tests pass (backward-compat confirmed)
- Full backend suite: 77/77 tests pass across 12 test files
- TypeScript build: clean (no errors)

## Deviations from Plan

None — plan executed exactly as written.

The plan's test command `npm run test --workspace=packages/backend` was adapted to `npx vitest run` from root (vitest is configured at root level, not per-package). This is a test-runner invocation detail, not a code deviation.

## Known Stubs

None. `progressPercent` is intentionally set to `0` per the plan specification: "Plex sessions endpoint does not expose viewOffset in a reliable way — set to 0 for now." This is a documented design choice, not a stub preventing the plan's goal.

## Self-Check: PASSED

- `packages/backend/src/adapters/plex.ts` — FOUND
- `packages/backend/src/__tests__/plex-adapter.test.ts` — FOUND
- `packages/backend/src/poll-manager.ts` modified — FOUND
- Commit e60cc8e — FOUND
- Commit 0db78f8 — FOUND
