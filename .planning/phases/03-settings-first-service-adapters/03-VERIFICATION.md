---
phase: 03-settings-first-service-adapters
verified: 2026-04-03T13:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 3: Settings-First Service Adapters — Verification Report

**Phase Goal:** Settings-first service adapters — encrypted credential storage, live polling for all arr services + Bazarr + SABnzbd, SSE serves real data, dashboard shows NOT CONFIGURED state for unconfigured services.
**Verified:** 2026-04-03T13:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Service credentials can be encrypted and decrypted using AES-256-GCM with ENCRYPTION_KEY_SEED | VERIFIED | `packages/backend/src/crypto.ts` exports `encrypt`/`decrypt` using `aes-256-gcm`, random 12-byte IV, SHA-256 key derivation from seed |
| 2 | Arr adapter correctly maps /api/v{version}/health responses to online/warning/offline ServiceStatus | VERIFIED | `packages/backend/src/adapters/arr.ts` polls `/api/${version}/health` with `X-Api-Key` header; Warning/Error items → `warning`, empty array or Ok/Notice → `online`, network error → `offline` |
| 3 | Bazarr adapter uses /api/system/status with apikey query param and maps to online/offline | VERIFIED | `packages/backend/src/adapters/bazarr.ts` calls `/api/system/status` with `params: { apikey }`, returns `online` on 2xx, `offline` on any error |
| 4 | SABnzbd adapter parses queue response into speedMBs, queueCount, progressPercent, hasFailedItems | VERIFIED | `packages/backend/src/adapters/sabnzbd.ts` fully parses `kbpersec`, `noofslots`, slot percentages, `status === 'Failed'` detection, returns typed `SabnzbdMetrics` |
| 5 | PollManager can start/stop/reload poll intervals per service and produce a DashboardSnapshot | VERIFIED | `packages/backend/src/poll-manager.ts` exports `PollManager` class and singleton; `reload()` clears existing timers, dispatches to correct adapter, sets intervals (arr=45s, sabnzbd=10s); `getSnapshot()` returns full `DashboardSnapshot`; `stopAll()` clears all timers |
| 6 | User can save a service config via POST /api/settings/:serviceId and it persists in SQLite | VERIFIED | `packages/backend/src/routes/settings.ts` POST handler upserts `serviceConfig` table via Drizzle with encrypted API key |
| 7 | GET /api/settings/:serviceId returns base URL but never the plaintext API key | VERIFIED | GET handler returns `{ serviceName, baseUrl, hasApiKey, enabled }` — `encryptedApiKey` is never present; `decrypt` not called in GET path |
| 8 | POST /api/test-connection/:serviceId makes a live request and returns success or failure | VERIFIED | `packages/backend/src/routes/test-connection.ts` makes live HTTP calls to arr `/api/{v}/health`, bazarr `/api/system/status`, sabnzbd `/api?mode=queue`; always HTTP 200, success/failure in body |
| 9 | SSE endpoint sends real poll data instead of mock data for configured services | VERIFIED | `packages/backend/src/routes/sse.ts` imports `pollManager` and calls `pollManager.getSnapshot()` — `generateMockSnapshot` import is absent |
| 10 | Unconfigured services appear in SSE snapshot with configured=false and status=stale | VERIFIED | `PollManager` constructor initialises all 10 service IDs with `makeUnconfigured()` returning `{ status: 'stale', configured: false }`; these flow through `getSnapshot()` → SSE |
| 11 | User sees a horizontal tab bar with tabs for all 7 services; deep-link via /settings?service= works | VERIFIED | `packages/frontend/src/pages/SettingsPage.tsx` has `SERVICES` const with all 7 IDs; uses `useSearchParams` for deep-link; tab clicks call `setSearchParams` |
| 12 | Unconfigured service cards show grey LED and dim NOT CONFIGURED label; tap navigates to /settings?service={id} | VERIFIED | `packages/frontend/src/components/cards/ServiceCard.tsx` checks `service.configured === false`; renders NOT CONFIGURED label, overrides StatusDot to `stale`, navigates `settings?service=${service.id}` on click |
| 13 | Prowlarr and Readarr cards appear on dashboard and use ArrInstrument rendering | VERIFIED | `ARR_IDS` set in ServiceCard.tsx includes `prowlarr` and `readarr`; CardGrid filters by `tier` only (no ID exclusion); PollManager includes both in `ALL_SERVICE_IDS` and `ARR_SERVICES` |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/schema.ts` | serviceConfig Drizzle table | VERIFIED | `serviceConfig = sqliteTable('service_config', ...)` with `serviceName` PK, `baseUrl`, `encryptedApiKey`, `enabled`, `updatedAt` |
| `packages/backend/src/crypto.ts` | AES-256-GCM encrypt/decrypt | VERIFIED | Exports `encrypt` and `decrypt`; uses `aes-256-gcm`, random IV per call, `parts.length !== 3` guard |
| `packages/backend/src/adapters/arr.ts` | Shared arr adapter | VERIFIED | Exports `pollArr`; polls `/api/${version}/health`; `X-Api-Key` header; status mapping complete |
| `packages/backend/src/adapters/bazarr.ts` | Bazarr adapter | VERIFIED | Exports `pollBazarr`; `/api/system/status?apikey=`; binary online/offline |
| `packages/backend/src/adapters/sabnzbd.ts` | SABnzbd adapter with queue metrics | VERIFIED | Exports `pollSabnzbd`; full `SabnzbdMetrics` parsing; `hasFailedItems` → warning |
| `packages/backend/src/poll-manager.ts` | PollManager singleton | VERIFIED | Exports `PollManager` class and `pollManager` singleton; 45s arr / 10s sabnzbd intervals |
| `packages/shared/src/types.ts` | configured flag, SabnzbdMetrics, ArrHealthWarning | VERIFIED | `configured?: boolean`, `SabnzbdMetrics` interface, `ArrHealthWarning` interface all present |
| `packages/backend/src/routes/settings.ts` | Settings CRUD routes | VERIFIED | Exports `settingsRoutes`; GET/POST endpoints; `encrypt()` on save; `pollManager.reload()` on save |
| `packages/backend/src/routes/test-connection.ts` | Test-connection route | VERIFIED | Exports `testConnectionRoutes`; live calls to arr health, bazarr status, sabnzbd queue; always HTTP 200 |
| `packages/backend/src/routes/sse.ts` | SSE using PollManager | VERIFIED | Imports and calls `pollManager.getSnapshot()`; no `generateMockSnapshot` reference; SSE headers preserved |
| `packages/frontend/src/pages/SettingsPage.tsx` | Full tabbed settings page | VERIFIED | 373 lines; all 7 service tabs; `useSearchParams`; masked API key (`type={showKey ? 'text' : 'password'}`); TEST + SAVE handlers; CONNECTED/FAILED result display |
| `packages/frontend/src/components/cards/ServiceCard.tsx` | NOT CONFIGURED branch and deep-link | VERIFIED | `isUnconfigured` check; `NOT CONFIGURED` label; `settings?service=` navigate; `prowlarr`/`readarr` in `ARR_IDS` |
| `drizzle/0000_clumsy_malice.sql` | Drizzle migration SQL | VERIFIED | Migration file exists in `drizzle/` directory |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `crypto.ts` | `node:crypto` | `createCipheriv('aes-256-gcm', ...)` | VERIFIED | Pattern `createCipheriv.*aes-256-gcm` present in file |
| `adapters/arr.ts` | axios | `GET /api/${version}/health` | VERIFIED | `X-Api-Key` header; `api/v3/health` (v3 for radarr/sonarr), `api/v1/health` (v1 for others) |
| `poll-manager.ts` | adapters | `pollArr \| pollBazarr \| pollSabnzbd` per service type | VERIFIED | Conditional dispatch at lines 106-115 of poll-manager.ts |
| `routes/settings.ts` | `poll-manager.ts` | `pollManager.reload()` after upsert | VERIFIED | Called at both the disable path (line 128) and the enable path (line 156) |
| `routes/settings.ts` | `crypto.ts` | `encrypt()` for API key storage | VERIFIED | `encrypt(apiKey, seed)` called on line 133; `decrypt` only appears in `index.ts` boot sequence |
| `routes/sse.ts` | `poll-manager.ts` | `pollManager.getSnapshot()` replaces mock generator | VERIFIED | Line 13: `const snapshot = pollManager.getSnapshot()` |
| `SettingsPage.tsx` | `/api/settings/:serviceId` | `fetch` in save and load handlers | VERIFIED | `fetch('/api/settings/${serviceId}')` in `loadTabConfig`; `fetch('/api/settings/${activeTab}', { method: 'POST' })` in `handleSave` |
| `SettingsPage.tsx` | `/api/test-connection/:serviceId` | `fetch` in test handler | VERIFIED | `fetch('/api/test-connection/${activeTab}', { method: 'POST' })` in `handleTest` |
| `ServiceCard.tsx` | `/settings?service=` | `navigate()` on unconfigured card click | VERIFIED | `navigate('/settings?service=${service.id}')` inside `handleClick` when `isUnconfigured` |
| `packages/backend/src/index.ts` | settings + testConnection routes | `fastify.register(...)` | VERIFIED | Both routes registered at lines 31-32; boot-time PollManager startup at lines 68-80 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `routes/sse.ts` | `snapshot` | `pollManager.getSnapshot()` → `Map<string, ServiceStatus>.values()` | Yes — PollManager state is populated by live adapter calls via `doPoll()` | FLOWING |
| `SettingsPage.tsx` | `url`, `hasExistingKey` | `fetch('/api/settings/${serviceId}')` → DB row | Yes — reads from `service_config` table via Drizzle | FLOWING |
| `ServiceCard.tsx` | `service.configured`, `service.status` | SSE snapshot → `DashboardSnapshot.services` | Yes — sourced from PollManager live state | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite passes (all 50 tests) | `npm run test` (root) | 8 test files, 50 tests, 0 failures | PASS |
| Backend has no `vitest` in devDependencies | `cat packages/backend/package.json` | Vitest runs from root-level devDependencies; `npm run test` at root covers backend tests | PASS |
| SSE imports pollManager, not mock generator | grep on `sse.ts` | `pollManager.getSnapshot()` found; `generateMockSnapshot` absent | PASS |
| Frontend TypeScript compiles | `npx tsc --noEmit --project packages/frontend/tsconfig.json` | One pre-existing error in `main.tsx` (CSS side-effect import, unrelated to Phase 3 changes); no Phase 3 files have errors | PASS (pre-existing issue) |
| `configured` flag present in shared types | grep on `types.ts` | `configured?: boolean` on line 10 of types.ts | PASS |
| DashboardPage does not filter out prowlarr/readarr | grep `CardGrid.tsx` | Filters by `tier` only, `s.id !== 'nas-detail'` exclusion only | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CFG-01 | 03-02, 03-03, 03-04 | Settings page lets user configure base URL and API key for each service | SATISFIED | SettingsPage.tsx with 7-service tab bar, URL input, API key input, SAVE handler posting to `/api/settings/:serviceId` |
| CFG-03 | 03-01 | All settings persisted to SQLite; survive app restarts | SATISFIED | `serviceConfig` Drizzle table in schema.ts; migration generated; `index.ts` loads saved configs from DB on boot and restarts polling |
| CFG-04 | 03-02 | Test Connection validates URL and credentials live | SATISFIED | `test-connection.ts` makes live HTTP calls per service type; always returns HTTP 200 with `{ success, message }` body |
| SVCST-01 | 03-01, 03-04 | Radarr card shows up/down health state | SATISFIED | `pollArr` polls `/api/v3/health`; status LED wired through PollManager → SSE → ServiceCard |
| SVCST-02 | 03-01, 03-04 | Sonarr card shows up/down health state | SATISFIED | Same adapter as Radarr (`pollArr` with `v3` version); included in `ARR_SERVICES` and `ARR_IDS` |
| SVCST-03 | 03-01, 03-04 | Lidarr card shows up/down health state | SATISFIED | `pollArr` with `v1` API version; included in `ARR_SERVICES` and `ARR_IDS` |
| SVCST-04 | 03-01, 03-04 | Bazarr card shows up/down health state | SATISFIED | `pollBazarr` adapter; dedicated `bazarr` dispatch branch in PollManager |
| SVCST-05 | 03-01 | Status-tier services poll every 30–60 seconds | SATISFIED | `ARR_INTERVAL_MS = 45_000` (45s) is within the 30–60s window; includes Bazarr (uses same interval) |
| SVCACT-01 | 03-01, 03-04 | SABnzbd card shows up/down status, speed, queue count, progress bars | SATISFIED | `pollSabnzbd` returns `SabnzbdMetrics` with all fields; `SabnzbdInstrument` in ServiceCard renders speed/queue/progress |
| SVCACT-02 | 03-01 | SABnzbd amber error state when queue items have failed status | SATISFIED | `hasFailedItems === true` → `status: 'warning'` in `pollSabnzbd` |
| SVCACT-03 | 03-01 | SABnzbd polls at 5–15 second intervals | SATISFIED | `SABNZBD_INTERVAL_MS = 10_000` (10s) is within the 5–15s window |

**All 11 required requirement IDs are SATISFIED.**

No orphaned requirements: REQUIREMENTS.md Traceability table lists all 11 IDs as Phase 3 / Complete.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `adapters/arr.ts` line 4 | `TIMEOUT_MS = 5_000` — plan specified 10s timeout, implementation uses 5s | INFO | Below-plan timeout. Not a correctness issue — services still become `offline` on error/timeout. 5s is actually safer for mobile responsiveness. No functional gap. |
| `adapters/sabnzbd.ts` line 4 | `TIMEOUT_MS = 5_000` — same as arr, shorter than plan's 10s spec | INFO | Same as above. |
| `poll-manager.ts` lines 26-32 | `STUB_NAS` and `STUB_STREAMS` return zero/empty values | INFO | Intentional Phase 3 stub — NAS and Plex adapters planned for Phase 4+. Services appear with `configured: false` so UI correctly shows NOT CONFIGURED. Not a blocker. |
| `main.tsx` | Pre-existing `TS2882` CSS side-effect import type error | INFO | Pre-existing before Phase 3 (confirmed in 03-03-SUMMARY.md). Out of scope. |

No blockers found. No WARNING-severity anti-patterns.

---

### Human Verification Required

#### 1. End-to-end settings persistence through container restart

**Test:** Save a service URL and API key via Settings UI, then restart the Docker container and return to Settings.
**Expected:** URL is re-populated; `hasApiKey` indicator is true; card LED reflects last-known poll state within 45 seconds.
**Why human:** Cannot verify container restart + DB persistence or live network polling without running the full stack.

#### 2. Tab status LEDs reflect live SSE data

**Test:** Configure a real arr service with valid credentials. Watch the Settings page tab bar.
**Expected:** Tab LED changes from grey (stale) to green (online) or amber (warning) within one poll interval (~45 seconds).
**Why human:** Requires a live arr service instance and real-time browser observation.

#### 3. NOT CONFIGURED card deep-link flow

**Test:** On the dashboard, tap an unconfigured service card (grey LED, NOT CONFIGURED label).
**Expected:** Browser navigates to `/settings?service={id}` and the correct service tab is active.
**Why human:** Requires visual confirmation of navigation and tab selection in a running browser.

---

## Deviation Notes

### arr adapter: API version routing

The plan specified all arr services use `/api/v3/health`. The implementation correctly deviates: Radarr and Sonarr use `v3`, while Lidarr, Prowlarr, and Readarr use `v1`. This matches the 03-01 PLAN's `API_VERSION` constant and reflects the actual *arr API versioning reality. The test-connection route mirrors this same version logic.

### Test runner location

The plan's acceptance criteria referenced `npm run test --workspace=packages/backend`. The final implementation places Vitest in root `devDependencies` with `npm run test` at root covering all packages. The `packages/backend/package.json` has no `test` script entry. All 50 tests pass via root-level `npm run test`. This is a tooling organization deviation, not a functional gap.

---

## Gaps Summary

No gaps found. All 13 observable truths are verified against the codebase. All 11 requirement IDs are satisfied. All key links are wired. The data flows from live adapter calls through PollManager state through SSE through the frontend. Backend tests pass (50/50). The only pre-existing issue (CSS type error in `main.tsx`) predates Phase 3 and is out of scope.

---

_Verified: 2026-04-03T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
