---
phase: 21-weather-forecast
plan: "01"
subsystem: backend
tags: [weather, forecast, types, open-meteo, testing]
dependency_graph:
  requires: []
  provides: [ForecastDay type, extended fetchWeatherData, timezone passthrough, forecast backend tests]
  affects: [packages/shared/src/types.ts, packages/backend/src/adapters/weather.ts, packages/backend/src/weather-poller.ts]
tech_stack:
  added: []
  patterns: [optional chaining for backward compat, Array.isArray guard for API response validation]
key_files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/adapters/weather.ts
    - packages/backend/src/weather-poller.ts
    - packages/backend/src/__tests__/weather-adapter.test.ts
    - packages/backend/src/__tests__/weather-poller.test.ts
decisions:
  - "ForecastDay.forecast on WeatherData is optional (?) to preserve backward compatibility with pre-Phase-21 kvStore blobs"
  - "ForecastDay.forecast on WeatherFetchResult is required (non-optional) since adapter always populates it (empty array fallback)"
  - "Array.isArray(daily?.time) guard chosen as T-21-01 mitigation — returns [] on unexpected shape"
metrics:
  duration_minutes: 7
  completed_date: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 21 Plan 01: Weather Forecast Backend Summary

Open-Meteo weather adapter extended with 5-day daily forecast via single API call, ForecastDay type added to shared package, timezone passed from kvStore through to Open-Meteo request, and 3 new backend tests added covering forecast parsing and graceful degradation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ForecastDay type and extend WeatherData + WeatherFetchResult | e6b94e4 | types.ts, weather.ts |
| 2 | Wire timezone into weather-poller and extend backend tests | fc8739e | weather-poller.ts, weather-adapter.test.ts, weather-poller.test.ts |

## What Was Built

- `ForecastDay` interface exported from `@coruscant/shared` with `date`, `temp_max_f`, `temp_min_f`, `wmo_code` fields
- `WeatherData.forecast?: ForecastDay[]` — optional field for backward compatibility with pre-Phase-21 kvStore blobs
- `WeatherFetchResult.forecast: ForecastDay[]` — required field (always empty array minimum)
- `fetchWeatherData(lat, lon, timezone?)` — extended signature with optional timezone parameter
- Open-Meteo `daily` params added: `temperature_2m_max,temperature_2m_min,weather_code` with `forecast_days: 5`
- `timezone ?? 'auto'` fallback ensures Open-Meteo infers timezone when none stored
- `Array.isArray(daily?.time)` guard returns `[]` on missing/malformed daily block (T-21-01 mitigation)
- `weather-poller.ts`: tzRow read moved before `fetchWeatherData` call; timezone passed as third arg
- `...result` spread in payload automatically carries `forecast` array into kvStore and SSE snapshot
- 3 new `weather-adapter` tests: 5-day forecast array populated, empty fallback on no daily field, timezone param passthrough

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed weather-poller test assertion for new 3-arg call signature**
- **Found during:** Task 2 full test run
- **Issue:** Existing `weather-poller.test.ts` test asserted `fetchWeatherData` called with 2 args; after timezone passthrough, it's now called with 3. Test failed with `expected 2 args, received ["37.7749", "-122.4194", undefined]`
- **Fix:** Updated assertion to `toHaveBeenCalledWith('37.7749', '-122.4194', undefined)` and added `forecast: []` to mock return value to satisfy updated `WeatherFetchResult` type
- **Files modified:** `packages/backend/src/__tests__/weather-poller.test.ts`
- **Commit:** fc8739e

## Verification Results

1. `npx tsc --noEmit -p packages/shared/tsconfig.json` — PASS (shared types compile cleanly)
2. `npx tsc --noEmit -p packages/backend/tsconfig.json` — pre-existing errors in nas.ts/poll-manager.ts unrelated to this plan (confirmed present on base commit)
3. `npm test -- packages/backend/src/__tests__/weather-adapter.test.ts` — 9/9 tests pass
4. `npm test` — 210/210 tests pass (full suite green, no regressions)

## Known Stubs

None — forecast data flows end-to-end through the pipeline. Frontend rendering is Plan 02's responsibility.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The `daily` params added to the existing Open-Meteo GET request are covered by threat register entry T-21-01 (Array.isArray guard implemented) and T-21-02/T-21-03 (accepted, no changes required).

## Self-Check: PASSED

- `packages/shared/src/types.ts` — modified, ForecastDay and WeatherData.forecast present
- `packages/backend/src/adapters/weather.ts` — modified, daily params and forecast parsing present
- `packages/backend/src/weather-poller.ts` — modified, tzRow before fetchWeatherData call present
- `packages/backend/src/__tests__/weather-adapter.test.ts` — modified, 3 new tests present
- Commits e6b94e4 and fc8739e exist in git log
