---
phase: 02-core-ui-shell
plan: "07"
subsystem: frontend-ui
tags: [cockpit-aesthetic, status-led, app-header, back-navigation, tron-removal]
dependency_graph:
  requires: [02-06]
  provides: [cockpit-led-status-dot, cockpit-header-back-nav]
  affects: [all-pages, service-card, settings-page, logs-page]
tech_stack:
  added: []
  patterns: [cockpit-css-vars, react-router-useLocation, led-animation-keyframes]
key_files:
  created: []
  modified:
    - packages/frontend/src/components/ui/StatusDot.tsx
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/App.tsx
    - packages/frontend/src/pages/SettingsPage.tsx
    - packages/frontend/src/pages/LogsPage.tsx
decisions:
  - "showBack detection lives in App.tsx via useLocation — avoids double-header problem on Settings/Logs pages"
  - "Icon nav buttons (Settings/Logs) hidden when showBack=true — redundant on sub-pages"
  - "Connection-lost LED in AppHeader uses ledPulseWarn animation to match new cockpit keyframe names"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-03T15:58:42Z"
  tasks: 2
  files: 5
---

# Phase 02 Plan 07: StatusDot LED + AppHeader Cockpit Chrome Summary

StatusDot restyled as 10px cockpit LED with radial glow and health-state animations; AppHeader rebranded to amber cockpit chrome with showBack back-navigation routing all sub-pages through App.tsx useLocation detection.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restyle StatusDot as cockpit LED with radial glow | be8c6d3 | StatusDot.tsx |
| 2 | Restyle AppHeader as cockpit chrome and add showBack prop | ab89a3c | AppHeader.tsx, App.tsx, SettingsPage.tsx, LogsPage.tsx |

## Deviations from Plan

None — plan executed exactly as written.

Note: The TypeScript error in `packages/frontend/src/main.tsx` (CSS side-effect import declaration) is pre-existing and out of scope for this plan. Confirmed it existed before any changes in this plan.

## Verification Results

- All 4 modified frontend files: 0 Tron references
- StatusDot: 10px, cockpit-green/amber/red/grey, ledBreathe/ledPulseWarn/ledFlashDown animations, aria-hidden
- AppHeader: cockpit-amber title, rgba(232,160,32,0.30) border, 0 1px 8px rgba(232,160,32,0.15) box-shadow, showBack prop, Link to "/" when showBack=true
- App.tsx: useLocation imported, showBack passed based on pathname !== '/'
- SettingsPage: cockpit-amber heading, text-offwhite body, "LED Intensity" label
- LogsPage: cockpit-amber heading, text-offwhite body

## Known Stubs

None — all plan goals achieved.

## Self-Check: PASSED

Files verified present:
- packages/frontend/src/components/ui/StatusDot.tsx — FOUND
- packages/frontend/src/components/layout/AppHeader.tsx — FOUND
- packages/frontend/src/App.tsx — FOUND
- packages/frontend/src/pages/SettingsPage.tsx — FOUND
- packages/frontend/src/pages/LogsPage.tsx — FOUND

Commits verified:
- be8c6d3 — FOUND
- ab89a3c — FOUND
