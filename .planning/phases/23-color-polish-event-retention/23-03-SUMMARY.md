---
phase: 23-color-polish-event-retention
plan: "03"
subsystem: timeline-event-retention
tags: [backend, frontend, logs, timeline, event-retention]
dependency_graph:
  requires: []
  provides: [server-side time filtering on /api/logs, time-window-based media event fetch]
  affects: [MediaEventList.tsx, logs.ts]
tech_stack:
  added: []
  patterns: [drizzle gte filter on text timestamp column, since query param for time-bounded fetch]
key_files:
  created: []
  modified:
    - packages/backend/src/routes/logs.ts
    - packages/frontend/src/components/timeline/MediaEventList.tsx
decisions:
  - "Raise /api/logs limit cap to 10000 when since param is present — sufficient for 7-day window at home-dashboard event volumes"
  - "Remove client-side time filter from MediaEventList — server now owns time-window responsibility, reducing client work and eliminating the 1000-entry cap truncation problem"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-03"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 23 Plan 03: Event Retention Fix Summary

Server-side time filtering via `since` ISO param on `/api/logs` replaces the 1000-entry client-side cap that caused media events to vanish before the 7-day retention window.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add since query param to /api/logs backend route | 6f223c9 | packages/backend/src/routes/logs.ts |
| 2 | MediaEventList fetches with since param instead of limit=1000 | 533aa33 | packages/frontend/src/components/timeline/MediaEventList.tsx |

## What Was Built

### Backend: /api/logs since param (logs.ts)

- Added `gte` to drizzle-orm imports
- Extended `Querystring` type to include `since?: string`
- When `since` is provided: push `gte(appLogs.timestamp, since)` filter and raise limit cap to 10000
- Without `since`: existing behavior unchanged — 500 default, 1000 max

### Frontend: Time-window fetch (MediaEventList.tsx)

- Compute `cutoff` ISO timestamp from `window` prop before fetch: `new Date(Date.now() - windowToMs(window)).toISOString()`
- Fetch URL is now `/api/logs?since=${encodeURIComponent(cutoff)}&level=all&service=all` — no `limit=1000`
- Removed client-side `.filter(entry => new Date(entry.timestamp).getTime() >= cutoff)` — server handles this
- `window` was already in the `useEffect` dependency array, so changing the time window re-fetches with the correct `since` value

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new security surface introduced. The `since` param flows into a drizzle-orm `gte()` call which is fully parameterized — no SQL injection risk. Hard 10000-entry cap enforced as per T-23-05 mitigation.

## Self-Check

- [x] packages/backend/src/routes/logs.ts modified and committed (6f223c9)
- [x] packages/frontend/src/components/timeline/MediaEventList.tsx modified and committed (533aa33)
- [x] Backend TypeScript check: no errors
- [x] Frontend TypeScript check: two pre-existing CSS import errors in main.tsx (unrelated to this plan), no errors in changed files

## Self-Check: PASSED
