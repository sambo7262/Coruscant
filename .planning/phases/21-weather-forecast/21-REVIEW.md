---
phase: 21-weather-forecast
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - packages/backend/src/__tests__/weather-adapter.test.ts
  - packages/backend/src/__tests__/weather-poller.test.ts
  - packages/backend/src/adapters/weather.ts
  - packages/backend/src/weather-poller.ts
  - packages/frontend/src/components/layout/AppHeader.tsx
  - packages/frontend/src/components/layout/WeatherForecastPanel.tsx
  - packages/frontend/src/styles/globals.css
  - packages/frontend/src/styles/viewport-iphone.css
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 21 introduces weather forecast support: an Open-Meteo adapter with geocoding, a 15-minute polling loop with failure resilience, a 5-day forecast panel in the header, and full viewport-responsive CSS. The overall structure is sound — the adapter validates its response, the poller preserves last-known state on failure, and the frontend guards against null/undefined weather data before rendering.

Four warnings were identified: one logic gap where forecast array entries are built without bounds-checking on array lengths, one stale-data edge case in the frontend that can produce a negative staleness minute count, one missing guard in the poller's `onConflictDoUpdate` call, and one test reliability issue where a `vi.fn()` mock per `where()` call resets unexpectedly. Three info items cover dead CSS, a duplicate font-size rule, and a missing WMO code range.

No critical security or correctness issues were found.

## Warnings

### WR-01: Forecast array built without bounds-checking parallel arrays

**File:** `packages/backend/src/adapters/weather.ts:41-47`
**Issue:** The forecast map assumes `daily.temperature_2m_max`, `daily.temperature_2m_min`, and `daily.weather_code` each have the same length as `daily.time`. If the Open-Meteo API ever returns an inconsistently shaped `daily` object (a malformed partial response), indexing beyond the shorter array produces `undefined` values that are then cast to `number`. These are silently stored to the database and surfaced to the frontend as `NaN`, which breaks `Math.round()` rendering.

**Fix:**
```typescript
const len = Math.min(
  daily.time.length,
  daily.temperature_2m_max.length,
  daily.temperature_2m_min.length,
  daily.weather_code.length,
)
const forecast: ForecastDay[] = (daily.time as string[]).slice(0, len).map((date, i) => ({
  date,
  temp_max_f: daily.temperature_2m_max[i] as number,
  temp_min_f: daily.temperature_2m_min[i] as number,
  wmo_code: daily.weather_code[i] as number,
}))
```

---

### WR-02: Stale minute count can be negative when clocks diverge

**File:** `packages/frontend/src/components/layout/WeatherForecastPanel.tsx:49-51`
**Issue:** `staleMinutes` is computed as `Math.round((Date.now() - new Date(fetchedAt)) / 60_000)`. When `fetchedAt` is very recent (e.g., a freshly polled response that arrives within the same second), this evaluates to `0`. The guard `staleMinutes > 0` correctly suppresses display in that case. However, if client and server clocks have even minor skew (a few seconds), the subtraction can yield a small negative number. `Math.round` of a small negative is still negative, satisfying `staleMinutes > 0` as `false` — so no label appears, which is safe. But if the skew is larger than 30 seconds, `Math.round` produces `0` and the guard still fires correctly. The real risk is if `fetchedAt` is a future timestamp from a server with a fast clock: `staleMinutes` becomes negative enough (< -0.5) that `Math.round` gives `-1` or lower, and the label is suppressed correctly. No crash occurs, but the displayed panel shows "5-DAY FORECAST" with no stale qualifier even when data is genuinely old from the user's perspective.

The actual risk is the `isStale` flag passed in from `AppHeader` (line 289) using a separate `isWeatherStale` calculation. Since `isStale` is the gate for the stale label section (`isStale && staleMinutes !== null && staleMinutes > 0`), the `staleMinutes <= 0` branch is silently swallowed — the label section is hidden but no fallback is shown. If `fetchedAt` is in the future (clock skew), `isStale` will be `false`, so the user sees no stale indicator even though the data may be hours old from the server's perspective.

**Fix:** Add a `Math.max(0, ...)` clamp and use the absolute value to handle clock skew:
```typescript
const staleMinutes = fetchedAt
  ? Math.max(0, Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60_000))
  : null
```

Also consider displaying `staleMinutes === 0` as `< 1m` rather than suppressing entirely, so users know the label is present but the update was very recent.

---

### WR-03: `onConflictDoUpdate` `set` clause calls `new Date()` twice, creating a timestamp race

**File:** `packages/backend/src/weather-poller.ts:29-31`
**Issue:** The insert and the `set` clause each call `new Date().toISOString()` independently. In nearly all cases these will match. However they are two separate `Date` constructions separated by whatever time Drizzle takes to build the query object. If the process is under heavy load, the `updatedAt` in the conflict-update path can be a different millisecond than the initial `values()` call. This is a minor data consistency issue — the stored `updatedAt` for updated rows will always be slightly newer than intended, and could create a misleading audit trail.

**Fix:** Capture the timestamp once and reuse it:
```typescript
const now = new Date().toISOString()
db.insert(kvStore)
  .values({ key: 'weather.current', value: payload, updatedAt: now })
  .onConflictDoUpdate({ target: kvStore.key, set: { value: payload, updatedAt: now } })
  .run()
```

---

### WR-04: Weather poller test — `vi.fn()` per `where()` call silently breaks call-order mocking

**File:** `packages/backend/src/__tests__/weather-poller.test.ts:109-118`
**Issue:** In the second test ("does NOT overwrite weather.current when fetchWeatherData throws"), the `where()` factory returns a fresh `vi.fn()` on each call. This means `.mockReturnValueOnce` for `weather.lat` and `.mockReturnValueOnce` for `weather.lon` are registered on two different mock function instances — one per `where()` invocation. The first `where()` call returns a mock that yields the `weather.lat` row on first call, then `undefined`. The second `where()` call returns a completely fresh mock with no `mockReturnValueOnce` configuration, so it always returns `undefined`. This means `lonRow` is always `undefined`, causing the poller's `if (!latRow || !lonRow) return` guard to fire — and `fetchWeatherData` is never called. The test then asserts `fetchWeatherData` was called (`expect(fetchWeatherData).toHaveBeenCalled()` at line 142), which will fail if the mock is wired this way.

The comment in the first test (lines 61-65) explicitly documents this problem and uses a `sharedGet` approach to fix it, but the second test (lines 109-118) reverts to the broken pattern. The test may currently pass only if the `where()` factory somehow shares state via module cache — which would be fragile.

**Fix:** Apply the same `sharedGet` pattern from the first test to the second:
```typescript
const sharedGet = vi.fn()
  .mockReturnValueOnce({ key: 'weather.lat', value: '37.7749' })
  .mockReturnValueOnce({ key: 'weather.lon', value: '-122.4194' })

vi.mocked(getDb).mockImplementation(() => ({
  select: () => ({
    from: () => ({
      where: (_: unknown) => ({ get: sharedGet }),
    }),
  }),
  insert: vi.fn(),
}) as unknown as ReturnType<typeof getDb>)
```

## Info

### IN-01: `.app-header__weather` CSS class defined but never used

**File:** `packages/frontend/src/styles/globals.css:1512-1518`
**Issue:** The class `.app-header__weather` is defined with `display: flex`, `align-items: center`, `gap: 6px`, `height: 44px`, `padding-right: 4px` — but `AppHeader.tsx` uses `.app-header__weather-btn` (the button reset class) instead. `.app-header__weather` appears to be a leftover from an earlier iteration where weather was a non-interactive display element. It is dead CSS.

**Fix:** Remove the `.app-header__weather` rule block (lines 1512-1518 in globals.css).

---

### IN-02: Duplicate `font-size` rule for `.now-playing-banner__stat` in portrait overrides

**File:** `packages/frontend/src/styles/viewport-iphone.css:184-188`
**Issue:** `.now-playing-banner__stat` has `font-size: 14px` set on line 184 and then immediately overridden to `font-size: 13px` on line 188 within the same `iphone-portrait` scope. The first declaration is dead — only the second (13px) takes effect. This creates a confusing maintenance footprint where changing one value may appear to have no effect.

**Fix:** Remove the first declaration (line 184: `html[data-viewport="iphone-portrait"] .now-playing-banner__stat { font-size: 14px; }`) and keep only the 13px rule.

---

### IN-03: `getConditionLabel` has no explicit handler for WMO codes 91–94 (hail/ice pellets)

**File:** `packages/frontend/src/components/layout/WeatherForecastPanel.tsx:17-34`
**Issue:** The WMO weather interpretation table includes codes 91–94 (slight/moderate hail, ice pellets) which fall into the `return 'Cloudy'` default. This is a misleading label — hail is not cloudy. The codes are uncommon but not impossible. The existing default is a safe fallback, but the label is semantically wrong for this range.

**Fix:** Add explicit handling before the final return:
```typescript
if (wmoCode >= 91 && wmoCode <= 94) return 'Hail'
```

---

_Reviewed: 2026-05-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
