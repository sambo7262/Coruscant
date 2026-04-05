---
plan: 06-02
phase: 06-network-monitoring
status: complete
completed: 2026-04-05
commits:
  - f749e47
  - b083650
key-files:
  modified:
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/routes/settings.ts
    - packages/backend/src/routes/test-connection.ts
    - packages/backend/src/__tests__/settings.test.ts
---

## What Was Built

Wired the UniFi adapter (Plan 01) into the backend infrastructure.

**Task 1 — PollManager:**
- Imports `pollUnifi` and `resetUnifiCache` from `./adapters/unifi.js`
- Added `'unifi'` to `ALL_SERVICE_IDS` array
- Added `UNIFI_INTERVAL_MS = 30_000` constant (D-14: 30s polling)
- `idToName()` maps `unifi` → `'UniFi'`
- `idToTier()` includes `unifi` in the `'rich'` tier alongside `plex` and `nas`
- `reload()` calls `resetUnifiCache()` before reconfiguring unifi service
- `doPoll()` routes `serviceId === 'unifi'` to `pollUnifi(baseUrl, apiKey)`
- Interval selection routes `unifi` to `UNIFI_INTERVAL_MS`

**Task 2 — Settings + test-connection routes:**
- `settings.ts` `VALID_SERVICES` includes `'unifi'` — GET/POST handlers work generically
- `test-connection.ts` `VALID_SERVICES` includes `'unifi'`
- UniFi test-connection calls `GET /proxy/network/integration/v1/sites` with `X-API-KEY` header, returns `"Connected — {siteName}"` on success

## Test Results

- 3 pre-existing plex-adapter test failures (unrelated to this plan — existed before Phase 6)
- All other tests pass (113/116)
- New settings test updated: expects 11 services (was 10), asserts `'unifi'` in service list

## Decisions

- UniFi uses the same `baseUrl` + `apiKey` credential pattern as other services — no special DB schema needed
- test-connection returns first site name from `/sites` response for user confirmation
