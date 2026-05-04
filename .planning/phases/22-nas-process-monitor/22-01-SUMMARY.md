---
phase: 22-nas-process-monitor
plan: 01
subsystem: api
tags: [nas, dsm, synology, fastify, typescript, vitest, process-monitor]

# Dependency graph
requires:
  - phase: 18-docker-update-detail-view
    provides: nas.ts adapter with ensureSession + fetchNasDockerStats pattern
provides:
  - NasProcess shared type (pid, name, label, cpuPercent)
  - fetchNasProcesses adapter function with PROCESS_LABELS + defensive DSM field parsing
  - GET /api/nas/processes — top-5 processes sorted by CPU desc with human-readable labels
  - GET /debug/nas-processes — raw DSM passthrough with sampleKeys + apiInfo for field inspection
affects: [22-02, 22-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Defensive DSM field parsing (cmd/name/process_name, cpu/cpu_percent/cpu_usage) for undocumented APIs
    - Static PROCESS_LABELS table with prefix-match fallback for human-readable process names
    - Debug passthrough route pattern with sampleKeys extraction for DSM field inspection

key-files:
  created:
    - packages/backend/src/routes/nas-processes.ts
    - packages/backend/src/__tests__/nas-processes.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/adapters/nas.ts
    - packages/backend/src/index.ts

key-decisions:
  - "fetchNasProcesses calls ensureSession internally (module-private) to reuse cached DSM session — avoids re-auth on each panel open"
  - "Defensive parsing checks cmd/name/process_name and cpu/cpu_percent/cpu_usage — DSM SYNO.Core.System.Process field names are undocumented"
  - "Debug route authenticates independently (not via ensureSession) to keep passthrough isolated from production session cache"
  - "PROCESS_LABELS uses prefix-match fallback so 'Plex Media Server' maps to 'Plex media server' without exact key"
  - "Built shared dist in worktree and copied to main repo node_modules symlink target to fix pre-existing stale dist TS errors"

patterns-established:
  - "Defensive DSM field parsing: check multiple plausible field names with ?? chaining, never assume undocumented API schema"
  - "Debug passthrough returns sampleKeys (Object.keys of first entry) so field names are visible without reading source"

requirements-completed: [NAS-01, NAS-02]

# Metrics
duration: 25min
completed: 2026-05-03
---

# Phase 22 Plan 01: NAS Process Monitor Backend Summary

**NAS process monitor backend with defensive DSM field parsing, 15-entry PROCESS_LABELS table, /api/nas/processes and /debug/nas-processes routes, 12 unit tests passing**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-03T06:00:00Z
- **Completed:** 2026-05-03T06:25:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `NasProcess` interface to shared types (pid, name, label, cpuPercent)
- Added `fetchNasProcesses` to nas.ts adapter with 15-entry PROCESS_LABELS, prefix-match fallback, and defensive parsing of undocumented DSM field names
- Created `GET /api/nas/processes` returning top-5 processes sorted by CPU descending with human-readable labels
- Created `GET /debug/nas-processes` raw DSM passthrough returning rawProcessResponse + sampleKeys + apiInfo for field verification on real hardware
- 12 unit tests covering: top-5 sorting, exact/prefix label lookup, unknown name fallback, success=false guard, empty list, cmd/name/cpu_percent field variants, empty-name filtering, DSM unreachable, flat-array data shape

## Task Commits

Each task was committed atomically:

1. **Task 1: NasProcess type + fetchNasProcesses adapter + PROCESS_LABELS table** - `1ba66f9` (feat)
2. **Task 2: Fastify routes + registration + unit tests** - `7e22b0f` (feat)

## Files Created/Modified
- `packages/shared/src/types.ts` - Added NasProcess interface
- `packages/backend/src/adapters/nas.ts` - Added PROCESS_LABELS, labelProcess, fetchNasProcesses
- `packages/backend/src/routes/nas-processes.ts` - New file: /api/nas/processes + /debug/nas-processes routes
- `packages/backend/src/__tests__/nas-processes.test.ts` - New file: 12 unit tests
- `packages/backend/src/index.ts` - Import + register nasProcessesRoutes

## Decisions Made
- `fetchNasProcesses` calls the module-private `ensureSession` internally — the session Map is shared across all NAS adapter functions, avoiding re-auth per panel open (per RESEARCH.md Pitfall 2)
- Debug route authenticates independently (own axios.get to SYNO.API.Auth) to keep it isolated from the production session cache
- PROCESS_LABELS uses prefix-match so partial names like "Plex Media Server" match without requiring exact keys
- Defensive field parsing checks cmd/name/process_name and cpu/cpu_percent/cpu_usage because SYNO.Core.System.Process schema is undocumented (per RESEARCH.md Pitfall 1 and Assumptions A1-A4)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Built shared package dist to fix pre-existing stale TS errors**
- **Found during:** Task 1 verification (TypeScript compile check)
- **Issue:** The worktree's node_modules/@coruscant/shared symlinks to the main repo's packages/shared/dist, which was stale — missing ImageUpdateDetail, ForecastDay, and (newly added) NasProcess. TypeScript compile failed with TS2305 errors.
- **Fix:** Built the worktree's packages/shared dist (`npx tsc --build packages/shared/tsconfig.json`), then copied the output to the main repo's packages/shared/dist (where the symlink resolves). All 6 pre-existing TS errors resolved.
- **Files modified:** packages/shared/dist/types.d.ts, types.d.ts.map, types.js, types.js.map (generated build artifacts, not committed)
- **Verification:** `npx tsc --noEmit --project packages/backend/tsconfig.json` exits 0
- **Committed in:** 1ba66f9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Required to unblock TypeScript compilation. Pre-existing stale dist in shared worktree environment. No scope creep.

## Issues Encountered
- Worktree git stash during investigation reverted in-progress changes to types.ts and nas.ts — restored via `git stash pop` immediately.

## User Setup Required
None - no external service configuration required. Routes are available at existing NAS credentials configured via Settings.

## Next Phase Readiness
- Backend complete: /api/nas/processes returns `{ processes: NasProcess[] }` typed and ready for frontend consumption
- /debug/nas-processes available to verify SYNO.Core.System.Process field names on real hardware before Plan 03 frontend wires the data
- Plan 03 (frontend NasProcessPanel component) can import NasProcess from @coruscant/shared and fetch from /api/nas/processes

---
*Phase: 22-nas-process-monitor*
*Completed: 2026-05-03*
