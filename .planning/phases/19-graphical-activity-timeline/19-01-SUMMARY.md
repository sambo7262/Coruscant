---
phase: 19-graphical-activity-timeline
plan: "01"
subsystem: backend
tags: [metrics, sqlite, drizzle, fastify, timeseries, purge]
dependency_graph:
  requires: []
  provides: [metrics_history_table, GET /api/metrics/history]
  affects: [packages/backend/src/schema.ts, packages/backend/src/db.ts, packages/backend/src/poll-manager.ts, packages/backend/src/routes/metrics.ts, packages/backend/src/index.ts]
tech_stack:
  added: []
  patterns: [time-bucket downsampling, write-on-every-poll, composite index on (service, timestamp)]
key_files:
  created:
    - packages/backend/src/routes/metrics.ts
  modified:
    - packages/backend/src/schema.ts
    - packages/backend/src/db.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/index.ts
decisions:
  - "No write throttle — metrics written on every poll completion per explicit user override"
  - "Bucket sizes: 60s for 24h, 5m for 3d, 15m for 7d windows"
  - "Purge cron at 3:05am to stagger from 3:00am log prune"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 4
---

# Phase 19 Plan 01: Backend Metric Persistence Pipeline Summary

SQLite `metrics_history` table with Drizzle schema, per-poll write hooks for NAS/piHealth/pihole/UniFi (no throttle), and a `GET /api/metrics/history` endpoint with time-bucket downsampling and 7-day purge cron.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Schema + DB bootstrap + write hooks in PollManager | d499d7d | schema.ts, db.ts, poll-manager.ts |
| 2 | REST API endpoint + purge cron + route registration | 0cfc1d6 | routes/metrics.ts, index.ts |

## What Was Built

### metrics_history Table (Task 1)

Added `metricsHistory` Drizzle table to `schema.ts`:
- Columns: `id` (PK autoincrement), `timestamp` (ISO 8601 text), `service` (text), `metrics` (JSON text)
- Bootstrapped in `initDb()` via `CREATE TABLE IF NOT EXISTS` with a composite index on `(service, timestamp)`

### Poll Write Hooks (Task 1)

`PollManager.writeMetricsSnapshot()` is a private method that inserts a row on every call. Wrapped in try/catch so write failures never crash the poll loop. Hooked into:
- **NAS** (1s interval): cpu, ram, networkMbpsUp, networkMbpsDown, volumes[], optional dockerCpu/dockerRam
- **piHealth** (30s interval): cpuPercent, cpuTempC, memUsedMb, memTotalMb
- **pihole** (60s interval): queriesPerSecond, percentBlocked
- **unifi** (1s interval): wanTxMbps, wanRxMbps, clientCount

No write throttle exists — writes happen on every poll completion per user override.

### REST Endpoint (Task 2)

`GET /api/metrics/history?service=nas&window=24h`

- `window` validated against allowlist `['24h', '3d', '7d']`; returns 400 on invalid value (T-19-01 mitigated)
- `service` defaults to `'all'` (no service filter); specific service name filters by `eq(metricsHistory.service, ...)`
- Query uses composite index on `(service, timestamp)` via `gte(metricsHistory.timestamp, cutoff)` (T-19-02 mitigated)
- Response: `{ service, window, points: Array<{ timestamp, ...avgMetrics }> }`

### Time-Bucket Downsampling

`bucketPoints()` aggregates raw rows into time buckets by averaging numeric fields:
- 24h window → 60s buckets
- 3d window → 5m (300s) buckets
- 7d window → 15m (900s) buckets

Non-numeric metric values (e.g. `volumes` array) are excluded from averaging — only numeric fields appear in output points.

### 7-Day Purge (Task 2)

- **Startup purge**: runs immediately after `initDb()` — removes any rows older than 7 days from a previous run
- **Nightly cron**: `schedule('5 3 * * *', ...)` at 3:05am, staggered from the 3:00am log prune
- Both log `metrics_prune_complete` with cutoff timestamp and deleted row count

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder data, all writes are live poll data.

## Threat Surface Scan

No new trust boundaries beyond those in the plan's threat model:
- T-19-01 (window param injection) — mitigated by allowlist validation returning 400
- T-19-02 (full table scan DoS) — mitigated by composite index on (service, timestamp)
- T-19-03 (metric data on LAN) — accepted; same access model as all other /api endpoints

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| packages/backend/src/routes/metrics.ts exists | FOUND |
| packages/backend/src/schema.ts exists | FOUND |
| packages/backend/src/db.ts exists | FOUND |
| packages/backend/src/poll-manager.ts exists | FOUND |
| packages/backend/src/index.ts exists | FOUND |
| .planning/phases/19-graphical-activity-timeline/19-01-SUMMARY.md exists | FOUND |
| Commit d499d7d (Task 1) exists | FOUND |
| Commit 0cfc1d6 (Task 2) exists | FOUND |
