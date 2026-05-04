---
phase: 20-performance-optimization
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - packages/backend/src/__tests__/metric-buffer.test.ts
  - packages/backend/src/__tests__/metrics-cache.test.ts
  - packages/backend/src/db.ts
  - packages/backend/src/poll-manager.ts
  - packages/backend/src/routes/metrics.ts
  - packages/frontend/src/components/cards/ServiceCard.test.tsx
  - packages/frontend/src/components/timeline/SparklineCard.memo.test.tsx
  - packages/frontend/src/components/timeline/SparklineCard.tsx
  - packages/frontend/src/pages/TimelinePage.tsx
  - vitest.config.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase introduces three performance optimizations: PERF-01 (metric write batching in PollManager), PERF-02 (TTL response cache for `/api/metrics/history`), and PERF-03 (React.memo on SparklineCard). Supporting test files cover all three features.

The core logic is sound and the overall approach is well-matched to the NAS/ARM64 deployment target. However, there are five warning-level issues that could cause data loss, silent failures in tests, or correctness gaps in production:

1. `db.ts` has a structural duplication where `createDb()` and `getDb()` both open SQLite connections independently, making the `createDb()` export a footgun that bypasses the singleton.
2. The metric-buffer test spy patches `sqlite.transaction` after the `PollManager` constructor runs, so the flush-count assertion is silently measuring the wrong object reference.
3. `flushMetricBuffer` drops buffered data if `getSqlite()` returns `null` after the buffer has already been cleared — data is silently lost rather than re-queued.
4. `TimelinePage` shows the sparkline grid unconditionally when `error` is falsy, so during the initial loading state (before data arrives) all SparklineCards render with empty arrays, causing a flash of "NO HISTORY" text before data loads.
5. The `NAS_DISK_CONFIG` helper in `TimelinePage` has a stale copy-paste: it uses `unit: '%'` with `domain: [0, 100]`, which are correct for volume usage but the keys being mapped are `vol_*` (volume utilization). This is technically correct, but the companion disk-temp flow uses `dt_*` keys — the two sets of disk metrics could be confused in review. More concretely, the `diskMetrics` memo (line 132-138) filters for `vol_` keys from `nasPoints`, but the backend `writeMetricsSnapshot` for NAS writes `dt_N` (disk temperature) keys — there are no `vol_` keys being written, so `diskMetrics` always returns `[]` and the NAS toggle pills for volume metrics never appear.

---

## Warnings

### WR-01: `createDb()` silently bypasses the singleton — double-connection footgun

**File:** `packages/backend/src/db.ts:5-13`
**Issue:** `createDb()` is a standalone factory that opens its own `Database` connection independently of the `_db` / `_sqlite` singleton managed by `getDb()` and `getSqlite()`. Any caller that imports and uses `createDb()` will get a separate SQLite connection that is invisible to `getSqlite()`, so `flushMetricBuffer()` will write to a different connection than was initialised. If a test or future route calls `createDb()` instead of `getDb()`, the metric buffer, WAL pragmas, and `getSqlite()` will all be operating on a different file descriptor.
**Fix:** Either remove `createDb()` entirely (nothing in the reviewed files calls it), or rename it to make its standalone nature explicit and add a JSDoc warning:
```typescript
/**
 * Creates an isolated Database instance NOT connected to the app singleton.
 * Use only for one-off scripts or integration test fixtures that manage their
 * own lifecycle. For normal app use call getDb() / getSqlite() instead.
 */
export function createIsolatedDb(dbPath: string): AppDb { ... }
```

---

### WR-02: Transaction spy patches the wrong object in the flush-count test

**File:** `packages/backend/src/__tests__/metric-buffer.test.ts:46-59`
**Issue:** The test patches `sqlite.transaction` on the instance returned by `getSqlite()` *after* the `PollManager` constructor has already run. `PollManager.flushMetricBuffer()` calls `getSqlite()` at flush time (not at construction time), so this timing is fine. However, the spy resets the reference via `sqlite.transaction = origTransaction` at line 59 only after the assertion. If `vi.advanceTimersByTime` causes `flushMetricBuffer` to call `getSqlite()` again and that call returns a *new* instance (which can happen if `_sqlite` is reassigned between `beforeEach` calls), the spy on the old instance is never hit and `transactionCallCount` stays 0, making the assertion vacuously pass. The `beforeEach` does call `initDb()` then `getSqlite()` directly — these are safe here — but the test's correctness depends on the singleton identity remaining stable between the spy setup and the flush. A comment documenting this invariant would prevent future regressions:
```typescript
// INVARIANT: getSqlite() must return the same object reference here as it
// will during flushMetricBuffer(). If beforeEach ever resets _sqlite, move
// the spy setup into beforeEach before constructing PollManager.
const sqlite = getSqlite()!
```
More critically, the `afterEach` at line 18 calls `pm.stopAll()` which calls `flushMetricBuffer()` *again* after `vi.useRealTimers()`. Because `pm.stopAll()` is called at the end of the test body on line 66 (for the `stopAll` test) but also in `afterEach`, there is a double-flush risk. In the flush-count test, the second flush in `afterEach` may increment `transactionCallCount` to 2 after the assertion on line 58 has already passed — but if the assertion were moved after `afterEach` (impossible in Vitest), it would fail. This is not currently broken but is fragile.

---

### WR-03: Metric data silently discarded when `getSqlite()` returns null mid-flush

**File:** `packages/backend/src/poll-manager.ts:615-635`
**Issue:** `flushMetricBuffer()` clears `this.metricBuffer` (line 621: `this.metricBuffer.clear()`) before calling `getSqlite()` (line 624). If `getSqlite()` returns `null` (e.g., database not yet initialised, or a DB reset in a test), all buffered rows are discarded with no recovery path. The warn log does fire for the `try/catch` path but the null-return early exit at line 625 is silent. This is a data-loss scenario on startup if the flush timer fires before `initDb()` completes, though in practice the `PollManager` singleton is constructed after `initDb()` in the server entry point.
**Fix:** Guard before clearing, or re-queue on failure:
```typescript
private flushMetricBuffer(): void {
  if (this.metricBuffer.size === 0) return
  const sqlite = getSqlite()
  if (!sqlite) return  // DB not ready — buffer preserved for next tick
  const toFlush: Array<...> = []
  for (const [service, rows] of this.metricBuffer) {
    for (const row of rows) toFlush.push({ timestamp: row.timestamp, service, metrics: row.metrics })
  }
  this.metricBuffer.clear()
  // ... rest of flush
}
```

---

### WR-04: `diskMetrics` memo in TimelinePage filters for `vol_` keys that the backend never writes

**File:** `packages/frontend/src/pages/TimelinePage.tsx:132-138`
**Issue:** The `diskMetrics` memo on lines 132-138 filters `nasPoints` for keys starting with `vol_`. However, `PollManager.writeMetricsSnapshot` for NAS (poll-manager.ts line 429-435) writes disk temperature keys as `dt_1`, `dt_2`, etc. — there are no `vol_` keys. As a result `diskMetrics` is always `[]`, the NAS SparklineCard's toggle pills for volume metrics never appear, and the feature is silently dead. The disk-temp metric path (line 159-173) correctly uses `dt_` keys and is functional, but the NAS volume utilization toggle is broken.
**Fix:** Either remove the dead `diskMetrics` / `NAS_DISK_CONFIG` code if volume metrics are not being captured, or update the backend to write `vol_N` keys alongside `dt_N` keys, or rename the filter to match what is actually written:
```typescript
// If volume utilization metrics are added to backend, use the correct key prefix.
// Current backend writes: dt_1, dt_2 (disk temps). No vol_ keys exist yet.
const diskMetrics: MetricConfig[] = useMemo(() => [], []) // placeholder until vol_ keys added
```

---

### WR-05: Error state shows sparkline grid (potentially flashing "NO HISTORY") on initial render

**File:** `packages/frontend/src/pages/TimelinePage.tsx:264-321`
**Issue:** The sparkline grid is rendered when `!error` is true (line 264). On the very first render, `error` is `null` and `loading` is `true`, so the grid renders with empty point arrays while the fetch is in-flight. `SparklineCardInner` renders "NO HISTORY" when `points.length === 0` and `!loading` is false for the multiLine branch (line 104) — but for the standard branch (line 106-107), it checks `!hasData && !multiLine`, and `hasData` is false when `points` is empty, so if `loading` is falsy this shows "NO HISTORY". Because `loading` starts as `true`, the component renders a spinner initially — this is correct. However, if a user switches windows (`activeWindow` changes), `setLoading(true)` is called inside the `useEffect` asynchronously on the next tick after the effect fires. Between the `setActiveWindow` call and the next render cycle that clears points, the old non-empty points remain and the grid shows stale data. More importantly, after the `Promise.all` resolves and sets `loading: false`, then the user immediately switches windows again, there is one render where `loading=false` and `points=[]` simultaneously (state update batching in React 18 should prevent this, but it is not guaranteed across the `setLoading/setPoints` sequence). The risk is minor but the pattern could be made safer:
```typescript
// Reset points together with loading to prevent a stale-data flash
setLoading(true)
setNasPoints([])
setPiholePoints([])
setUnifiPoints([])
setPiHealthPoints([])
setError(null)
```

---

## Info

### IN-01: `vitest.config.ts` sets `environment: 'node'` globally but `.test.tsx` files require jsdom

**File:** `vitest.config.ts:5`
**Issue:** The root config sets `environment: 'node'`. The frontend test files (`ServiceCard.test.tsx`, `SparklineCard.memo.test.tsx`) override this with the `// @vitest-environment jsdom` docblock comment at the top of each file. This works correctly but is easy to forget on new test files. A comment in the config noting the override mechanism would help:
```typescript
test: {
  // Frontend .test.tsx files override this per-file with:
  // // @vitest-environment jsdom
  environment: 'node',
}
```

---

### IN-02: `getSnapshot()` performs a synchronous SQLite SELECT on every SSE tick

**File:** `packages/backend/src/poll-manager.ts:584-598`
**Issue:** `getSnapshot()` calls `getDb()` and issues a `db.select()` query against `kvStore` for the weather row on every invocation. This is called on every SSE snapshot delivery (which can be as frequent as every second for the NAS 1-second poll). The query is fast on SQLite, but it is unbuffered and runs synchronously on the event loop. This is consistent with the existing pattern in the codebase and is not a correctness issue, but it is worth noting as a future caching candidate similar to PERF-02.

---

### IN-03: `clearMetricsCache()` is exported solely for test isolation — consider a test-helper module

**File:** `packages/backend/src/routes/metrics.ts:14-16`
**Issue:** `clearMetricsCache` is a test-only export on a production module. This is a documented and deliberate pattern (the JSDoc says "Exported for test isolation only"), so it is acceptable. However, if the module grows, grouping test helpers into a separate `metrics.test-helpers.ts` file keeps the production API surface cleaner.

---

### IN-04: `formatValue` passes `null` to `parseFloat` without a null guard

**File:** `packages/frontend/src/components/timeline/SparklineCard.tsx:35-40`
**Issue:** `formatValue` checks `val === undefined || val === null` and returns `'--'` on line 36. However the function signature accepts `number | string | undefined` — `null` is not in the type. The `null` check at runtime is defensive code protecting against the `latestPoint[activeMetric.key]` access on line 69, which is typed as `number | string` from the `Record<string, number | string>` type but could be `undefined` in practice when the key is absent. The existing guard is correct; the type signature should be updated to match:
```typescript
function formatValue(val: number | string | undefined | null, unit?: string): string {
```

---

_Reviewed: 2026-05-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
