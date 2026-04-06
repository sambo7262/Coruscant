---
phase: 09-local-weather-ui-polish
plan: "04"
subsystem: frontend-ui
tags: [weather, animations, micro-interactions, entrance-stagger, led-pulse]
dependency_graph:
  requires: [09-01, 09-02, 09-03]
  provides: [animated-weather-widget, metric-count-up, led-over-pulse, entrance-stagger]
  affects: [AppHeader, CardGrid, ServiceCard, StatusDot]
tech_stack:
  added: [useAnimatedNumber hook, Framer Motion entrance stagger]
  patterns: [ease-out cubic tween, requestAnimationFrame cleanup, onAnimationEnd reset, prevStatusRef pattern]
key_files:
  created:
    - packages/frontend/src/hooks/useAnimatedNumber.ts
    - packages/frontend/src/components/weather/WeatherIcon.tsx
  modified:
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/ui/StatusDot.tsx
    - packages/frontend/src/styles/globals.css
decisions:
  - useAnimatedNumber uses x10 precision trick for SABnzbd speed (retains one decimal via integer math)
  - StatusDot gets prevStatusRef + pulsing state — LED over-pulse at component level so all StatusDot users get it for free
  - MediaStackRow has its own prevStatusRef for the custom inline LED (cannot use StatusDot for its compound getLedStyle logic)
  - Entrance stagger unified to 0.08s delay multiplier across NAS/NETWORK/MEDIA tiles and MediaStackRow
  - animPercentBlocked multiplied by 10 to retain sub-integer precision in the integer-returning hook
metrics:
  duration: "~15 min"
  completed: "2026-04-06T21:00:00Z"
  tasks: 2
  files: 7
requirements: [WTHR-01, WTHR-02]
---

# Phase 09 Plan 04: Weather Frontend Widget + Living/Breathing Animations Summary

**One-liner:** Animated SVG weather widget in AppHeader + metric count-up tweens, LED over-pulse on state transition, and unified 0.08s entrance stagger across all dashboard tiles.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | WeatherIcon component + AppHeader weather widget + SSE wiring | 44f19c1 | WeatherIcon.tsx, AppHeader.tsx, globals.css, App.tsx |
| 2 | Living/breathing animations — count-up, LED over-pulse, entrance stagger | d094f4f | useAnimatedNumber.ts, CardGrid.tsx, ServiceCard.tsx, StatusDot.tsx |

## What Was Built

### Task 1 (Prior commit 44f19c1)

**WeatherIcon.tsx** — 7 animated inline SVG icons (sun, partlyCloudy, overcast, fog, rain, snow, storm) using CSS `@keyframes` on `transform`/`opacity` only. Amber/warm cockpit palette. WMO code mapping covers all codes including edge cases.

**AppHeader.tsx** — Weather widget in right column: `[WeatherIcon | temperature°]` slot renders when `weatherData` is non-null. Hides cleanly when weather is unconfigured. `isWeatherStale()` detects age > 20 minutes (15-min poll + 5-min grace).

**globals.css** — Added all 7 weather `@keyframes` (weatherSunRotate, weatherCloudDrift, weatherBreathe, weatherRainDrop, weatherSnowDrift, weatherBoltFlash, weatherFogFade) and `@keyframes ledOverPulse`.

### Task 2 (Commit d094f4f)

**useAnimatedNumber.ts** — Ease-out cubic tween hook (400ms duration, <0.5 delta guard). Used for: NAS CPU%, NAS RAM%, Docker CPU%, Docker RAM%, Pi-hole QPM, Pi-hole block%, Pi-hole mem%, UniFi client count, SABnzbd speed (via x10 precision trick).

**StatusDot.tsx** — Upgraded to track `prevStatusRef` + `pulsing` state. On any status transition, the `ledOverPulse 0.6s ease-out` keyframe fires before returning to steady-state animation (`ledBreathe`, `ledPulseWarn`, `ledFlashDown`).

**CardGrid.tsx** — Media tile (`<div>`) converted to `<motion.div>` with `initial={{ opacity: 0, y: 10 }}` entrance; SABnzbd speed display uses `animSpeedTimes10`.

**ServiceCard.tsx** — MediaStackRow has custom LED over-pulse (cannot share StatusDot due to compound `getLedStyle()` logic). Stagger timing unified: all motion.div transitions use `index * 0.08` delay multiplier (previously mix of 0.04 and 0.05).

## Verification

All acceptance criteria met:

- `useAnimatedNumber` hook exists with ease-out easing, 400ms duration, <0.5 delta guard
- 7+ numeric displays use `useAnimatedNumber` (CPU%, RAM%, Docker%, QPM, blocked%, mem%, clients, speed)
- AppHeader passes `weatherData` prop from `snapshot.weather`; WeatherIcon renders per WMO code
- `@keyframes ledOverPulse` in globals.css (line 265)
- StatusDot applies ledOverPulse on status transition via `pulsing` state
- MediaStackRow applies ledOverPulse on status transition via `ledPulsing` state
- CardGrid Media tile is `motion.div` with `delay: globalIndex * 0.08`
- All entrance animations use `0.08` delay multiplier across all tiles
- No layout-triggering properties in new animations (transform + opacity + box-shadow only)
- `npm run test --workspace=packages/frontend -- --run` exits 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StatusDot lacked over-pulse tracking — fixed at component level**
- **Found during:** Task 2
- **Issue:** The plan described adding over-pulse to `ServiceCard.tsx`, but `StatusDot` (used by NAS ribbon, NETWORK ribbon, and general service cards) had no state tracking
- **Fix:** Added `prevStatusRef`, `pulsing` state, and `onAnimationEnd` handler directly to `StatusDot` — all StatusDot consumers get over-pulse for free without per-card changes
- **Files modified:** packages/frontend/src/components/ui/StatusDot.tsx
- **Commit:** d094f4f

**2. [Auto-observation] MediaStackRow stagger was 0.04 (plan target: 0.08) — unified**
- **Found during:** Task 2
- **Issue:** MediaStackRow used `index * 0.04`; NAS tile and general ServiceCard used `0.05`
- **Fix:** All entrance animations now use `index * 0.08`
- **Files modified:** packages/frontend/src/components/cards/ServiceCard.tsx
- **Commit:** d094f4f

## Task 3: Checkpoint Pending

Task 3 is a `checkpoint:human-verify` — awaiting user visual approval of all Phase 9 changes.

## Known Stubs

None — all data paths are wired. Weather widget renders nothing when `weatherData` is null (not a stub; intentional null-safe render).

## Self-Check: PASSED

- useAnimatedNumber.ts: FOUND (confirmed readable)
- WeatherIcon.tsx: pre-existing from Task 1 commit 44f19c1
- 09-04-SUMMARY.md: FOUND (this file)
- Commits 44f19c1 and d094f4f: confirmed in git log (both ahead of origin/main)
