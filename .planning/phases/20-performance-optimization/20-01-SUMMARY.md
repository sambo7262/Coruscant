---
phase: 20-performance-optimization
plan: "01"
subsystem: backend
tags: [performance, sqlite, batching, caching, metrics]
dependency_graph:
  requires: []
  provides: [metric-write-batching, metrics-api-cache]
  affects: [packages/backend/src/db.ts, packages/backend/src/poll-manager.ts, packages/backend/src/routes/metrics.ts]
tech_stack:
  added: []
  patterns: [write-batching, ttl-cache, native-sqlite-transaction]
key_files:
  created:
    - packages/backend/src/__tests__/metric-buffer.test.ts
    - packages/backend/src/__tests__/metrics-cache.test.ts
  modified:
    - packages/backend/src/db.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/routes/metrics.ts
decisions:
  - "Used getSqlite() export instead of Drizzle ORM for batched INSERTs — Drizzle has no native transaction batching API at the level needed; better-sqlite3 .transaction() is synchronous and ideal"
  - "clearMetricsCache() exported from metrics.ts for test isolation — module-level Map persists across tests without explicit reset"
  - "Buffer cleared BEFORE transaction attempt — a flush failure loses at most one 5-second window, acceptable trade-off for crash safety"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 2
  files_changed: 5
---

# Phase 20 Plan 01: SQLite Write Batching + API Response Cache Summary

**One-liner:** Native better-sqlite3 transaction batching reduces metric writes by ~80%; 45s TTL Map cache eliminates redundant query+downsample work on repeated API calls.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add getSqlite() export + write batching + API cache | f03f737 | db.ts, poll-manager.ts, routes/metrics.ts |
| 2 | Unit tests for write batching and API cache | 154009c | metric-buffer.test.ts, metrics-cache.test.ts |

## What Was Built

### PERF-01: Metric Write Batching (poll-manager.ts)

Previously, `writeMetricsSnapshot()` issued one `INSERT` per poll tick. NAS + UniFi poll at 1 Hz each, producing ~2 INSERTs/second = ~120 write syscalls/minute.

Now:
- `writeMetricsSnapshot()` pushes to `metricBuffer: Map<string, Array<{timestamp, metrics}>>` — zero I/O
- `flushMetricBuffer()` runs every 5 seconds via `setInterval`, wrapping all accumulated rows in a single `better-sqlite3` `.transaction()` — one WAL commit per 5-second window
- `stopAll()` calls `flushMetricBuffer()` synchronously before clearing any timers — guarantees no data loss on graceful shutdown
- Flush failure is caught and logged as `warn`; the service never crashes due to a write failure

### PERF-02: Metrics API TTL Cache (routes/metrics.ts)

Previously, every `/api/metrics/history` call hit SQLite with a range scan + full downsample computation.

Now:
- `responseCache: Map<string, CacheEntry>` holds results keyed by `"${service}:${window}"`
- Max 9 entries (3 services × 3 windows) — bounded by `validWindows` check, no unbounded growth
- TTL of 45 seconds — cached results served immediately without re-querying SQLite
- Cache is populated on first miss and served on subsequent hits until expiry

### getSqlite() Export (db.ts)

Added `getSqlite(): Database.Database | null` to expose the raw better-sqlite3 instance. Required for `flushMetricBuffer()` to call `.transaction()` natively — Drizzle ORM does not expose a batch-insert transaction API at the needed level.

## Deviations from Plan

### Auto-added: clearMetricsCache() export

- **Rule:** Rule 2 (missing critical functionality for test correctness)
- **Found during:** Task 2
- **Issue:** `responseCache` is module-level state that persists across test runs. Without an explicit reset, early tests would pollute later ones (cache hit when a miss is expected).
- **Fix:** Added `export function clearMetricsCache(): void` to `routes/metrics.ts`; called in `beforeEach` of metrics-cache.test.ts
- **Files modified:** packages/backend/src/routes/metrics.ts
- **Commit:** 154009c

## Test Results

```
Test Files  21 passed (21)
     Tests  193 passed (193)
  Duration  4.79s
```

9 new tests added:
- `metric-buffer.test.ts`: 5 tests (no immediate write, 5s flush, 1 transaction for 10 writes, stopAll drain, failure resilience)
- `metrics-cache.test.ts`: 4 tests (cache miss, cache hit within TTL, key isolation, invalid window rejection)

## Known Stubs

None — all functionality is wired to real SQLite and real metric data.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. Threat model T-20-01 through T-20-04 addressed:
- Cache bounded to max 9 keys (T-20-01)
- Cache key uses validated `window` param (T-20-03)
- Buffer bounded to ~10 rows/flush at current poll rates (T-20-04)

## Self-Check: PASSED

- packages/backend/src/db.ts: FOUND (getSqlite export at line 35)
- packages/backend/src/poll-manager.ts: FOUND (metricBuffer, flushMetricBuffer, getSqlite import)
- packages/backend/src/routes/metrics.ts: FOUND (responseCache, CACHE_TTL_MS, clearMetricsCache)
- packages/backend/src/__tests__/metric-buffer.test.ts: FOUND
- packages/backend/src/__tests__/metrics-cache.test.ts: FOUND
- Commit f03f737: FOUND
- Commit 154009c: FOUND
- All 193 tests passing
