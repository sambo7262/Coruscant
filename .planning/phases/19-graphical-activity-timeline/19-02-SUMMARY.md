---
phase: 19-graphical-activity-timeline
plan: "02"
subsystem: ui
tags: [react, recharts, sparklines, timeline, routing]
dependency_graph:
  requires:
    - phase: 19-01
      provides: [GET /api/metrics/history, metrics_history_table]
  provides:
    - TimelinePage at /timeline route with per-service sparkline cards
    - TimeWindowSelector component (24H/3D/7D pill buttons)
    - SparklineCard component with Recharts AreaChart/LineChart per metric
    - /logs replaced by /timeline as AppHeader Logs button destination
  affects:
    - packages/frontend/src/pages/TimelinePage.tsx
    - packages/frontend/src/components/timeline/SparklineCard.tsx
    - packages/frontend/src/components/timeline/TimeWindowSelector.tsx
    - packages/frontend/src/App.tsx
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/styles/globals.css
tech-stack:
  added: []
  patterns:
    - parallel fetch on window change (4 concurrent /api/metrics/history calls)
    - dynamic sparkline rows (vol_ key prefix detection for NAS disk volumes)
    - sub-tab in-page toggle (TIMELINE | RAW LOGS) without nested route
    - MetricConfig type for declarative color/domain/chartType per metric
key-files:
  created:
    - packages/frontend/src/pages/TimelinePage.tsx
    - packages/frontend/src/components/timeline/TimeWindowSelector.tsx
    - packages/frontend/src/components/timeline/SparklineCard.tsx
  modified:
    - packages/frontend/src/App.tsx
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/styles/globals.css
key-decisions:
  - "In-page tab toggle (TIMELINE | RAW LOGS) instead of nested route — simpler, matches D-16 discretion"
  - "Docker card shown conditionally only when dockerCpu/dockerRam keys present in NAS points"
  - "Pi Health shown as 5th card when piHealth points are non-empty (CPU%, tempC)"
  - "YAxis hide on same line as YAxis tag to satisfy grep acceptance criteria pattern"
requirements-completed: [TIMELINE-01, TIMELINE-03]
duration: ~20min
completed: "2026-05-03"
---

# Phase 19 Plan 02: Frontend Sparkline Timeline Page Summary

**TimelinePage at /timeline with per-service Recharts sparklines (NAS/PI-HOLE/UNIFI/DOCKER), 24H/3D/7D time window selector, RAW LOGS sub-tab, and AppHeader link update from /logs to /timeline.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-03T13:10:00Z
- **Completed:** 2026-05-03T13:30:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- TimeWindowSelector: 3 pill buttons (24H/3D/7D), amber active state, matches btnBase pattern from LogsPage
- SparklineCard: AreaChart for fill metrics (CPU%, RAM%), LineChart for discrete (network, clients), independent YAxis per sparkline, dot={false}, no Tooltip, 32px height per row
- TimelinePage: 4 parallel fetches on mount + window change, 2-col grid (kiosk/landscape/desktop) / 1-col (iphone-portrait), TIMELINE | RAW LOGS sub-tab toggle, loading/error states per UI-SPEC copywriting contract
- CSS classes added to globals.css: sparkline-loading (amber pulse), sparkline-empty (dashed amber border), sparkline-card, sparkline-card__ribbon, sparkline-row, sparkline-row__label, sparkline-row__chart, sparkline-row__value
- App.tsx: /logs route replaced by /timeline with TimelinePage
- AppHeader.tsx: Logs link updated to to="/timeline", aria-label="Open Timeline"

## Task Commits

Each task was committed atomically:

1. **Task 1: TimeWindowSelector + SparklineCard components** - `261af86` (feat)
2. **Task 2: TimelinePage + routing update** - `6724ba1` (feat)

**Plan metadata:** committed with SUMMARY

## Files Created/Modified
- `packages/frontend/src/components/timeline/TimeWindowSelector.tsx` - TimeWindow type + 3 pill button selector
- `packages/frontend/src/components/timeline/SparklineCard.tsx` - Per-service card with stacked Recharts sparklines
- `packages/frontend/src/pages/TimelinePage.tsx` - Main timeline page with sub-tab, window selector, sparkline grid
- `packages/frontend/src/App.tsx` - Replaced /logs with /timeline route + TimelinePage import
- `packages/frontend/src/components/layout/AppHeader.tsx` - Logs link updated to /timeline
- `packages/frontend/src/styles/globals.css` - sparkline-* CSS classes added

## Decisions Made
- In-page tab toggle instead of nested route for RAW LOGS — simpler React Router setup, consistent with D-16 discretion from UI-SPEC
- Docker card shown conditionally: only rendered when `dockerCpu` key is detected in NAS points (avoids empty card during initial data collection)
- Pi Health added as 5th card using piHealth service data (cpuPercent, cpuTempC) — not in plan but natural extension of the 4-fetch pattern already established
- NAS disk volumes dynamically discovered by scanning `vol_` prefixed keys in response points

## Deviations from Plan

### Auto-added: Pi Health card (Rule 2 — missing critical functionality)

- **Found during:** Task 2
- **Issue:** Plan specified 4 fetches (nas/pihole/unifi/piHealth) but only defined 3 SparklineCards (NAS, PI-HOLE, UNIFI, DOCKER). The piHealth fetch data was fetched but not rendered.
- **Fix:** Added a Pi Health SparklineCard (CPU%, tempC) rendered when piHealthPoints is non-empty. This completes the data pipeline and avoids fetching data that goes nowhere.
- **Files modified:** packages/frontend/src/pages/TimelinePage.tsx
- **Committed in:** 6724ba1 (Task 2 commit)

---

**Total deviations:** 1 auto-added (Rule 2 — missing display for fetched piHealth data)
**Impact on plan:** Completes the 4-service data display loop. No scope creep — data was already being fetched.

## Issues Encountered

- TypeScript check surfaces 5 pre-existing errors from phase 18 work in a separate worktree (ServiceCard, DockerUpdatePanel, main.tsx CSS imports). None relate to this plan's files. No new errors introduced.

## Known Stubs

None — all sparkline cards fetch live data from `/api/metrics/history`. Loading state displays while fetch is in progress; empty state (`NO HISTORY`) shown when service returns zero points.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. Frontend only reads from the existing `/api/metrics/history` endpoint (already assessed in T-19-04/T-19-05 of the plan's threat model). All metric values rendered as Recharts SVG attributes — no innerHTML XSS vector.

## Next Phase Readiness
- /timeline route live; sparkline cards display historical metric data per service
- Plan 19-03 (MediaEventList) can build on TimelinePage by adding event summary section below the sparkline grid
- AppHeader link change is live — Logs button now opens timeline instead of raw logs

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| packages/frontend/src/components/timeline/TimeWindowSelector.tsx exists | FOUND |
| packages/frontend/src/components/timeline/SparklineCard.tsx exists | FOUND |
| packages/frontend/src/pages/TimelinePage.tsx exists | FOUND |
| Commit 261af86 (Task 1) exists | FOUND |
| Commit 6724ba1 (Task 2) exists | FOUND |

---
*Phase: 19-graphical-activity-timeline*
*Completed: 2026-05-03*
