---
phase: 02-core-ui-shell
plan: 12
subsystem: ui
tags: [react, framer-motion, typescript, cockpit-aesthetic, service-cards, arr-services]

# Dependency graph
requires:
  - phase: 02-core-ui-shell
    provides: ServiceCard and ServiceDetailPage components with cockpit styling
provides:
  - Simplified arr card face with status LED and download indicator (no dot matrix)
  - Arr detail page with operational stats (queue, monitored, library, missing, attention items)
  - ArrInstrument component replacing DotMatrixInstrument
  - ArrDetailView component with cockpit dot-leader format stats
  - Attention Required section with amber tint for manual import and failed items
affects: [03-service-integration, 04-pihole-integration, arr-service-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ArrInstrument: 2-row minimal readout (status LED + download indicator) replacing dot-matrix
    - ArrDetailView: dot-leader stat rows with conditional Attention Required amber section
    - DotLeaderRow: extracted reusable helper for LABEL ... VALUE cockpit readout pattern

key-files:
  created: []
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/pages/ServiceDetailPage.tsx
    - packages/backend/src/mock/generator.ts
    - packages/frontend/src/styles/globals.css

key-decisions:
  - "Arr card face uses ArrInstrument (status LED + download bar) not DotMatrixInstrument — reduces noise, improves at-a-glance readability"
  - "Bazarr shows subtitle grab count on card face instead of download bar — subtitle service has different activity model"
  - "Attention Required section uses amber left border + tint background — visually distinct from stats, drawn from cockpit warning palette"
  - "DotLeaderRow extracted as shared component — used by both ArrDetailView and generic fallback view"

patterns-established:
  - "ArrInstrument pattern: status LED (10px circle with glow) + conditional download indicator row for arr service cards"
  - "Attention Required pattern: amber tint section with 3px left border, only rendered when attentionItems.length > 0"

requirements-completed:
  - DASH-03
  - DASH-05
  - DASH-07

# Metrics
duration: 3m7s
completed: 2026-04-03
---

# Phase 02 Plan 12: Arr Card Simplification + Detail Enrichment Summary

**Arr service cards simplified to status LED + pulsing download indicator; detail pages enriched with queue/monitored/library stats and amber Attention Required section for manual import items**

## Performance

- **Duration:** 3m 7s
- **Started:** 2026-04-03T17:16:43Z
- **Completed:** 2026-04-03T17:19:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced dot-matrix LED grid on arr cards with a clean 2-row instrument readout (status LED + download bar or IDLE text)
- Radarr mock configured as actively downloading 1080p at 45% progress — pulsing amber bar visible
- ServiceDetailPage now renders arr-specific detail view for radarr/sonarr/lidarr/bazarr with operational stats
- Attention Required section renders for Radarr with 2 mock manual import filenames in amber monospace text

## Task Commits

1. **Task 1: Simplify Arr card face in ServiceCard** - `3081f7a` (feat)
2. **Task 2: Enrich Arr detail page with operational data** - `390847b` (feat)

## Files Created/Modified

- `packages/frontend/src/components/cards/ServiceCard.tsx` - Replaced DotMatrixInstrument with ArrInstrument; status LED + download indicator rows
- `packages/frontend/src/pages/ServiceDetailPage.tsx` - Added ArrDetailView, DotLeaderRow helper, Attention Required section; ARR_IDS detection
- `packages/backend/src/mock/generator.ts` - Enriched arr mock data: downloading, activeDownloads, downloadQuality, downloadProgress, queue, monitored, librarySize, missing, attentionItems
- `packages/frontend/src/styles/globals.css` - Added arrDownloadPulse keyframe for amber bar animation

## Decisions Made

- ArrInstrument replaces DotMatrixInstrument — dot matrix showed queue slot counts which are noisy at a glance; status + download state is the only info worth showing on the card face
- Bazarr gets `activeSubtitleGrabs` instead of a download bar — subtitle services have a fundamentally different activity model
- DotLeaderRow extracted as a shared helper — used by both ArrDetailView and the generic fallback view for non-arr services, keeping the dot-leader pattern consistent
- Attention Required section is conditionally rendered — zero-item case is entirely hidden, no empty state noise

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in `packages/frontend/src/main.tsx` (TS2882: side-effect CSS import) exists before this plan and is unrelated to any changes here — Vite resolves CSS imports at build time, not via tsc.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Arr card faces are minimal and correct — ready for real Radarr/Sonarr/Lidarr/Bazarr API integration in Phase 3
- Attention Required section is wired and styled — Phase 3 only needs to populate `attentionItems` from live API data
- DotLeaderRow pattern is available for reuse in other detail page enrichment work

---
*Phase: 02-core-ui-shell*
*Completed: 2026-04-03*
