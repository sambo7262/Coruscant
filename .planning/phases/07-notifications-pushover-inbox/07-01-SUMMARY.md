---
phase: 07-notifications-pushover-inbox
plan: 01
subsystem: backend
tags: [webhooks, sse, poll-manager, arr, sabnzbd, burst-poll, tdd]
dependency_graph:
  requires: []
  provides:
    - arr webhook endpoints (7 services)
    - ArrWebhookEvent shared type
    - PollManager.handleArrEvent
    - PollManager.onArrEvent
    - SSE arr-event named message
    - SABNZBD burst poll on grab events
  affects:
    - packages/shared/src/types.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/routes/sse.ts
    - packages/backend/src/index.ts
tech_stack:
  added: []
  patterns:
    - TDD red-green ordering for all new tests
    - Fastify plugin per-route content-type parser (scoped, no conflict)
    - Subscriber pattern (onArrEvent) matching existing onBroadcast
    - Named SSE events (arr-event) distinct from dashboard-update
    - SABnzbd burst poll: 1s on grab, 10s normal, queue-empty fallback
key_files:
  created:
    - packages/backend/src/routes/arr-webhooks.ts
    - packages/backend/src/__tests__/arr-webhooks.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/routes/sse.ts
    - packages/backend/src/index.ts
decisions:
  - "Content-type parser scoped per Fastify plugin — arrWebhookRoutes registers its own parser with no conflict to tautulliWebhookRoutes (Fastify Pitfall 1)"
  - "classifyArrEvent and extractArrTitle exported at module level for testability via vi.importActual"
  - "SABNZBD_INTERVAL_MS and SABNZBD_BURST_MS exported as named constants — tests assert exact values, not literals"
  - "deactivateSabnzbdBurstPoll is public (not private) to allow queue-empty detection from inside burst poll timer"
metrics:
  duration: 227s
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_changed: 6
---

# Phase 07 Plan 01: Arr Webhook Backend Infrastructure Summary

**One-liner:** Arr webhook receiver endpoints (7 services) with PollManager event classification, SABnzbd burst polling (1s on grab / 10s normal), and named SSE arr-event emission.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Shared types + arr webhook routes + tests (TDD: tests first) | 326c835 | types.ts, arr-webhooks.ts, arr-webhooks.test.ts, index.ts |
| 2 | PollManager handleArrEvent + burst poll + SSE arr-event emission | 9ae8b8e | poll-manager.ts, sse.ts |

## What Was Built

### ArrWebhookEvent type (packages/shared/src/types.ts)
Added `ArrWebhookEvent` interface with `service`, `eventCategory` (grab/download_complete/health_issue/update_available/unknown), `title`, and `rawEventType` fields.

### Arr webhook routes (packages/backend/src/routes/arr-webhooks.ts)
A Fastify plugin registering `POST /api/webhooks/:service` for all 7 arr services: radarr, sonarr, lidarr, bazarr, prowlarr, readarr, sabnzbd. Empty bodies return 200 with `note: 'empty payload'`. Non-empty bodies call `pollManager.handleArrEvent(service, body)`.

### PollManager extensions (packages/backend/src/poll-manager.ts)
- `classifyArrEvent(rawEventType)` — maps Grab/Download/Health/ApplicationUpdate to normalized category
- `extractArrTitle(body)` — extracts display title from movie/series/artist/author/message fields
- `handleArrEvent(service, body)` — classify + log + notify listeners + trigger burst poll
- `onArrEvent(listener)` — subscriber pattern for SSE route
- `activateSabnzbdBurstPoll()` / `deactivateSabnzbdBurstPoll()` — 1s burst on grab, restores 10s normal on download_complete or queue-empty
- Exported constants: `SABNZBD_BURST_MS = 1000`, `SABNZBD_INTERVAL_MS = 10000`

### SSE route (packages/backend/src/routes/sse.ts)
Added `onArrEvent` subscription emitting named `event: arr-event` SSE messages. Added `onBroadcast` subscription for immediate push on Plex/NAS events (was previously polling-only via setInterval).

## Test Coverage

20 tests in `packages/backend/src/__tests__/arr-webhooks.test.ts`:
- 6 route tests: endpoint registration, handleArrEvent invocation, empty body handling
- 6 classifyArrEvent tests: all event categories + unknown fallback
- 6 extractArrTitle tests: movie/series/artist/author/message/empty
- 2 interval constant assertions: SABNZBD_BURST_MS=1000, SABNZBD_INTERVAL_MS=10000

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all functionality is wired. The burst poll and SSE arr-event emission are end-to-end connected. Frontend consumption is deferred to plan 07-02.

## Pre-existing Test Failures (Not Caused by This Plan)

3 tests in `plex-adapter.test.ts` (`fetchPlexServerStats`) were failing before this plan (NaN in processCpuPercent/processRamPercent). Confirmed pre-existing via stash verification. Out of scope for this plan.

## Self-Check: PASSED

Files exist:
- packages/shared/src/types.ts — modified, contains ArrWebhookEvent
- packages/backend/src/routes/arr-webhooks.ts — created
- packages/backend/src/__tests__/arr-webhooks.test.ts — created (20 tests, all passing)
- packages/backend/src/poll-manager.ts — modified, contains handleArrEvent
- packages/backend/src/routes/sse.ts — modified, contains arr-event
- packages/backend/src/index.ts — modified, registers arrWebhookRoutes

Commits verified:
- 326c835 — feat(07-01): add arr webhook routes for all 7 arr services
- 9ae8b8e — feat(07-01): add PollManager handleArrEvent, burst poll, and SSE arr-event emission
