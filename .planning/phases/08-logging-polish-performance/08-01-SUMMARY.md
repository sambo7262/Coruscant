---
phase: 08-logging-polish-performance
plan: "01"
subsystem: backend
tags: [logging, sse, performance, sqlite, pino, unifi, plex, tautulli]
dependency_graph:
  requires: []
  provides:
    - app_logs SQLite table with pino transport capture
    - kv_store SQLite table for persistent key-value data
    - GET /api/logs, POST /api/logs/purge, GET /api/logs/export endpoints
    - GET/POST /api/settings/logs-retention endpoints
    - log-entry SSE event stream for real-time frontend log consumption
    - snapshotFingerprint change-detection in SSE route
    - All poll interval constants exported from poll-manager
    - UniFi peaks persisted to kv_store (survive restarts)
    - Tautulli webhook triggers immediate Plex re-poll on playback events
  affects:
    - packages/backend/src/routes/sse.ts (fingerprint + log-entry event)
    - packages/backend/src/poll-manager.ts (interval exports + triggerPlexRepoll)
    - packages/backend/src/adapters/unifi.ts (kv_store peaks)
    - packages/backend/src/routes/tautulli-webhook.ts (re-poll on playback)
    - packages/shared/src/types.ts (peakClients field on UnifiMetrics)
tech_stack:
  added: [node-cron (schedule), pino.multistream]
  patterns:
    - Writable stream subclass for pino transport to SQLite
    - Singleton EventEmitter (logEvents) for decoupled SSE push
    - kv_store upsert pattern for persistent high-water marks
    - Per-connection fingerprint string for SSE change detection
key_files:
  created:
    - packages/backend/src/log-events.ts
    - packages/backend/src/log-transport.ts
    - packages/backend/src/routes/logs.ts
    - packages/backend/src/__tests__/log-transport.test.ts
    - packages/backend/src/__tests__/logs.test.ts
  modified:
    - packages/backend/src/schema.ts
    - packages/backend/src/db.ts
    - packages/backend/src/index.ts
    - packages/backend/src/routes/settings.ts
    - packages/backend/src/routes/sse.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/routes/tautulli-webhook.ts
    - packages/backend/src/adapters/unifi.ts
    - packages/shared/src/types.ts
    - packages/backend/src/__tests__/tautulli-webhook.test.ts
decisions:
  - "pino.multistream used in index.ts to write to both stdout and SqliteLogStream — preserves Docker log visibility while capturing to DB"
  - "Writable stream subclass chosen over pino-abstract-transport to avoid ESM resolution issues with async transport factories"
  - "logEvents singleton EventEmitter decouples transport insert from SSE route — avoids coupling DB writes to open HTTP connections"
  - "snapshotFingerprint excludes timestamp field — prevents spurious re-renders when only the poll clock changes"
  - "UniFi peaks stored in kv_store with in-memory cache for performance — cache cleared on resetUnifiCache but DB rows persist across restarts"
  - "triggerPlexRepoll() added to PollManager class; plexConfig already existed as private field — no structural changes needed"
  - "tautulli-webhook.test.ts mock updated to include triggerPlexRepoll — required by deviation Rule 1 (bug: mock missing method caused 500s)"
metrics:
  duration: "~10 minutes"
  tasks_completed: 2
  files_modified: 15
  completed_date: "2026-04-06"
requirements_fulfilled: [LOG-01, LOG-02, LOG-03, LOG-04, PERF-01, PERF-02]
---

# Phase 08 Plan 01: Backend Logging, SSE Polish, and Performance Summary

**One-liner:** SQLite-backed pino log capture with REST API, SSE change-detection fingerprinting, UniFi kv_store high-water marks, and Tautulli-triggered instant Plex re-poll.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Database schema, pino transport, log events, log API routes | 723c061 | schema.ts, db.ts, log-transport.ts, log-events.ts, routes/logs.ts, routes/settings.ts, index.ts |
| 2 | SSE change detection, poll interval tuning, Tautulli re-poll, UniFi kv_store peaks | 156cb96 | routes/sse.ts, poll-manager.ts, routes/tautulli-webhook.ts, adapters/unifi.ts, shared/types.ts |

## What Was Built

### Task 1: Logging Infrastructure

- **`app_logs` table**: SQLite table with `id`, `timestamp`, `level`, `service`, `message`, `payload` columns. Three indexes on `timestamp`, `level`, `service` for efficient filtering.
- **`kv_store` table**: Generic key-value persistence table used by both log retention settings and UniFi high-water marks.
- **`SqliteLogStream`**: `node:stream.Writable` subclass. Receives pino JSON line chunks, parses level/service/msg, skips debug/trace (level < 30), inserts into `app_logs`, emits `logEvents.emit('entry')`.
- **`logEvents`**: Singleton `EventEmitter` with `setMaxListeners(50)` — decouples DB write from SSE connection lifecycle.
- **`GET /api/logs`**: Paginated query with `level` and `service` filters. `level=warn` returns warn+error; `level=error` returns error only; `level=all` returns all.
- **`POST /api/logs/purge`**: Deletes entries older than `olderThanDays`. Uses `lt(appLogs.timestamp, cutoff)` Drizzle filter.
- **`GET /api/logs/export`**: Returns `Content-Disposition: attachment` JSON file with filtered entries.
- **`GET/POST /api/settings/logs-retention`**: Reads/writes `logs.retention_days` key in `kv_store`. Default 7 days. Range validation 1-365.
- **Nightly 3am cron**: `node-cron` `schedule('0 3 * * *', ...)` reads `logs.retention_days` from kv_store, deletes stale entries.
- **`pino.multistream`**: index.ts now writes pino output to both `process.stdout` (Docker log visibility) and `SqliteLogStream` (DB capture).

### Task 2: SSE, Polling, and Persistence

- **`snapshotFingerprint`**: Deterministic JSON string from meaningful snapshot fields, excluding `timestamp`. Per-connection `lastFingerprint` prevents SSE writes when state hasn't changed (D-04 stale-data flicker fix).
- **`log-entry` SSE event**: SSE route subscribes to `logEvents.on('entry')` and writes `event: log-entry\ndata: ...` to the stream. Cleanup unsubscribes on connection close.
- **Poll interval tuning**: `NAS_INTERVAL_MS = 1_000` (was 3s), `UNIFI_INTERVAL_MS = 3_000` (was 30s). All 7 interval constants now exported as named exports.
- **`triggerPlexRepoll()`**: New `PollManager` method. Uses stored `this.plexConfig` to call `fetchPlexSessions` + `fetchPlexServerStats` and immediately update state.
- **Tautulli re-poll**: `IMMEDIATE_REPOLL_EVENTS` set covers play/stop/pause/resume variants. After `updatePlexState`, fire-and-forget `triggerPlexRepoll()` on matching events.
- **UniFi kv_store peaks**: `peakTxMbps`, `peakRxMbps`, `peakClientCount` read from kv_store on first access (lazy cache) and upserted on new highs. `schedulePeakReset()` and `PEAK_WINDOW_MS` removed. `resetUnifiCache()` clears in-memory cache only — DB rows persist across restarts.
- **`peakClients` field**: Added `peakClients?: number` to `UnifiMetrics` shared type for frontend bar gauge rendering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tautulli-webhook.test.ts mock missing triggerPlexRepoll**
- **Found during:** Task 2 test run
- **Issue:** The existing mock for `pollManager` only included `updatePlexState`. Adding `pollManager.triggerPlexRepoll()` call to the webhook handler caused 500 errors in tests (`TypeError: pollManager.triggerPlexRepoll is not a function`).
- **Fix:** Added `triggerPlexRepoll: vi.fn().mockResolvedValue(undefined)` to the mock factory in `tautulli-webhook.test.ts`.
- **Files modified:** `packages/backend/src/__tests__/tautulli-webhook.test.ts`
- **Commit:** 156cb96

## Known Stubs

None — all new endpoints return real data from SQLite. No hardcoded empty values or placeholders.

## Test Results

```
Test Files  1 failed | 15 passed (16)
Tests       3 failed | 155 passed (158)
```

The 3 failures are pre-existing in `plex-adapter.test.ts` (NaN comparison in `processRamPercent` / `processCpuPercent`) and were present before this plan began. All new tests pass.

## Self-Check: PASSED

- `packages/backend/src/log-events.ts` — FOUND
- `packages/backend/src/log-transport.ts` — FOUND
- `packages/backend/src/routes/logs.ts` — FOUND
- `packages/backend/src/__tests__/log-transport.test.ts` — FOUND
- `packages/backend/src/__tests__/logs.test.ts` — FOUND
- Commit 723c061 — FOUND
- Commit 156cb96 — FOUND
