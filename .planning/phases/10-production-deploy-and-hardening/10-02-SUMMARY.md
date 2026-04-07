---
phase: 10
plan: 02
subsystem: backend/frontend
tags: [webhook-logging, pihole-metrics, led-glow, bug-fix]
dependency_graph:
  requires: []
  provides: [webhook-log-category, pihole-bpm-fix, mediastackrow-led-glow]
  affects: [log-viewer-filter-dropdown, pihole-dashboard-bpm, media-tile-leds]
tech_stack:
  added: []
  patterns: [pino-service-field-routing, css-led-glow-alignment]
key_files:
  created: []
  modified:
    - packages/backend/src/routes/arr-webhooks.ts
    - packages/backend/src/routes/tautulli-webhook.ts
    - packages/backend/src/adapters/pihole.ts
    - packages/frontend/src/components/cards/ServiceCard.tsx
decisions:
  - "Webhook log service field changed from service.toUpperCase() to 'webhook' — single filter category in log viewer covers all arr+tautulli events"
  - "Pi-hole frequency field is QPS from FTL get_qps(); multiply by 60 for QPM — matches Pi-hole dashboard display"
  - "MediaStackRow LED glow upgraded to 8px/3px spread matching StatusDot — adds ledBreathe on idle online, ledFlashDown on offline, color property for ledOverPulse currentColor"
metrics:
  duration: "295s (~5min)"
  completed_date: "2026-04-07"
  tasks_completed: 2
  files_modified: 4
requirements_satisfied: [PROD-03]
---

# Phase 10 Plan 02: Bug Fixes — Webhook Logging, Pi-hole BPM, LED Glow

Webhook logs now use `service: 'webhook'` (single filterable category), Pi-hole BPM is corrected to QPS×60, and MediaStackRow LEDs match StatusDot glow intensity with breathing animation.

## Objective

Fix known bugs D-12 (LED glow), D-13 (BPM accuracy), D-15/D-16 (webhook log category and format) for v1.0 release.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Webhook logging hardening (D-15, D-16) + Pi-hole BPM fix (D-13) | e5a3974 | arr-webhooks.ts, tautulli-webhook.ts, pihole.ts |
| 2 | MediaStackRow LED/bar glow (D-12) + proactive bug scan (D-14) | eca8219 | ServiceCard.tsx |

## Changes Made

### Task 1: Backend Fixes

**arr-webhooks.ts (D-15, D-16):**
- Changed `{ service: service.toUpperCase() }` to `{ service: 'webhook' }` in pino log call
- Adopted D-16 format: `${service} | ${eventType} | ${title} | ${ts}` (e.g., `radarr | grab | The Dark Knight | 14:30 04/07/2026`)
- All 7 arr service endpoints now emit a single 'webhook' filter category in the log viewer

**tautulli-webhook.ts (D-15, D-16):**
- Added webhook log calls — previously had NO logging for inbound Tautulli events
- Separate log call for stop events: `tautulli | stop | ${title} | ${ts}`
- Non-stop events: `tautulli | ${event} | ${title} | ${ts}`
- Both use `{ service: 'webhook' }` for unified log filter category

**pihole.ts (D-13):**
- Fixed `queriesPerMinute` — was `queries?.frequency ?? 0` (QPS)
- Now `Math.round((queries?.frequency ?? 0) * 60)` (QPM)
- Added comment explaining Pi-hole FTL `get_qps()` returns queries per second

### Task 2: Frontend LED Glow Fix

**ServiceCard.tsx — MediaStackRow `getLedStyle()` (D-12):**
- Upgraded `boxShadow` from `0 0 6px` to `0 0 8px 3px` spread — matches `StatusDot` `STATUS_GLOW` pattern
- Added `animation: 'ledBreathe 3s ease-in-out infinite'` to green online idle state — was static, StatusDot breathes
- Added `animation: 'ledFlashDown 0.4s ease-in-out infinite'` to offline state — matches StatusDot offline behavior
- Added `color` CSS property to all LED states — required for `ledOverPulse` animation which uses `currentColor` for its `box-shadow`

## Bugs Found (D-14 Proactive Scan)

**Confirmed bug fixed:**
- `color` property was missing from `getLedStyle()` return values. The `ledOverPulse` animation uses `box-shadow: 0 0 0 4px currentColor` — without `color` set on the element, the over-pulse glow inherits an incorrect/transparent color. Fixed by adding `color` to all states in `getLedStyle()`.

**Non-blocking findings (not fixed — cosmetic only):**
1. `PlexInstrument` line 463: hardcoded `'#4ADE80'` for CPU color instead of `var(--cockpit-green)` — cosmetic, same visual result, out of scope
2. `SabnzbdLed` line 780: purple boxShadow uses `0 0 6px` vs the 8px/3px pattern now used in MediaStackRow — cosmetic inconsistency, not a functional bug, out of scope

**No other confirmed bugs found.** No missing `key` props, no unguarded `any` assertions causing runtime crashes, no accessibility regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `color` property to all getLedStyle() states**
- **Found during:** Task 2 (D-14 scan)
- **Issue:** `ledOverPulse` animation uses `currentColor` for box-shadow. Without `color` set on the LED element, the over-pulse glow falls back to inherited/transparent color, making the transition burst invisible
- **Fix:** Added `color: {var}` to all states in `getLedStyle()` — matches the `StatusDot` pattern which also sets `color: STATUS_COLORS[status]`
- **Files modified:** packages/frontend/src/components/cards/ServiceCard.tsx
- **Commit:** eca8219

**2. [Rule 2 - Missing] Added `ledFlashDown` animation to offline state**
- **Found during:** Task 2 D-12 analysis
- **Issue:** MediaStackRow offline LED was static; `StatusDot` offline state uses `ledFlashDown 0.4s ease-in-out infinite` — kiosk distance visibility requires flashing for down state
- **Fix:** Added `animation: 'ledFlashDown 0.4s ease-in-out infinite'` to offline branch
- **Files modified:** packages/frontend/src/components/cards/ServiceCard.tsx
- **Commit:** eca8219

## Known Stubs

None.

## Pre-existing Test Failures (Out of Scope)

17 tests failing in 5 test files — verified pre-existing before this plan's changes (git stash comparison):
- `arr-webhooks.test.ts`: 5 failures — mock for `poll-manager.js` doesn't export `classifyArrEvent`/`extractArrTitle`, causing 500 responses
- `sse.test.ts`: 6 failures — ERR_HTTP_HEADERS_SENT in SSE test teardown
- `nas-adapter.test.ts`: 2 failures
- `pihole-adapter.test.ts`: 1 failure
- `plex-adapter.test.ts`: 3 failures

These are tracked for a future maintenance plan, not introduced by 10-02.

## Self-Check: PASSED

- `packages/backend/src/routes/arr-webhooks.ts` — FOUND (modified)
- `packages/backend/src/routes/tautulli-webhook.ts` — FOUND (modified)
- `packages/backend/src/adapters/pihole.ts` — FOUND (modified)
- `packages/frontend/src/components/cards/ServiceCard.tsx` — FOUND (modified)
- Commit e5a3974 — FOUND
- Commit eca8219 — FOUND
