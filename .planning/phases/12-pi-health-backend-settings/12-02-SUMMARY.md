---
phase: 12-pi-health-backend-settings
plan: 02
subsystem: backend
tags: [pi-health, settings, ssh, debug, test-connection, startup]
dependency_graph:
  requires: [12-01]
  provides: [piHealth-settings-crud, piHealth-test-connection, piHealth-debug, piHealth-ssh-restart, piHealth-startup]
  affects: [packages/backend/src/routes/settings.ts, packages/backend/src/routes/test-connection.ts, packages/backend/src/routes/debug.ts, packages/backend/src/index.ts]
tech_stack:
  added: [ssh2]
  patterns: [ephemeral-password-ssh, encryption-bypass-for-keyless-services]
key_files:
  created:
    - packages/backend/src/routes/pi-health-restart.ts
    - packages/backend/src/__tests__/pi-health-restart.test.ts
  modified:
    - packages/backend/src/routes/settings.ts
    - packages/backend/src/routes/test-connection.ts
    - packages/backend/src/routes/debug.ts
    - packages/backend/src/index.ts
    - packages/backend/src/__tests__/settings.test.ts
    - packages/backend/package.json
    - package-lock.json
decisions:
  - piHealth bypasses ENCRYPTION_KEY_SEED requirement since it has no API key (D-12)
  - Poll interval stored in kvStore as milliseconds, exposed via GET endpoint as seconds
  - SSH username defaults to 'admin' when not configured
metrics:
  duration: 5m
  completed: 2026-04-07
  tasks: 2/2
  tests_added: 6
  tests_total: 188
---

# Phase 12 Plan 02: Pi Health Backend Settings & Routes Summary

Pi health fully wired into Settings CRUD with encryption bypass, test-connection validates Flask /health endpoint, /debug/pi-health returns raw response, SSH restart route with ephemeral password and shell-injection prevention, startup config loop handles piHealth despite empty encryptedApiKey.

## Task Results

### Task 1: Add piHealth to Settings CRUD, test-connection, debug endpoint, and startup loading
**Commit:** `88f021a`

- Added 'piHealth' to VALID_SERVICES in settings.ts and test-connection.ts (now 12 services)
- Settings POST for piHealth early-returns before ENCRYPTION_KEY_SEED check, storing baseUrl/username/enabled directly
- Poll interval from request body stored in kvStore as `piHealth.pollInterval` (milliseconds)
- Added GET /api/settings/pi-health-interval endpoint returning intervalSeconds (default 30)
- Test-connection piHealth case GETs /health and validates cpu_temp_c field presence
- Added /debug/pi-health route reading config from DB and returning raw Flask response
- index.ts: imported and registered piHealthRestartRoutes
- index.ts: startup config loop special-cases piHealth to skip encryptedApiKey check
- Updated settings.test.ts to expect 12 services instead of 11

### Task 2: Create SSH restart route and install ssh2 dependency
**Commit:** `9a20ba3`

- Installed ssh2 and @types/ssh2 in packages/backend
- Created POST /api/pi-health/restart route accepting ephemeral { password } in body
- Password used once for SSH, never stored/logged/persisted (D-12, D-14)
- Hardcoded RESTART_COMMAND prevents shell injection (T-12-05)
- Username validated against `/^[a-zA-Z0-9_-]+$/` regex (T-12-04)
- 10-second SSH_TIMEOUT_MS prevents hanging connections (T-12-08)
- Host extracted from piHealth baseUrl via URL parsing
- 6 tests: empty password, missing password, no config, invalid username, success (exit 0), failure (exit 1 with stderr)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed settings test expecting 11 services**
- **Found during:** Task 1
- **Issue:** Existing test hardcoded `expect(body.length).toBe(11)` which failed after adding piHealth
- **Fix:** Updated to `toBe(12)` and added `expect(serviceIds).toContain('piHealth')`
- **Files modified:** packages/backend/src/__tests__/settings.test.ts
- **Commit:** 88f021a

**2. [Rule 1 - Bug] Fixed duplicate variable declarations in settings.ts POST handler**
- **Found during:** Task 1
- **Issue:** Adding piHealth early-return block with `baseUrl` and `username` declarations before the existing ones caused duplicate `const` error
- **Fix:** Moved `baseUrl` and `username` extraction above the piHealth block, removed duplicate declarations below
- **Commit:** 88f021a

## Verification

All acceptance criteria met:
- `grep -n 'piHealth' packages/backend/src/routes/settings.ts` -- piHealth in VALID_SERVICES, POST handler, kvStore upsert
- `grep -n 'piHealth' packages/backend/src/routes/test-connection.ts` -- piHealth case with cpu_temp_c check
- `grep -n 'pi-health' packages/backend/src/routes/debug.ts` -- /debug/pi-health endpoint
- `grep -n 'piHealthRestartRoutes' packages/backend/src/index.ts` -- imported and registered
- `grep -n 'piHealth' packages/backend/src/index.ts` -- startup loop special case
- `grep 'ssh2' packages/backend/package.json` -- ssh2 dependency installed
- `npx vitest run` -- 188 tests pass (21 test files)

## Known Stubs

None -- all endpoints are fully functional with real data sources wired.

## Threat Surface

All threats from the plan's threat model are mitigated as specified:
- T-12-04: Username regex validation implemented
- T-12-05: Hardcoded command constant, never user-provided
- T-12-06: Password accepted per design (LAN-only, never stored)
- T-12-08: 10-second SSH timeout implemented
