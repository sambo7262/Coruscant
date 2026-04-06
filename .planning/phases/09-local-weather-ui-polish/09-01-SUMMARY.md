---
phase: 09-local-weather-ui-polish
plan: 01
subsystem: api
tags: [weather, open-meteo, geocoding, sse, kvstore, sqlite, fastify, vitest]

# Dependency graph
requires:
  - phase: 08-logging-polish-performance
    provides: SSE snapshot pipeline, kv_store schema, PollManager.broadcastSnapshot

provides:
  - WeatherData interface in shared types (temp_f, wmo_code, fetched_at)
  - DashboardSnapshot.weather field (nullable, undefined = not loaded)
  - Weather adapter: fetchWeatherData from Open-Meteo, geocodeZip with US country_code scoping
  - Weather poller: 15-minute interval, failure-resilient kvStore upsert
  - Weather settings route: GET/POST /api/settings/weather with geocoding
  - SSE snapshot includes weather data; fingerprint includes weather for change detection
  - Full unit test coverage: 15 tests across adapter, poller, and settings route

affects:
  - 09-02 (frontend weather widget consumes WeatherData from SSE snapshot)
  - 09-04 (weather tab in settings panel)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Open-Meteo geocoding API for zip-to-latlon conversion with US country_code scoping
    - Failure-resilient kvStore upsert: on fetch error, last-known value preserved
    - Shared get mock pattern in vitest for sequential kvStore key lookups
    - advanceTimersByTimeAsync(0) + Promise.resolve() to flush async tick without infinite loop

key-files:
  created:
    - packages/backend/src/adapters/weather.ts
    - packages/backend/src/weather-poller.ts
    - packages/backend/src/routes/weather-settings.ts
    - packages/backend/src/__tests__/weather-adapter.test.ts
    - packages/backend/src/__tests__/weather-poller.test.ts
    - packages/backend/src/__tests__/weather-settings.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/routes/sse.ts
    - packages/backend/src/index.ts

key-decisions:
  - "Open-Meteo used for both weather data and geocoding — no API key required, GDPR-compliant, stays within privacy constraint"
  - "On fetch failure, weather.current kvStore key is NOT overwritten — frontend detects stale data via fetched_at age"
  - "POST /api/settings/weather returns HTTP 200 with success/failure in body — follows existing test-connection pattern"
  - "weather field added to snapshotFingerprint to prevent spurious SSE pushes when only timestamp changes"
  - "vitest weather-poller: use shared get mock + advanceTimersByTimeAsync(0) to avoid runAllTimersAsync infinite loop"

patterns-established:
  - "Shared vi.fn() mock for sequential kvStore key reads in poller tests — avoids per-where() mock reset"
  - "advanceTimersByTimeAsync(0) + Promise.resolve() chain to flush async setInterval tick without running 10k+ iterations"

requirements-completed:
  - WTHR-01
  - WTHR-02

# Metrics
duration: 15min
completed: 2026-04-06
---

# Phase 9 Plan 01: Weather Backend Summary

**Open-Meteo weather adapter + 15-minute kvStore poller + geocoding settings route + SSE snapshot integration, all with passing unit tests**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-06T20:14:00Z
- **Completed:** 2026-04-06T20:29:49Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Complete weather backend pipeline: Open-Meteo fetch → kvStore → SSE broadcast
- Geocoding route converts zip codes to lat/lon with US country_code scoping for numeric inputs
- 15-minute poller is failure-resilient — last-known weather preserved on network error
- All 15 new weather tests pass (adapter: 6, poller: 4, settings: 5)

## Task Commits

Each task was committed atomically:

1. **Task 1: WeatherData type + weather adapter + geocoding + unit tests** - `5d889c2` (feat)
2. **Task 2: Weather poller + settings route + SSE/snapshot integration + unit tests** - `7097b96` (feat)

## Files Created/Modified
- `packages/shared/src/types.ts` - Added WeatherData interface + weather field to DashboardSnapshot
- `packages/backend/src/adapters/weather.ts` - fetchWeatherData and geocodeZip functions
- `packages/backend/src/weather-poller.ts` - startWeatherPoller with 15-minute setInterval
- `packages/backend/src/routes/weather-settings.ts` - GET/POST /api/settings/weather
- `packages/backend/src/poll-manager.ts` - getSnapshot() includes weather from kvStore
- `packages/backend/src/routes/sse.ts` - snapshotFingerprint includes weather field
- `packages/backend/src/index.ts` - Registers weatherSettingsRoutes, starts/stops weather poller
- `packages/backend/src/__tests__/weather-adapter.test.ts` - 6 unit tests for adapter
- `packages/backend/src/__tests__/weather-poller.test.ts` - 4 unit tests for poller
- `packages/backend/src/__tests__/weather-settings.test.ts` - 5 unit tests for settings route

## Decisions Made
- Open-Meteo used for both weather data and geocoding — no API key required, stays within the project's privacy constraint (no cloud telemetry)
- On fetch failure, `weather.current` kvStore key is NOT overwritten — frontend detects stale data via `fetched_at` age
- POST settings route returns HTTP 200 with `{ success: false, error }` on geocode failure — follows existing test-connection pattern for simpler frontend error handling
- `weather` field added to `snapshotFingerprint` so SSE clients don't receive duplicate pushes when only the poll timestamp changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed weather-poller tests: infinite loop + wrong mock sequential return values**
- **Found during:** Task 2 (weather-poller unit tests)
- **Issue 1:** Tests used `vi.runAllTimersAsync()` which triggered the 15-minute setInterval 10,000+ times, causing vitest to abort with "infinite loop" detection
- **Issue 2:** Each call to `where()` created a new `vi.fn()` resetting the call counter, so both lat and lon queries returned the same (lat) value
- **Fix:** Replaced `vi.runAllTimersAsync()` with `vi.advanceTimersByTimeAsync(0) + Promise.resolve()` to flush only the initial tick; extracted a single shared `sharedGet` mock reused across all `where()` calls
- **Files modified:** `packages/backend/src/__tests__/weather-poller.test.ts`
- **Verification:** All 4 poller tests now pass
- **Committed in:** `7097b96` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Test infrastructure fix only — no behavior change to production code.

## Issues Encountered
- The plan was partially executed by a prior agent (Task 1 was already committed as `5d889c2`). Resumed from Task 2, verified Task 1 artifacts, then proceeded with Task 2 implementation and test fixes.

## Next Phase Readiness
- Weather backend is fully operational; frontend weather widget (Plan 02) can consume `snapshot.weather` from SSE
- Weather settings route ready for UI integration (Plan 03/04)
- No blockers

---
*Phase: 09-local-weather-ui-polish*
*Completed: 2026-04-06*
