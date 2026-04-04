---
phase: 04-rich-service-integrations
plan: 01
subsystem: shared-types, backend-schema, backend-routes
tags: [types, schema, settings, test-connection, poll-manager, phase4-foundation]
dependency_graph:
  requires: []
  provides:
    - NasDisk, NasFan, NasDockerStats, PlexServerStats shared types
    - Extended NasStatus with networkMbpsUp/Down, cpuTempC, disks, fans, docker, imageUpdateAvailable
    - Extended PlexStream with deviceName
    - Extended DashboardSnapshot with plexServerStats
    - serviceConfig.username column
    - settings routes accept pihole, plex, nas with username field
    - test-connection routes for Pi-hole v6, Plex, NAS DSM
    - PollManager reload() accepts username in config
  affects:
    - All Phase 4 plans (depend on these type contracts)
    - packages/frontend (consumes updated DashboardSnapshot, PlexStream types)
tech_stack:
  added: []
  patterns:
    - Interface-first foundation: types defined before adapters are wired
    - NAS 3-field config: baseUrl + apiKey (password) + username (DSM login)
    - Pi-hole v6 auth via POST /api/auth + session sid check
    - Plex auth via X-Plex-Token header on GET /
    - DSM auth via SYNO.API.Auth login with best-effort test-session logout
key_files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/schema.ts
    - packages/backend/src/routes/settings.ts
    - packages/backend/src/routes/test-connection.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/mock/generator.ts
    - packages/backend/src/__tests__/settings.test.ts
decisions:
  - "username column stored plaintext on serviceConfig — DSM login name is not a secret, only the password (apiKey) is encrypted"
  - "Pi-hole v6 only: POST /api/auth with password — v5 FTL API is not supported per D-02 decision"
  - "STUB_NAS now includes networkMbpsUp/Down required fields — NasStatus extended these from optional to required"
metrics:
  duration: 223s
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_modified: 7
---

# Phase 04 Plan 01: Type Contracts and Route Foundation Summary

Interface-first foundation establishing all Phase 4 shared types, database schema changes, settings/test-connection routes for Pi-hole v6 + Plex + NAS, and PollManager config signature update.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend shared types and database schema | f719a83 | packages/shared/src/types.ts, packages/backend/src/schema.ts |
| 2 | Extend settings, test-connection routes, and PollManager | 50a0b4c | settings.ts, test-connection.ts, poll-manager.ts, mock/generator.ts, settings.test.ts |

## What Was Built

**Shared types (packages/shared/src/types.ts):**
- New: `NasDisk` — disk ID, name, tempC, optional read/write bytes/sec
- New: `NasFan` — fan ID and RPM
- New: `NasDockerStats` — Docker container-level CPU/RAM/network stats
- New: `PlexServerStats` — Plex process CPU/RAM and bandwidth
- Extended `NasStatus`: added `networkMbpsUp`, `networkMbpsDown` (required), `cpuTempC?`, `disks?`, `fans?`, `docker?`, `imageUpdateAvailable?`
- Extended `PlexStream`: added required `deviceName` field (e.g., "Apple TV", "Chrome")
- Extended `DashboardSnapshot`: added optional `plexServerStats?`

**Database schema (packages/backend/src/schema.ts):**
- Added `username TEXT NOT NULL DEFAULT ''` column between `encryptedApiKey` and `enabled` — used by NAS for DSM login account

**Settings routes (packages/backend/src/routes/settings.ts):**
- VALID_SERVICES extended to include `pihole`, `plex`, `nas`
- All GET responses now include `username` field
- POST handler accepts `username` in body, stores plaintext (not a secret)
- `pollManager.reload()` called with `{ baseUrl, apiKey, username }`

**Test-connection routes (packages/backend/src/routes/test-connection.ts):**
- VALID_SERVICES extended to include `pihole`, `plex`, `nas`
- Pi-hole v6 handler: POST `/api/auth` with password, validates `session.sid` in response
- Plex handler: GET `/` with `X-Plex-Token` header, extracts `MediaContainer.friendlyName`
- NAS handler: GET `/webapi/entry.cgi` with `SYNO.API.Auth` login, best-effort logout of test session

**PollManager (packages/backend/src/poll-manager.ts):**
- `reload()` signature updated: `config: { baseUrl: string; apiKey: string; username?: string } | null`
- `STUB_NAS` updated with required `networkMbpsUp: 0` and `networkMbpsDown: 0` fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock generator to satisfy updated type contracts**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `mock/generator.ts` had `NasStatus` without `networkMbpsUp`/`networkMbpsDown` and `PlexStream` objects without `deviceName` — both now required fields
- **Fix:** Added `networkMbpsUp: Math.random() * 10`, `networkMbpsDown: Math.random() * 50` to mock NAS; added `deviceName: 'Apple TV'` and `deviceName: 'Chrome'` to mock streams
- **Files modified:** packages/backend/src/mock/generator.ts
- **Commit:** 50a0b4c

**2. [Rule 1 - Bug] Updated settings test for 10 services and new username column**
- **Found during:** Task 2 verification
- **Issue:** Test expected `body.length === 7` (now 10 services) and created DB table without `username` column
- **Fix:** Updated test to expect 10 services and include `pihole`, `plex`, `nas` in service list; added `username TEXT NOT NULL DEFAULT ''` to test DB schema
- **Files modified:** packages/backend/src/__tests__/settings.test.ts
- **Commit:** 50a0b4c

## Known Stubs

- `STUB_NAS` in `poll-manager.ts` — `networkMbpsUp: 0`, `networkMbpsDown: 0`, `volumes: []` — intentional placeholder; real NAS adapter wired in Plan 03
- `STUB_STREAMS` in `poll-manager.ts` — empty array — intentional; Plex adapter wired in Plan 02
- PollManager `reload()` returns early for `pihole`/`plex`/`nas` — "Unknown service" path — intentional; adapters wired in Plans 02 and 03

## Self-Check: PASSED

Files confirmed present:
- packages/shared/src/types.ts — FOUND
- packages/backend/src/schema.ts — FOUND
- packages/backend/src/routes/settings.ts — FOUND
- packages/backend/src/routes/test-connection.ts — FOUND
- packages/backend/src/poll-manager.ts — FOUND

Commits confirmed:
- f719a83 — FOUND
- 50a0b4c — FOUND

TypeScript: PASSED (both packages/shared and packages/backend)
Tests: 50/50 passed
