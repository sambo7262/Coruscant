---
phase: 03-settings-first-service-adapters
plan: "04"
subsystem: ui
tags: [react, dashboard, service-cards, settings, unconfigured-state]

# Dependency graph
requires:
  - phase: 03-settings-first-service-adapters/03-01
    provides: PollManager with prowlarr/readarr in snapshot, configured flag on ServiceStatus
  - phase: 03-settings-first-service-adapters/03-02
    provides: Settings API with credential storage, SSE serving real poll data
  - phase: 03-settings-first-service-adapters/03-03
    provides: SettingsPage UI with tabbed layout and test-connection flow
provides:
  - ServiceCard NOT CONFIGURED state (grey LED + dim label) for service.configured === false
  - Deep-link from unconfigured card tap to /settings?service={id}
  - Prowlarr and Readarr in ARR_IDS — renders ArrInstrument on their cards
  - Full end-to-end flow: configure in Settings → live card on dashboard
affects:
  - Phase 04+ service detail pages (Prowlarr/Readarr now navigable)
  - Future services using configured flag for gating

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "service.configured === false gates card to NOT CONFIGURED branch — explicit false, not falsy, so legacy/mock services without the field are unaffected"
    - "Grey LED for unconfigured: force StatusDot to 'stale' which maps to grey with no animation"
    - "isUnconfigured short-circuits both click handler and instrument body — clean branch without nesting"

key-files:
  created: []
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx

key-decisions:
  - "configured === false (strict) check — services without the flag (legacy mocks) are not treated as unconfigured"
  - "StatusDot status='stale' reused for grey LED on unconfigured cards — no new LED state needed"
  - "DashboardPage.tsx required no changes — CardGrid passes all snapshot services through without filtering"

patterns-established:
  - "NOT CONFIGURED render branch: check isUnconfigured at component top, branch instrumentBody and handleClick"

requirements-completed:
  - CFG-01
  - SVCST-01
  - SVCST-02
  - SVCST-03
  - SVCST-04
  - SVCST-05
  - SVCACT-01
  - SVCACT-02
  - SVCACT-03

# Metrics
duration: 5min
completed: 2026-04-03
---

# Phase 03 Plan 04: Dashboard NOT CONFIGURED State and Prowlarr/Readarr Support Summary

**ServiceCard gains grey LED + NOT CONFIGURED label for unconfigured services, deep-links to /settings?service={id}, and Prowlarr/Readarr added to ARR_IDS for ArrInstrument rendering**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-03T20:33:00Z
- **Completed:** 2026-04-03T20:34:40Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- ServiceCard renders NOT CONFIGURED state with grey LED (stale) and dim "NOT CONFIGURED" label for any service with `configured === false`
- Unconfigured card tap navigates to `/settings?service={id}` instead of detail view — deep-links to correct settings tab
- Prowlarr and Readarr added to ARR_IDS so their cards display ArrInstrument body
- DashboardPage and CardGrid required no changes — all snapshot services render automatically

## Task Commits

1. **Task 1: NOT CONFIGURED card state and Prowlarr/Readarr support** - `d223089` (feat)

**Plan metadata:** pending final commit

## Files Created/Modified

- `packages/frontend/src/components/cards/ServiceCard.tsx` - Added isUnconfigured branch, NOT CONFIGURED label, grey LED override, settings deep-link click handler, prowlarr/readarr in ARR_IDS

## Decisions Made

- Used `service.configured === false` strict check so legacy services without the `configured` field are not affected
- Reused `StatusDot status='stale'` for grey LED — no new component or LED state needed
- `getCardGlow` also receives `'stale'` for unconfigured cards so no orange/red glow appears

## Deviations from Plan

None — plan executed exactly as written. DashboardPage.tsx verified to require no changes (CardGrid already passes all services through without ID filtering).

## Issues Encountered

Pre-existing TypeScript error in `packages/frontend/src/main.tsx` (CSS side-effect import type declaration) — present before this plan's changes, confirmed by git stash verification. Out of scope per deviation boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full Phase 3 end-to-end flow complete pending human visual verification (Task 2 checkpoint)
- After verification approval: dashboard shows NOT CONFIGURED cards, Settings configures services, SSE delivers live poll data, cards update within one poll interval
- Phase 4 can begin: Pi-hole and NAS deep integration

## Known Stubs

None — ServiceCard NOT CONFIGURED state is fully wired. The stub tracking from prior plans (Prowlarr/Readarr returning mock data from pollArr when no live service is available) is the backend's responsibility and noted in 03-01-SUMMARY.md.

---
*Phase: 03-settings-first-service-adapters*
*Completed: 2026-04-03*
