# Deferred Items — Phase 06 Network Monitoring

## Pre-existing Test Failures (out of scope for 06-01)

**File:** `packages/backend/src/__tests__/plex-adapter.test.ts`

Three `fetchPlexServerStats` tests were failing before Phase 06 execution began. Confirmed pre-existing by running tests against the commit prior to 06-01 work (a1d1649).

Failing tests:
1. `fetchPlexServerStats > returns PlexServerStats from first StatisticsResources entry (happy path)` — expects processCpuPercent=12.5 but gets NaN
2. `fetchPlexServerStats > uses only the first entry (most recent) when multiple entries present` — processCpuPercent=30.0 but gets NaN
3. `fetchPlexServerStats > rounds processRamPercent to 1 decimal place` — 33.3 but gets NaN

Root cause appears to be division by zero or missing field in `fetchPlexServerStats` CPU/RAM calculation (dividing by total that is 0 or undefined).

**Action needed:** Fix `fetchPlexServerStats` in a quick task or Phase 06 cleanup — these are not related to UniFi work.
