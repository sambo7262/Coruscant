---
phase: 21-weather-forecast
plan: "02"
subsystem: frontend
tags: [weather, forecast, panel, animation, framer-motion, css, viewport]
dependency_graph:
  requires: ["21-01"]
  provides: ["WeatherForecastPanel", "forecast-panel-css", "forecast-viewport-overrides"]
  affects: ["AppHeader", "globals.css", "viewport-iphone.css"]
tech_stack:
  added: []
  patterns:
    - "Framer Motion AnimatePresence with height 0→auto slide-down (DockerUpdatePanel pattern)"
    - "Mutual exclusion state pattern: opening one panel closes the other"
    - "button wrapper replacing div for interactive weather widget (accessibility)"
    - "html[data-viewport] attribute scoping for all iPhone CSS overrides"
key_files:
  created:
    - packages/frontend/src/components/layout/WeatherForecastPanel.tsx
  modified:
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/styles/globals.css
    - packages/frontend/src/styles/viewport-iphone.css
decisions:
  - "Used motion.div with height 0→auto per DockerUpdatePanel pattern (D-01 in UI-SPEC)"
  - "Backdrop z-index 8, panel z-index 9 — matches existing pi-health/docker-update stacking"
  - "getDayLabel uses noon offset (T12:00:00) to prevent DST off-by-one on day name calculation"
  - "app-header__weather div → button for native keyboard/a11y support with aria-expanded"
  - "weather-forecast-panel left out of the existing app-header__weather CSS class (replaced by btn)"
metrics:
  duration_minutes: 25
  completed_date: "2026-05-04"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 4
---

# Phase 21 Plan 02: Weather Forecast Panel Summary

**One-liner:** 5-day forecast slide-down panel with DayColumn components, mutual exclusion with PiHealthPanel, and full viewport CSS (portrait compression + landscape safe-area insets).

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create WeatherForecastPanel + wire AppHeader | 63e0256 | WeatherForecastPanel.tsx, AppHeader.tsx |
| 2 | Add forecast panel CSS and viewport overrides | cfcec7f | globals.css, viewport-iphone.css |

## What Was Built

### WeatherForecastPanel.tsx (new)
- `WeatherForecastPanel` component: Framer Motion slide-down with `height 0→auto` (DockerUpdatePanel pattern)
- `DayColumn` internal component: day name, WeatherIcon (size=24), high temp (amber), low temp (dim), condition label
- `getDayLabel`: returns "TODAY" for index 0, otherwise short weekday name uppercased; uses T12:00:00 noon offset to prevent DST boundary errors
- `getConditionLabel`: full WMO code mapping covering clear/cloudy/fog/drizzle/freezing/rain/snow/showers/storm
- Empty state: "FORECAST UNAVAILABLE" when forecast array is empty
- Stale label: "— LAST UPDATED Nm AGO" appended to header when isStale and staleMinutes > 0

### AppHeader.tsx (modified)
- Added `forecastOpen` state alongside existing `panelOpen`
- Added `handlePiHealthToggle` and `handleForecastToggle` with mutual exclusion
- Replaced `div.app-header__weather` with `button.app-header__weather-btn` (aria-expanded, aria-label)
- Added second `AnimatePresence` block with `motion.div` backdrop + `WeatherForecastPanel`
- Graceful degradation: `weatherData?.forecast ?? []` handles pre-Phase-21 backend data

### globals.css (modified)
- Added `.weather-forecast-panel` block: fixed top 44px, z-index 9, dark translucent background
- Added `.weather-forecast-panel__*` sub-classes: inner, header, stale-label, days, day, day-name, high, low, condition, empty
- Added `.weather-forecast-backdrop`: fixed inset 0, z-index 8, semi-transparent
- Added `.app-header__weather-btn`: all:unset button reset with flex alignment

### viewport-iphone.css (modified)
- Shared: top offset with safe-area-inset-top, touch-action manipulation on weather-btn
- Portrait: padding 8px, high=16px, day-name/low/condition=10px
- Landscape: padding-left/right env(safe-area-inset-*), high=18px

## Verification

- TypeScript: Pre-existing errors in ServiceCard/DockerUpdatePanel (unrelated to this plan); new files compile cleanly
- Viewport lint: `node scripts/verify-viewport-isolation.mjs` — PASS (no !important, no @media)
- Test suite: 210/210 tests pass

## Checkpoint

**Task 3 is `type="checkpoint:human-verify"`** — execution paused for visual verification on kiosk and iPhone.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data wired through props from AppHeader's weatherData SSE state.

## Threat Flags

None — all rendering uses React text nodes (auto-escaped). No dangerouslySetInnerHTML. WMO codes mapped via static function, not eval.

## Self-Check: PASSED

- [x] WeatherForecastPanel.tsx exists at packages/frontend/src/components/layout/WeatherForecastPanel.tsx
- [x] AppHeader.tsx modified with forecastOpen, handleForecastToggle, backdrop, AnimatePresence
- [x] globals.css contains weather-forecast-panel, weather-forecast-backdrop, app-header__weather-btn
- [x] viewport-iphone.css contains all three viewport scope levels
- [x] Commit 63e0256 exists (Task 1)
- [x] Commit cfcec7f exists (Task 2)
- [x] 210 tests pass
- [x] Viewport isolation lint passes
