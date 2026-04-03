---
phase: 03-settings-first-service-adapters
plan: 01
subsystem: database, api
tags: [drizzle, sqlite, aes-256-gcm, axios, node-cron, poll-manager, arr, bazarr, sabnzbd, vitest]

requires:
  - phase: 02-core-ui-shell
    provides: DashboardSnapshot, ServiceStatus, NasStatus, PlexStream types and SSE route

provides:
  - AES-256-GCM encrypt/decrypt helpers with seed-derived keys (crypto.ts)
  - serviceConfig Drizzle table with encrypted credential storage (schema.ts + migration)
  - pollArr adapter for Radarr/Sonarr/Lidarr/Prowlarr/Readarr via /api/v3/health
  - pollBazarr adapter for Bazarr via /api/system/status?apikey=
  - pollSabnzbd adapter with queue metrics (speed, count, progress, failed detection)
  - PollManager singleton with per-service hot-reload and 45s/10s poll intervals
  - SabnzbdMetrics and ArrHealthWarning interfaces in shared types
  - configured? flag on ServiceStatus for unconfigured service display

affects:
  - 03-02 (settings API routes — imports PollManager.reload)
  - 03-03 (settings UI — relies on configured? flag for display)
  - 03-04 (SSE transition — imports pollManager.getSnapshot)

tech-stack:
  added: [axios@1.14.0, node-cron@4.2.1, @types/node-cron@3.0.11]
  patterns:
    - AES-256-GCM encryption with SHA-256 key derivation from env seed
    - Adapter pattern per service type (pollArr/pollBazarr/pollSabnzbd)
    - PollManager singleton with Map<string, ServiceStatus> state cache
    - TDD red-green cycle for all new modules

key-files:
  created:
    - packages/backend/src/crypto.ts
    - packages/backend/src/adapters/arr.ts
    - packages/backend/src/adapters/bazarr.ts
    - packages/backend/src/adapters/sabnzbd.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/__tests__/crypto.test.ts
    - packages/backend/src/__tests__/arr-adapter.test.ts
    - packages/backend/src/__tests__/sabnzbd-adapter.test.ts
  modified:
    - packages/backend/src/schema.ts
    - packages/shared/src/types.ts
    - packages/backend/package.json

key-decisions:
  - "PollManager uses setInterval not node-cron — service polling is time-based not schedule-based; setInterval is simpler and testable"
  - "sabnzbd URL embeds apikey directly (?apikey=) not via header — SABnzbd API requires query param auth"
  - "crypto.ts uses parts.length !== 3 guard (not !ciphertextHex) — empty string encryption produces empty hex which is falsy, breaking the guard"
  - "drizzle/ migration output is gitignored; migration is regenerated from schema.ts at deploy time"

requirements-completed: [CFG-03, SVCST-01, SVCST-02, SVCST-03, SVCST-04, SVCST-05, SVCACT-01, SVCACT-02, SVCACT-03]

duration: 5min
completed: 2026-04-03
---

# Phase 3 Plan 01: Backend Data Layer Summary

**AES-256-GCM credential encryption, Drizzle serviceConfig table, three service polling adapters (arr/bazarr/sabnzbd), and PollManager singleton with per-service hot-reload intervals**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-03T13:17:03Z
- **Completed:** 2026-04-03T13:22:03Z
- **Tasks:** 2
- **Files modified:** 11 (5 created, 3 new, 3 modified)

## Accomplishments

- AES-256-GCM encryption with random IV per call, SHA-256 key derivation from `ENCRYPTION_KEY_SEED` env, round-trip verified by 8 tests
- Drizzle `service_config` table with encrypted API key storage and boolean enabled flag; migration generated
- Three service adapters: arr (Warning/Error→warning, Ok/Notice→online), bazarr (binary online/offline), sabnzbd (queue metrics with failed item detection)
- PollManager singleton manages polling intervals (arr=45s, sabnzbd=10s) with hot-reload and graceful stopAll
- SabnzbdMetrics and ArrHealthWarning interfaces added to shared types; configured? flag for unconfigured service display

## Task Commits

1. **Task 1: Schema, encryption, shared types, and install dependencies** - `c7c67c3` (feat)
2. **Task 2: Service adapters and PollManager** - `b22d228` (feat)

## Files Created/Modified

- `packages/backend/src/crypto.ts` - AES-256-GCM encrypt/decrypt with seed-derived key
- `packages/backend/src/schema.ts` - Added serviceConfig table definition
- `packages/backend/src/adapters/arr.ts` - Shared arr adapter for 5 arr services via /api/v3/health
- `packages/backend/src/adapters/bazarr.ts` - Bazarr adapter via /api/system/status
- `packages/backend/src/adapters/sabnzbd.ts` - SABnzbd queue adapter with SabnzbdMetrics
- `packages/backend/src/poll-manager.ts` - PollManager class + singleton export
- `packages/shared/src/types.ts` - Added configured?, SabnzbdMetrics, ArrHealthWarning
- `packages/backend/package.json` - Added axios, node-cron, @types/node-cron
- `packages/backend/src/__tests__/crypto.test.ts` - 8 crypto tests (round-trip, format, security)
- `packages/backend/src/__tests__/arr-adapter.test.ts` - 8 arr adapter tests (mocked axios)
- `packages/backend/src/__tests__/sabnzbd-adapter.test.ts` - 9 sabnzbd adapter tests (mocked axios)

## Decisions Made

- PollManager uses `setInterval` (not node-cron) — service polling is pure interval-based, not schedule-based; setInterval is simpler and easier to mock in tests
- SABnzbd adapter embeds apikey in URL (`?apikey=`) — SABnzbd API requires query param auth, not header
- `crypto.ts` validation uses `parts.length !== 3` guard instead of `!ciphertextHex` — encrypting an empty string produces empty hex `""` which is falsy, breaking the naive guard
- Drizzle migration output (`drizzle/`) remains gitignored — migration is regenerated from schema.ts at deploy time; schema source of truth is version-controlled

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed empty-string encryption validation in crypto.ts**
- **Found during:** Task 1 (TDD GREEN — crypto test for empty string round-trip)
- **Issue:** `!ciphertextHex` check in decrypt() threw on empty string because empty hex `""` is falsy
- **Fix:** Changed guard from `!ivHex || !tagHex || !ciphertextHex` to `parts.length !== 3` — only validates segment count, not segment content
- **Files modified:** packages/backend/src/crypto.ts
- **Verification:** `encrypts empty string round-trip` test passes
- **Committed in:** c7c67c3 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed sabnzbd test assertion using JS `||` in expect.stringContaining**
- **Found during:** Task 2 (TDD GREEN — sabnzbd adapter test for URL format)
- **Issue:** `expect.stringContaining('kbpersec') || expect.stringContaining('my-api-key')` evaluates the JS `||` at parse time, so the second argument to `expect(...).toHaveBeenCalledWith` was the first truthy value, not a matcher union
- **Fix:** Changed assertion to `expect.stringContaining('apikey=my-api-key')` which correctly validates the apikey is embedded in the URL
- **Files modified:** packages/backend/src/__tests__/sabnzbd-adapter.test.ts
- **Verification:** All 9 sabnzbd tests pass
- **Committed in:** b22d228 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes corrected test/implementation bugs. No scope creep.

## Issues Encountered

- `npm install axios node-cron` ran against the main repo workspace root (not worktree) — resolved by manually updating the worktree's package.json to match the installed versions
- Drizzle migration generation ran against main repo's old schema on first attempt — resolved by running `npx drizzle-kit generate` from the worktree directory

## User Setup Required

None — no external service configuration required at this layer. Service credentials are configured via Phase 3 Settings UI (Plan 03-02).

## Next Phase Readiness

- PollManager is ready for Plan 03-02 to wire up Settings API routes that call `pollManager.reload()`
- crypto.ts `encrypt`/`decrypt` are ready for Plan 03-02 to use when persisting service configs to DB
- All 41 backend tests pass; foundation is solid for remaining Phase 3 plans

## Self-Check: PASSED

- FOUND: packages/backend/src/crypto.ts
- FOUND: packages/backend/src/adapters/arr.ts
- FOUND: packages/backend/src/adapters/bazarr.ts
- FOUND: packages/backend/src/adapters/sabnzbd.ts
- FOUND: packages/backend/src/poll-manager.ts
- FOUND: packages/backend/src/__tests__/crypto.test.ts
- FOUND: packages/backend/src/__tests__/arr-adapter.test.ts
- FOUND: packages/backend/src/__tests__/sabnzbd-adapter.test.ts
- FOUND: commit c7c67c3
- FOUND: commit b22d228

---
*Phase: 03-settings-first-service-adapters*
*Completed: 2026-04-03*
