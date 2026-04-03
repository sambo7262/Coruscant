---
phase: 02-core-ui-shell
plan: 02
subsystem: ui
tags: [react, react-router-dom, framer-motion, lucide-react, css-animations, tron-design-system, typescript]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: Frontend Vite/React scaffold, shared types package, tsconfig setup
provides:
  - Tron design system CSS (custom properties, typography scale, animation keyframes)
  - React Router with 4 routes (/, /services/:serviceId, /settings, /logs)
  - Animated CSS grid background with traveling light pulses
  - AppHeader fixed component with CORUSCANT title, icon buttons, NAS stats strip
  - Page stubs: DashboardPage, ServiceDetailPage, SettingsPage (animation slider), LogsPage
  - Shared DashboardSnapshot, ServiceStatus, NasStatus, PlexStream TypeScript types
affects: [02-03, 02-04, 02-05, phase-03, phase-04]

# Tech tracking
tech-stack:
  added:
    - react-router-dom (client-side routing)
    - framer-motion (animations — used in later tasks)
    - lucide-react (Settings and List icons in AppHeader)
    - "@emotion/is-prop-valid" (framer-motion peer dep)
    - JetBrains Mono via Google Fonts CDN
  patterns:
    - CSS custom properties for design tokens (--tron-blue, --tron-red, --tron-amber, etc.)
    - Animation keyframes use transform + opacity ONLY (DASH-08 compliance)
    - prefers-reduced-motion media query wrapping all animations
    - BrowserRouter wraps App at main.tsx entry point
    - Layout shell pattern: GridBackground (z:0) + AppHeader (z:10) + main content (z:1)
    - Components accept data | null props and render "---" placeholder when null

key-files:
  created:
    - packages/frontend/src/styles/globals.css
    - packages/frontend/src/pages/DashboardPage.tsx
    - packages/frontend/src/pages/ServiceDetailPage.tsx
    - packages/frontend/src/pages/SettingsPage.tsx
    - packages/frontend/src/pages/LogsPage.tsx
    - packages/frontend/src/components/layout/GridBackground.tsx
    - packages/frontend/src/components/layout/AppHeader.tsx
  modified:
    - packages/frontend/index.html (JetBrains Mono font link)
    - packages/frontend/src/main.tsx (BrowserRouter + globals.css import)
    - packages/frontend/src/App.tsx (route-based shell replacing placeholder)
    - packages/shared/src/types.ts (DashboardSnapshot, ServiceStatus, NasStatus, PlexStream)

key-decisions:
  - "Shared types (NasStatus, DashboardSnapshot etc.) added to packages/shared/src/types.ts in this plan rather than waiting — AppHeader needed NasStatus for type-safe prop"
  - "GridBackground stubs created in Task 1 to allow App.tsx build verification, replaced with full implementation in Task 2"
  - "Settings page animation intensity slider writes directly to CSS custom property --grid-pulse-opacity via document.documentElement.style.setProperty — no React state needed"

patterns-established:
  - "Tron design system: always use CSS custom properties from globals.css, never hardcode #00c8ff inline"
  - "Layout z-index layers: grid=0, content=1, header=10, banner=20, drawer=30"
  - "All animations use transform/opacity only — no height/width/color in @keyframes"
  - "Components accept NasStatus|null — render --- when null, real values when populated"

requirements-completed: [DASH-01, DASH-02, DASH-07]

# Metrics
duration: 8min
completed: 2026-04-03
---

# Phase 02 Plan 02: Core UI Shell — Design System, Routing, and Layout Components Summary

**Tron design system with CSS animation keyframes, React Router shell with 4 routes, animated CSS grid background, and fixed AppHeader with NAS stats strip**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-03T15:01:00Z
- **Completed:** 2026-04-03T15:04:52Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Established complete Tron design system: color palette (--tron-blue, --tron-red, --tron-amber), typography scale (display/heading/body/label), and animation keyframes (gridPulseVertical, gridPulseHorizontal, borderTrace, breathe, pulseAmber, flashRed, marquee) — all DASH-08 compliant (transform + opacity only)
- Configured React Router v6 in main.tsx with BrowserRouter and 4 routes: /, /services/:serviceId, /settings, /logs — page stubs render correct copywriting per UI-SPEC
- Built GridBackground (fixed CSS grid with two animated pulse sweeps, aria-hidden, pointerEvents:none) and AppHeader (fixed 88px, two 44px rows: title/icons + NAS stats strip, Settings/Logs 44x44 touch targets)
- Populated packages/shared/src/types.ts with DashboardSnapshot, ServiceStatus, NasStatus, and PlexStream interfaces ahead of Phase 3 integration

## Task Commits

1. **Task 1: Install frontend deps, CSS design system, routing and page stubs** - `5a568a4` (feat)
2. **Task 2: Build GridBackground and AppHeader components** - `2cd6083` (feat)

## Files Created/Modified

- `packages/frontend/src/styles/globals.css` - Tron CSS design system: custom properties, typography classes, all animation keyframes, reduced motion support
- `packages/frontend/src/main.tsx` - BrowserRouter wrapper + globals.css import
- `packages/frontend/src/App.tsx` - Route-based shell: GridBackground + AppHeader + Routes with 4 paths
- `packages/frontend/index.html` - JetBrains Mono font preconnect + stylesheet link
- `packages/frontend/src/pages/DashboardPage.tsx` - Stub: "Dashboard loading..."
- `packages/frontend/src/pages/ServiceDetailPage.tsx` - Stub: back button + mock metric slots (Status/Last checked/Response time: ---)
- `packages/frontend/src/pages/SettingsPage.tsx` - Stub: animation intensity range input controlling --grid-pulse-opacity
- `packages/frontend/src/pages/LogsPage.tsx` - Stub: "Log viewer coming in Phase 7."
- `packages/frontend/src/components/layout/GridBackground.tsx` - Fixed animated grid with vertical + horizontal pulse sweeps
- `packages/frontend/src/components/layout/AppHeader.tsx` - Fixed 88px header: CORUSCANT title, Settings/Logs icon buttons, NAS stats strip
- `packages/shared/src/types.ts` - DashboardSnapshot, ServiceStatus, NasStatus, PlexStream interfaces

## Decisions Made

- Added shared types (NasStatus etc.) to packages/shared in this plan rather than waiting for Plan 03, since AppHeader needed NasStatus for type-safe props. This is ahead of schedule but not out of scope — the plan's App.tsx imports AppHeader which needs the type.
- Settings animation slider writes directly to a CSS custom property via `document.documentElement.style.setProperty` — no React state, no re-render overhead. Phase 3 will persist this setting to SQLite.
- Stub layout components (GridBackground, AppHeader) were created as empty returns during Task 1 to allow App.tsx to compile, then replaced with full implementations in Task 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added shared types to packages/shared/src/types.ts**
- **Found during:** Task 1 (setting up App.tsx which imports AppHeader needing NasStatus)
- **Issue:** AppHeader imports `NasStatus` from `@coruscant/shared` but shared/src/types.ts was empty (`export {}`). The build would fail without the type definition.
- **Fix:** Populated packages/shared/src/types.ts with DashboardSnapshot, ServiceStatus, NasStatus, and PlexStream interfaces as specified in CONTEXT.md D-24. Built shared package to generate dist types.
- **Files modified:** packages/shared/src/types.ts, packages/shared/dist/ (gitignored)
- **Verification:** Build passes with TypeScript resolving NasStatus from @coruscant/shared
- **Committed in:** 5a568a4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing critical type definitions)
**Impact on plan:** Essential for AppHeader to compile. Types were already fully specified in CONTEXT.md D-24 — this was implementation of planned data contract, not scope creep.

## Known Stubs

- `packages/frontend/src/pages/DashboardPage.tsx` — renders "Dashboard loading..." placeholder. Plan 03 replaces with CardGrid + SSE wiring. This is intentional — the stub satisfies route connectivity.
- `packages/frontend/src/pages/LogsPage.tsx` — "Log viewer coming in Phase 7." Intentional per UI-SPEC copywriting contract.
- `packages/frontend/src/components/layout/AppHeader.tsx` — `nas` prop always receives `null` (passed as `<AppHeader nas={null} />` in App.tsx). Plan 03 wires live SSE data. NAS stats strip shows "---" when null — this is correct stub behavior per D-05.

## Issues Encountered

None — both tasks executed cleanly with no build errors.

## Next Phase Readiness

- CSS design system is complete and stable — all subsequent plans use globals.css custom properties
- React Router is configured and working — Plan 03 can immediately add CardGrid to DashboardPage
- AppHeader accepts NasStatus | null — ready for SSE wiring in Plan 03
- Shared types are defined — backend mock data generator in Plan 03 can type against DashboardSnapshot
- GridBackground is operational — animated Tron grid visible on all pages immediately

---
*Phase: 02-core-ui-shell*
*Completed: 2026-04-03*
