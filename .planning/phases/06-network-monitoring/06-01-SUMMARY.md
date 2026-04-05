---
phase: 06-network-monitoring
plan: 01
subsystem: backend/adapters
tags: [unifi, network-monitoring, tdd, adapter, types]
dependency_graph:
  requires: []
  provides: [unifi-adapter, unifi-shared-types]
  affects: [06-02-PLAN.md, 06-03-PLAN.md]
tech_stack:
  added: []
  patterns: [x-api-key-header-auth, gateway-first-health-rollup, module-level-cache, parallel-requests, graceful-401-fallback]
key_files:
  created:
    - packages/backend/src/adapters/unifi.ts
    - packages/backend/src/__tests__/unifi-adapter.test.ts
    - .planning/phases/06-network-monitoring/deferred-items.md
  modified:
    - packages/shared/src/types.ts
decisions:
  - "UniFi authentication uses static X-API-KEY header (not cookies, not Basic auth)"
  - "stat/health endpoint (community API path) is optional — 401 returns wanTxMbps=null rather than failing the poll"
  - "Site ID resolved once and cached in module-level variable; resetUnifiCache() clears for reconfiguration"
  - "Gateway-first health LED rollup: RED if no gateways or gateway offline; AMBER if non-gateway offline; GREEN if all online"
  - "Peak tracking uses 6h rolling window via setTimeout; unref() allows Node.js to exit cleanly"
metrics:
  duration: 206s
  completed: "2026-04-05T21:35:36Z"
  tasks: 1
  files: 4
---

# Phase 06 Plan 01: UniFi Adapter — Types, Polling Logic, and Unit Tests Summary

UniFi network adapter with X-API-KEY auth, gateway-first health rollup, WAN throughput from stat/health endpoint, and site ID caching — 16 unit tests all passing.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Add failing tests for UniFi adapter | a1d1649 | packages/backend/src/__tests__/unifi-adapter.test.ts |
| 1 (GREEN) | Implement UniFi adapter with shared types | 9b26701 | packages/shared/src/types.ts, packages/backend/src/adapters/unifi.ts |

## What Was Built

**Shared types** (`packages/shared/src/types.ts`):
- `UnifiDevice` interface: macAddress, model, name, state, uptime (seconds), clientCount
- `UnifiMetrics` interface: clientCount, wanTxMbps/wanRxMbps (nullable), peakTxMbps/peakRxMbps, devices array, healthStatus

**Backend adapter** (`packages/backend/src/adapters/unifi.ts`):
- `pollUnifi(baseUrl, apiKey)` — main polling function returning ServiceStatus
- `resetUnifiCache()` — clears siteId and peaks for test isolation / reconfiguration
- `classifyModel(model)` — maps UDM/UDR → gateway, USW → switch, U6/UAP/UAL/UAE → ap
- `computeHealthStatus(devices)` — gateway-first rollup per D-05
- `formatUptime(seconds)` — formats to "14d 0h" or "5h" or "0h"
- `resolveSiteId(baseUrl, apiKey)` — internal, caches after first call

**Key implementation notes:**
- `stat/health` endpoint uses community API path (`/proxy/network/api/s/default/stat/health`) wrapped in its own try/catch so a 401 returns null without failing the overall poll
- WAN field names contain literal hyphens (`tx_bytes-r`, `rx_bytes-r`) requiring bracket notation
- Bytes/s to Mbps: divide by 125,000
- Peak timer uses `unref()` so it doesn't prevent clean process exit in tests

## Test Coverage

16 tests, all passing:
- Happy path with clientCount, wanTxMbps, healthStatus, devices
- X-API-KEY header sent on all requests
- Network error → status 'offline', no throw
- stat/health 401 → wanTxMbps=null, wanRxMbps=null, poll succeeds
- computeHealthStatus: gateway offline → offline, AP offline → warning, all online → online, no gateways → offline
- classifyModel: UDM-Pro/UDR=gateway, USW=switch, U6/UAP/UAE=ap, unknown=unknown
- formatUptime: 1209600→'14d 0h', 18000→'5h', 0→'0h'
- resolveSiteId caching: /sites called once across two polls
- resetUnifiCache forces /sites re-resolution on next poll
- Bytes-to-Mbps conversion accuracy: 125000 bytes/s = 1.0 Mbps
- Peak tracking: peak stays at 10 after 10→5 progression

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The adapter returns real data from mocked endpoints; no stub values flow to UI in this plan. Plan 06-02 will wire `pollUnifi` to the PollManager and expose it via the `/snapshot` SSE feed.

## Deferred Issues (out of scope)

Pre-existing failures in `packages/backend/src/__tests__/plex-adapter.test.ts` — 3 `fetchPlexServerStats` tests produce NaN for CPU/RAM percent. These were failing before Phase 06 began. Logged to `.planning/phases/06-network-monitoring/deferred-items.md`.

## Self-Check: PASSED

- `packages/shared/src/types.ts` — FOUND (modified)
- `packages/backend/src/adapters/unifi.ts` — FOUND (created)
- `packages/backend/src/__tests__/unifi-adapter.test.ts` — FOUND (created, 316 lines)
- Commit a1d1649 — FOUND (test RED commit)
- Commit 9b26701 — FOUND (implementation GREEN commit)
- All 16 UniFi tests: PASS
