---
phase: 03-settings-first-service-adapters
plan: "02"
subsystem: backend-api
tags: [settings, crud, encryption, sse, poll-manager, test-connection]
dependency_graph:
  requires: ["03-01"]
  provides: ["settings-api", "test-connection-api", "real-sse-data"]
  affects: ["frontend-settings-page (03-03)", "sse-consumer (frontend)"]
tech_stack:
  added: []
  patterns:
    - "Fastify route registration pattern with typed params and body"
    - "AES-256-GCM encryption via crypto.ts for API key storage"
    - "PollManager.reload() for hot-reload polling on settings save"
    - "PollManager.getSnapshot() in SSE replacing mock generator"
    - "In-memory SQLite with manual table creation for test isolation"
key_files:
  created:
    - packages/backend/src/routes/settings.ts
    - packages/backend/src/routes/test-connection.ts
    - packages/backend/src/__tests__/settings.test.ts
  modified:
    - packages/backend/src/routes/sse.ts
    - packages/backend/src/__tests__/sse.test.ts
    - packages/backend/src/index.ts
decisions:
  - "Settings GET never returns encryptedApiKey or decrypted plaintext key — only hasApiKey boolean"
  - "POST with both baseUrl and apiKey empty disables service and stops polling (sets enabled=false)"
  - "test-connection always returns HTTP 200; success/failure communicated in body JSON"
  - "PollManager.reload() called after every successful settings save for immediate hot-reload"
  - "Stale compiled JS artifacts in src/ removed — they shadowed TypeScript source and caused test failures"
metrics:
  duration: "6m 4s"
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_changed: 6
---

# Phase 03 Plan 02: Settings API, Test-Connection, and SSE Refactor Summary

Settings CRUD routes with AES-256-GCM encrypted API key storage, test-connection endpoint for live service validation, and SSE refactored to serve PollManager real poll data instead of mock generator output.

## What Was Built

### Task 1: Settings CRUD and Test-Connection Routes

**`packages/backend/src/routes/settings.ts`** — Settings CRUD:
- `GET /api/settings` — lists all 7 services with `{ serviceName, baseUrl, hasApiKey, enabled }` (never exposes keys)
- `GET /api/settings/:serviceId` — reads single service config (same safe shape)
- `POST /api/settings/:serviceId` — upserts config with encrypted API key, hot-reloads PollManager
- Validates serviceId against `['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd']`
- Empty baseUrl + empty apiKey → disable service, stop polling

**`packages/backend/src/routes/test-connection.ts`** — Live connectivity test:
- `POST /api/test-connection/:serviceId` with `{ baseUrl, apiKey }`
- arr services: `GET /api/v3/health` with X-Api-Key header, 10s timeout
- bazarr: `GET /api/system/status?apikey=...`
- sabnzbd: `GET /api?mode=queue&output=json&apikey=...`
- Always returns HTTP 200; success/failure in body

**`packages/backend/src/index.ts`** — Server updates:
- Registers `settingsRoutes` and `testConnectionRoutes`
- Boot-time PollManager startup: loads all enabled configs from DB, decrypts API keys, starts polling

### Task 2: SSE Refactor to PollManager

**`packages/backend/src/routes/sse.ts`**:
- Replaced `generateMockSnapshot()` import with `pollManager.getSnapshot()`
- All SSE infrastructure preserved (headers, MockSocket detection, 5s interval, cleanup)
- Unconfigured services now appear with `configured: false` and `status: 'stale'`

**`packages/backend/src/__tests__/sse.test.ts`**:
- Added test verifying snapshot services have `configured` field (PollManager source confirmation)
- Verifies unconfigured services appear with `configured=false`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale compiled JS artifacts shadowing TypeScript source**
- **Found during:** Task 1 (GREEN phase debugging)
- **Issue:** Previous build commands had compiled TypeScript to JS files inside `src/` (e.g., `src/schema.js`, `src/routes/sse.js`, `src/mock/generator.js`). When Vitest resolved `.js` imports in ESM TypeScript files, it loaded the stale compiled JS instead of the TypeScript source. The stale `schema.js` did not contain `serviceConfig` (added in Phase 03-01 Plan 01), causing all settings route tests to return HTTP 500. The stale `sse.js` still imported `generateMockSnapshot`, causing the SSE refactor test to fail.
- **Fix:** Removed all stale `.js`, `.d.ts`, `.js.map`, `.d.ts.map` files from `packages/backend/src/` and subdirectories (`routes/`, `mock/`, `__tests__/`).
- **Files modified:** Deleted ~30 stale compiled artifacts from `packages/backend/src/**`
- **Commits:** Part of 2a56baa (Task 1), 8e9cc9a (Task 2)

**2. [Rule 1 - Bug] Test isolation: settings test used local DB, routes used singleton**
- **Found during:** Task 1 initial test run
- **Issue:** Original test design created a local in-memory DB and manually set up the table, but the `settingsRoutes` function calls `getDb()` which returns the module-level singleton. The test's DB and the route's DB were different objects, so table setup was lost.
- **Fix:** Updated `settings.test.ts` to call `bootstrapTestDb()` which calls `getDb()` (the same singleton) and creates `service_config` table there. Also moved `process.env.DB_PATH = ':memory:'` before any imports so the singleton initializes to in-memory.
- **Files modified:** `packages/backend/src/__tests__/settings.test.ts`

## Known Stubs

None — all plan goals achieved. PollManager data flows to SSE. Settings persist to SQLite. Test-connection validates live service health.

Note: `pihole`, `plex`, and `nas` appear in PollManager snapshots as `configured=false/status=stale` (no adapters yet — planned for Phase 04+). This is intentional and documented.

## Self-Check: PASSED

- FOUND: `packages/backend/src/routes/settings.ts`
- FOUND: `packages/backend/src/routes/test-connection.ts`
- FOUND: `packages/backend/src/__tests__/settings.test.ts`
- FOUND: `packages/backend/src/routes/sse.ts`
- FOUND: commits fd89ccb, 2a56baa, 8e9cc9a in git log
- All 50 tests pass (`npm test` exit 0)
