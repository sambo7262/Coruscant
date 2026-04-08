---
phase: 13-title-bar-alerts-detail-view
plan: 01
subsystem: frontend-ui
tags: [pi-health, title-bar, alerts, detail-panel]
dependency_graph:
  requires: [12-01]
  provides: [pi-health-title-alerts, pi-health-panel]
  affects: [AppHeader, App.tsx]
tech_stack:
  added: []
  patterns: [severity-driven-styling, dot-leader-readout, framer-motion-expand-collapse]
key_files:
  created:
    - packages/frontend/src/components/layout/PiHealthPanel.tsx
  modified:
    - packages/frontend/src/App.tsx
    - packages/frontend/src/components/layout/AppHeader.tsx
decisions:
  - "D-01: Brighter amber #FFD060 for warning severity (distinct from default #E8A020)"
  - "D-02: Stale threshold set to 60s (2x the 30s default poll interval)"
  - "D-03: Panel uses fixed positioning at top:44px below header with z-index:9"
metrics:
  duration: 5m
  completed: "2026-04-08T03:13:18Z"
---

# Phase 13 Plan 01: Title Bar Alerts and Pi Health Detail View Summary

Severity-driven CORUSCANT title styling (amber/brighter-amber/red+flash) with tap-to-expand inline Pi health panel showing 6 dot-leader metric rows.

## What Was Done

### Task 1: Wire piHealth into AppHeader with severity-driven title styling (e125c3f)

- Passed `piHealth` from SSE snapshot through App.tsx to AppHeader
- Added `SEVERITY_TITLE_STYLES` mapping: normal (default amber), warning (brighter amber #FFD060 + pulse), critical (red + flash), stale (default amber)
- Applied severity color and animation to CORUSCANT title text on all pages
- Converted home-page title to accessible `<button>` with `panelOpen` toggle state
- Sub-page back-nav Link to "/" preserved unchanged with severity coloring
- Added AnimatePresence wrapper for PiHealthPanel conditional render

### Task 2: Create PiHealthPanel with 6 dot-leader metric rows (52fc8e5)

- Created PiHealthPanel component with Framer Motion expand/collapse animation
- Renders exactly 6 metric rows: CPU TEMP, CPU%, MEMORY, THROTTLE, WIFI, NAS PING
- Dot-leader readout style: amber labels, dotted border connector, offwhite values
- Stale detection at 60s threshold dims all values to 0.4 opacity
- "Last seen: Xm ago" banner displays when data is stale or missing
- Panel positioned fixed below header (top: 44px, z-index: 9)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- All acceptance criteria grep patterns confirmed matching
- TypeScript compilation: PiHealthStatus import pattern matches existing codebase conventions; only pre-existing errors remain (WeatherData.timezone, globals.css module) which are unrelated to this plan
- 6 MetricRow instances rendered (confirmed via grep count)

## Self-Check: PASSED

- [x] packages/frontend/src/components/layout/PiHealthPanel.tsx exists (created)
- [x] packages/frontend/src/components/layout/AppHeader.tsx modified with severity styles
- [x] packages/frontend/src/App.tsx modified with piHealth prop
- [x] Commit e125c3f exists (Task 1)
- [x] Commit 52fc8e5 exists (Task 2)
