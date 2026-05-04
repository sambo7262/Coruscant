# Phase 20: Performance Optimization - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce I/O pressure from high-frequency metric writes, add response caching to the metrics history API, and memoize SparklineCard components to prevent unnecessary re-renders. Pure backend + frontend optimization — no new features, no UI changes, no schema changes.

</domain>

<decisions>
## Implementation Decisions

### User Constraint
- **D-01:** No frontend experience degradation. All optimizations must be invisible to the user — same data freshness, same responsiveness, same visual behavior.

### Claude's Discretion
- **D-02:** Write batching strategy — batch window size (5-10s per success criteria), memory buffer structure, flush trigger, crash/data-loss tolerance tradeoffs
- **D-03:** API cache implementation — cache duration (30-60s per success criteria), invalidation approach (TTL vs explicit), whether to use in-memory Map or a lightweight cache library
- **D-04:** React memoization scope — whether to wrap only SparklineCard in `React.memo` or audit the full TimelinePage render tree for additional optimization opportunities
- **D-05:** Observability approach — whether to add logging for write batch sizes, cache hit rates, or render counts to verify optimizations are effective
- **D-06:** Error handling in the batch flush path — how to handle partial flush failures without losing buffered data

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Metric write path (batching target)
- `packages/backend/src/poll-manager.ts` — `writeMetricsSnapshot()` at line ~600; current per-poll INSERT into `metricsHistory`; NAS/UniFi poll at 1s = ~2 writes/sec from those alone
- `packages/backend/src/schema.ts` — Drizzle schema defining `metricsHistory` table
- `packages/backend/src/db.ts` — `getDb()` accessor for better-sqlite3 instance

### API endpoint (caching target)
- `packages/backend/src/routes/metrics.ts` — `/api/metrics/history` endpoint; queries SQLite + downsamples via `bucketPoints()` on every request; no caching layer

### Frontend components (memoization target)
- `packages/frontend/src/components/timeline/SparklineCard.tsx` — plain function component, not wrapped in `React.memo`; uses `useState` for active metric toggle
- `packages/frontend/src/pages/TimelinePage.tsx` — parent page; check for unnecessary re-renders cascading to SparklineCard children

### Poll intervals (context for batching decisions)
- `packages/backend/src/poll-manager.ts` lines 14-23 — NAS at 1s, UniFi at 1s, Plex at 5s, Arr services at 5s, SABnzbd at 10s, Pi-hole at 60s, Pi health at 30s

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Write Pattern
- `writeMetricsSnapshot()` does a synchronous `INSERT` per poll callback via better-sqlite3
- Called from multiple poll completions — NAS, Pi-hole, UniFi, Docker, Pi health
- Wrapped in try/catch that swallows errors (never crashes poll on write failure)

### Current API Pattern
- `/api/metrics/history` queries all matching rows, then downsamples via `bucketPoints()`
- Downsampling uses time-bucketed averaging — already good, just needs caching layer on top
- Valid windows: 24h (1min buckets), 3d (5min buckets), 7d (15min buckets)

### Current Frontend Pattern
- `SparklineCard` is a plain export (no `React.memo`)
- Uses internal `useState` for metric toggle — props-only memoization would be safe
- Recharts `ResponsiveContainer` may trigger layout recalculations — worth investigating

### Integration Points
- Batch flush needs to run on the same `getDb()` instance (single better-sqlite3 connection)
- Cache invalidation could key on `{service}:{window}` pairs
- `React.memo` comparison can use shallow equality on `points` array reference

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants zero visible impact on the frontend — optimizations must be transparent
- User deferred all technical decisions to Claude — maximize performance with the success criteria as guardrails
- Success criteria are specific: ~80% write reduction, 30-60s cache, `React.memo` on SparklineCard

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-performance-optimization*
*Context gathered: 2026-05-03*
