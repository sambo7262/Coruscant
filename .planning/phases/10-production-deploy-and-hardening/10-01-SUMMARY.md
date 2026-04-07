---
phase: 10-production-deploy-and-hardening
plan: 01
subsystem: testing, infra
tags: [vitest, fastify, sse, pihole, plex, nas, ci, docker]

# Dependency graph
requires:
  - phase: 09-local-weather-ui-polish
    provides: completed UI polish and weather integration
provides:
  - Green test suite (173 tests, 0 failures across 19 files)
  - CI workflow with v* tag trigger and semver+latest Docker tags
affects: [11-raspberry-pi-kiosk, future production deploys]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSE handler uses reply.hijack() + sync function (not async) to prevent inject() hang in tests"
    - "In-memory SQLite (DB_PATH=:memory: + initDb()) for test isolation in SSE integration tests"
    - "vi.mock factory must export all named exports the route imports (classifyArrEvent, extractArrTitle)"
    - "fetchNasDockerStats shares session cache with pollNas — no re-auth needed; test mock order: auth + parallel calls including docker API"

key-files:
  created: []
  modified:
    - packages/backend/src/__tests__/plex-adapter.test.ts
    - packages/backend/src/__tests__/nas-adapter.test.ts
    - packages/backend/src/__tests__/arr-webhooks.test.ts
    - packages/backend/src/__tests__/sse.test.ts
    - packages/backend/src/routes/sse.ts
    - packages/backend/src/adapters/pihole.ts
    - .github/workflows/docker-publish.yml

key-decisions:
  - "SSE handler converted from async to sync with reply.hijack() — async handler + hijack + throw = inject() hangs indefinitely; sync handler avoids this"
  - "send() wrapped in try-catch so DB failures don't crash SSE handler during test or startup"
  - "pihole queriesPerMinute uses frequency directly — frequency field is already QPM, not QPS; multiplication by 60 was incorrect"
  - "CI type=semver,pattern=v{{version}} preserves v prefix — produces Docker tag v1.0.0 not 1.0.0"
  - "CI type=raw,value=latest fires on both main branch push AND v* tag push so both events produce latest tag"

patterns-established:
  - "SSE route pattern: reply.hijack() + sync handler + MockSocket check + reply.raw.end() for test termination"
  - "Test files importing SSE/pollManager must set process.env.DB_PATH=':memory:' and call initDb() in beforeAll"

requirements-completed: [PROD-01]

# Metrics
duration: 14min
completed: 2026-04-07
---

# Phase 10 Plan 01: Foundation Tests Green + CI Version Tags Summary

**Green test suite (173 tests, 0 failures) achieved by fixing SSE handler, test mocks, and pihole adapter; CI workflow extended with semver tag trigger**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-07T00:11:00Z
- **Completed:** 2026-04-07T00:25:08Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- All 173 tests pass with 0 failures across 19 test files (was 17 failures)
- SSE route rewritten as sync handler with reply.hijack() — eliminates ERR_HTTP_HEADERS_SENT and inject() hangs
- CI workflow triggers on v* tag push and emits v1.0.0, latest, and sha-* Docker tags

## Task Commits

1. **Task 1: Fix 16 pre-existing test failures** - `fc26ee9` (fix)
2. **Task 2: Add version tag trigger to CI workflow** - `52c2f9a` (feat)

## Files Created/Modified
- `packages/backend/src/__tests__/plex-adapter.test.ts` - Updated mock fields to processCpuUtilization/processMemoryUtilization; fixed to use last entry not first
- `packages/backend/src/__tests__/nas-adapter.test.ts` - Added mock responses for fetchNasDockerStats (docker API + systemInfo) called from pollNas Promise.all
- `packages/backend/src/__tests__/arr-webhooks.test.ts` - Added classifyArrEvent and extractArrTitle to vi.mock factory so route module can import them
- `packages/backend/src/__tests__/sse.test.ts` - Added DB_PATH=:memory: + initDb() in beforeAll for in-memory SQLite
- `packages/backend/src/routes/sse.ts` - Added reply.hijack(), converted to sync handler, wrapped send() in try-catch
- `packages/backend/src/adapters/pihole.ts` - Fixed queriesPerMinute to use frequency directly (not * 60)
- `.github/workflows/docker-publish.yml` - Added tags: ['v*'] trigger, type=semver tag, updated latest enable condition

## Decisions Made
- SSE handler converted from `async` to sync: when `reply.hijack()` is active and the async handler throws (e.g. DB not available), `inject()` hangs indefinitely. A sync handler avoids this entirely — the MockSocket path calls `reply.raw.end()` synchronously, and the real-connection path registers listeners and returns immediately.
- `send()` wrapped in try-catch: defensive against DB failures during early startup or test environments.
- Pi-hole `frequency` field is QPM directly — the prior `* 60` multiplication was wrong (field documents queries/minute not queries/second).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pihole queriesPerMinute QPM calculation**
- **Found during:** Task 1 (fixing 16 pre-existing test failures)
- **Issue:** pihole-adapter.test.ts had 1 additional failure beyond the 16 in the plan (17 total). The adapter multiplied `frequency * 60` but the Pi-hole v6 API's `frequency` field is already QPM.
- **Fix:** Changed `Math.round((queries?.frequency ?? 0) * 60)` to `queries?.frequency ?? 0`
- **Files modified:** packages/backend/src/adapters/pihole.ts
- **Verification:** pihole-adapter.test.ts passes (5/5)
- **Committed in:** fc26ee9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** The plan listed 16 failures across 4 files; actual count was 17 across 5 files. The pihole fix was necessary for the overall goal of 0 failures. No scope creep.

## Issues Encountered
- Root cause of SSE test timeouts: `async` SSE handler + `reply.hijack()` + unhandled throw = inject() promise never resolves. Fixed by converting to sync handler — the non-async variant doesn't have this interaction because the function returns immediately (not as a rejected promise).
- `fetchNasDockerStats` shares session cache with `pollNas` — no separate auth call needed in test mocks. Test mock count needed: auth (1) + utilization (2) + storage (3) + fans (4) + docker API (5) + systemInfo (6).

## Known Stubs
None — no stub patterns introduced in this plan.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Test suite is green: safe to make production changes per D-11 prerequisite
- CI workflow fires on v* tag: `git tag v1.0.0 && git push origin v1.0.0` will build versioned Docker image
- Plan 10-02 can proceed (environment file and compose.yaml hardening)

---
*Phase: 10-production-deploy-and-hardening*
*Completed: 2026-04-07*

## Self-Check: PASSED
- SUMMARY.md: FOUND
- .github/workflows/docker-publish.yml: FOUND
- packages/backend/src/__tests__/sse.test.ts: FOUND
- Commit fc26ee9 (Task 1 - fix test failures): FOUND
- Commit 52c2f9a (Task 2 - CI workflow): FOUND
