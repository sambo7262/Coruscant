---
phase: 04-rich-service-integrations
plan: 02
subsystem: backend-adapters, backend-routes, poll-manager
tags: [pihole, nas, tautulli, webhook, polling, sse, adapters]
dependency_graph:
  requires:
    - 04-01 (shared types: NasStatus, PlexStream, PlexServerStats, DashboardSnapshot)
  provides:
    - Pi-hole v6 adapter with session management and query_types metrics
    - NAS adapter with DSM session management and fan/disk/volume data
    - Tautulli webhook endpoint for Plex stream events (replaces poll timer)
    - PollManager with live data for NAS, Plex streams, Pi-hole
    - broadcastSnapshot/onBroadcast pattern for SSE push on Plex events
  affects:
    - packages/frontend (getSnapshot now returns live NAS + Plex data)
    - 04-03+ (frontend consumes real data from these adapters)
tech_stack:
  added: []
  patterns:
    - Session singleton pattern (module-level Map keyed by baseUrl) for Pi-hole and DSM auth
    - Pi-hole v6 auth: POST /api/auth -> X-FTL-SID header on subsequent calls
    - DSM auth: GET SYNO.API.Auth login -> _sid query param on subsequent calls
    - Error code 119 = DSM session expiry -> invalidate + retry once
    - Tautulli webhooks: in-memory Map<session_key, PlexStream> for active streams
    - broadcastSnapshot/onBroadcast subscriber pattern for immediate SSE push
    - NAS fans: undefined (not []) when empty (D-19)
    - Plex has no poll timer — webhook-driven exclusively
    - Image update check on separate 12h timer (D-18)
key_files:
  created:
    - packages/backend/src/adapters/pihole.ts
    - packages/backend/src/adapters/nas.ts
    - packages/backend/src/routes/tautulli-webhook.ts
    - packages/backend/src/__tests__/pihole-adapter.test.ts
    - packages/backend/src/__tests__/nas-adapter.test.ts
    - packages/backend/src/__tests__/tautulli-webhook.test.ts
  modified:
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/index.ts
decisions:
  - "Pi-hole session cached in module-level Map keyed by baseUrl — singleton survives across polls, invalidated on 401"
  - "NAS fans field is undefined (not []) when empty — D-19 requires undefined not empty array"
  - "Plex has no poll timer — Tautulli webhook is the ONLY data source for Plex streams (D-25)"
  - "ARR_INTERVAL_MS changed from 45_000 to 5_000 (D-27)"
  - "NAS image update check on separate 12h timer, not the 3s poll interval (D-18)"
  - "broadcastSnapshot/onBroadcast pattern added to PollManager for immediate SSE push on Plex webhook events"
metrics:
  duration: 363s
  completed_date: "2026-04-04"
  tasks_completed: 3
  files_modified: 8
---

# Phase 04 Plan 02: Pi-hole/NAS Adapters, Tautulli Webhook, and Live PollManager Summary

Pi-hole v6 adapter (4-endpoint parallel poll with session management), NAS adapter (DSM auth with 3 parallel requests), Tautulli webhook handler for Plex stream events, and PollManager wired with live data replacing all stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1a | Pi-hole adapter with unit tests (TDD) | 8e54ecc | adapters/pihole.ts, __tests__/pihole-adapter.test.ts |
| 1b | NAS adapter + Tautulli webhook with unit tests (TDD) | e22cf57 | adapters/nas.ts, routes/tautulli-webhook.ts, __tests__/nas-adapter.test.ts, __tests__/tautulli-webhook.test.ts |
| 2 | Wire adapters and webhook into PollManager | 10c0bad | poll-manager.ts, index.ts |

## What Was Built

**Pi-hole adapter (adapters/pihole.ts):**
- Session singleton Map keyed by baseUrl — POST /api/auth once, cache sid for up to 25 min before validity
- 4 parallel GET requests with `X-FTL-SID` header: stats/summary, dns/blocking, info/system, stats/query_types
- blocking=enabled → `'online'` (green LED), blocking=disabled → `'warning'` (amber LED per D-05)
- 401 response invalidates session and retries the entire poll once
- `queryTypes` included in metrics as `Record<string, number>` (D-06)

**NAS adapter (adapters/nas.ts):**
- DSM session singleton Map keyed by baseUrl — GET SYNO.API.Auth login, cache sid for 25 min
- 3 parallel requests with `_sid` query param: System.Utilization, Core.System/storage, Hardware.FanSpeed
- DSM error code 119 (session expired) → invalidate + retry once
- CPU = user_load + system_load + other_load; RAM = real_usage percent
- Network bytes/sec converted to Mbps; volumes mapped with usedPercent
- Fans set to `undefined` when empty (not `[]`, per D-19)
- `checkNasImageUpdates()` reads SYNO.Docker.Image list, returns boolean, returns false on error

**Tautulli webhook (routes/tautulli-webhook.ts):**
- POST /api/webhooks/tautulli — no auth (LAN-only deployment)
- Supports playback.started, playback.paused, playback.resumed, playback.stopped
- In-memory `Map<session_key, PlexStream>` maintains active stream state
- Maps Tautulli `player` field → `PlexStream.deviceName` (Warning 1 in plan)
- `grandparent_title` (show name) takes precedence over `title` for TV episodes
- Calls `pollManager.updatePlexState()` after every event to push SSE snapshot
- Returns 400 for missing/unknown event type

**PollManager (poll-manager.ts):**
- ARR_INTERVAL_MS = 5_000 (D-27, was 45_000)
- New: PIHOLE_INTERVAL_MS = 60_000, NAS_INTERVAL_MS = 3_000, IMAGE_UPDATE_INTERVAL_MS = 12h
- `nasData`, `plexStreams`, `plexServerStats` instance fields — live data, no stubs
- `updatePlexState(streams, serverStats?)` — Tautulli webhook calls this; only Plex data entry point
- `broadcastSnapshot()` + `onBroadcast(listener)` subscriber pattern — immediate SSE push on Plex events
- Plex skips setInterval entirely — only marks as configured/stale, no poll timer
- NAS: 12h image update timer in addition to 3s poll timer
- `getSnapshot()` returns live `nasData`, `plexStreams`, `plexServerStats`
- `stopAll()` also clears `imageUpdateTimer`

**index.ts:**
- Imports and registers `tautulliWebhookRoutes`
- Passes `username` from `serviceConfig` when calling `pollManager.reload()`

## Test Results

65 tests pass across 11 test files including:
- 5 Pi-hole adapter tests (TDD)
- 5 NAS adapter tests (TDD)
- 5 Tautulli webhook tests (TDD)
- All pre-existing tests pass unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] test file used `afterEach` without importing it**
- **Found during:** Task 1b verification (RED phase)
- **Issue:** `tautulli-webhook.test.ts` used `afterEach` but only imported `beforeEach` from vitest
- **Fix:** Added `afterEach` to the vitest imports
- **Files modified:** packages/backend/src/__tests__/tautulli-webhook.test.ts
- **Commit:** e22cf57

**2. [Rule 1 - Bug] NAS re-auth test had incorrect mock counting logic**
- **Found during:** Task 1b verification (RED phase)
- **Issue:** Test counted auth calls by URL substring matching — but axios mock doesn't expose URL to the test mock filter correctly
- **Fix:** Rewrote test to use sequential call index counting instead of URL matching; verifies `getCallIndex >= 5` (auth + 3 data + re-auth) and CPU result is valid
- **Files modified:** packages/backend/src/__tests__/nas-adapter.test.ts
- **Commit:** e22cf57

**3. [Rule 1 - Bug] STUB_NAS string appeared in comment in poll-manager.ts**
- **Found during:** Task 2 post-verification grep
- **Issue:** Comment "replaces STUB_NAS and STUB_STREAMS from Phase 3" caused `grep STUB_NAS` check to match
- **Fix:** Rewrote comment to describe what the fields are instead of what they replaced
- **Files modified:** packages/backend/src/poll-manager.ts
- **Commit:** 10c0bad

**4. [Rule 1 - Deviation] index.ts used instead of server.ts**
- **Found during:** Task 2 setup
- **Issue:** Plan referenced `packages/backend/src/server.ts` but the actual entry point is `packages/backend/src/index.ts`
- **Fix:** Made all modifications to index.ts instead
- **Files modified:** packages/backend/src/index.ts
- **Commit:** 10c0bad

## Known Stubs

None. All NAS, Plex, and Pi-hole data now flows through live adapters and webhook events. The `plexStreams` array starts empty and populates as Tautulli sends webhook events — this is intentional behavior, not a stub.

## Self-Check: PASSED

Files confirmed present:
- packages/backend/src/adapters/pihole.ts — FOUND
- packages/backend/src/adapters/nas.ts — FOUND
- packages/backend/src/routes/tautulli-webhook.ts — FOUND
- packages/backend/src/__tests__/pihole-adapter.test.ts — FOUND
- packages/backend/src/__tests__/nas-adapter.test.ts — FOUND
- packages/backend/src/__tests__/tautulli-webhook.test.ts — FOUND

Commits confirmed:
- 8e54ecc — FOUND
- e22cf57 — FOUND
- 10c0bad — FOUND

TypeScript: PASSED (0 errors)
Tests: 65/65 passed
