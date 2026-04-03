---
phase: 02-core-ui-shell
plan: "06"
subsystem: frontend-styles
tags: [css, design-system, star-wars, cockpit, svg, animation]
depends_on:
  requires: []
  provides: [cockpit-design-system, wiring-overlay]
  affects: [all-frontend-components]
tech-stack:
  added: []
  patterns: [css-custom-properties, svg-overlay, led-keyframes, crt-scanline]
key-files:
  created:
    - packages/frontend/src/components/layout/WiringOverlay.tsx
  modified:
    - packages/frontend/src/styles/globals.css
    - packages/frontend/src/App.tsx
decisions:
  - "LED animations use separate keyframes (ledBreathe/ledPulseWarn/ledFlashDown) per health state, not a single parameterized animation"
  - "CRT scanline rendered via body::after pseudo-element (not a React component) — zero JS overhead"
  - "WiringOverlay uses preserveAspectRatio=none so paths stretch to fill any viewport without layout coupling"
metrics:
  duration: "2m33s"
  completed: "2026-04-03"
  tasks: 2
  files: 3
requirements: [DASH-02, DASH-05, DASH-08]
---

# Phase 02 Plan 06: Star Wars Cockpit Design System + Wiring Overlay Summary

**One-liner:** Star Wars cockpit CSS design system (amber/green/red on near-black) with LED keyframes, CRT scanline overlay, chamfer utility, and static SVG wiring trace component replacing all Tron aesthetic values.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Replace Tron CSS design system with Star Wars cockpit palette | `88083b7` | packages/frontend/src/styles/globals.css |
| 2 | Create decorative SVG wiring overlay and wire into App.tsx | `7776274` | packages/frontend/src/components/layout/WiringOverlay.tsx |

## What Was Built

### Task 1 — globals.css rewrite

Completely replaced the Tron design system with the Star Wars X-Wing cockpit palette:

- **Palette tokens:** `--cockpit-amber: #E8A020`, `--cockpit-green: #4ADE80`, `--cockpit-red: #FF3B3B`, `--cockpit-grey: #666666`
- **Surface tokens:** `--bg-panel: #0D0D0D`, `--bg-seam: #1A1A1A`
- **Text token:** `--text-offwhite: #C8C8C8`
- **Border tokens:** `--border-rest: rgba(232, 160, 32, 0.20)`, `--border-hover: rgba(232, 160, 32, 0.60)`
- **Section label:** `--section-label: #E8A020`
- **LED keyframes:** `ledBreathe` (3s), `ledPulseWarn` (1s), `ledFlashDown` (0.4s)
- **CRT scanline overlay:** `body::after` repeating-linear-gradient at 2px pitch, 15% darkness
- **Chamfer utility:** `.chamfer-card` with `clip-path: polygon(...)` cutting 8px corners
- **Typography:** font-weight fixed to 600 max (was 700); no italic
- **Removed:** all Tron vars, gridPulse keyframes, borderTrace keyframe, `@property --angle`, breathe/pulseAmber/flashRed keyframes

### Task 2 — WiringOverlay component

Created `WiringOverlay.tsx` with 8 static SVG `<path>` elements representing bundled cable runs and PCB traces:
- Fixed position, inset 0, z-index 0, pointer-events: none, aria-hidden
- viewBox `0 0 800 480` matching primary Raspberry Pi 800x480 kiosk display
- `preserveAspectRatio="none"` stretches to fill any viewport
- 5 thin traces at `stroke: rgba(232, 160, 32, 0.08)`, strokeWidth 1.5
- 3 thick bundles at `stroke: rgba(232, 160, 32, 0.05)`, strokeWidth 2.5
- Paths use M/L/Q commands for geometric routing with rounded corners

App.tsx: WiringOverlay imported and rendered immediately after GridBackground (already present from plan 02-07 execution, confirmed correct state).

## Deviations from Plan

### Note — App.tsx already wired

**Found during:** Task 2
**Issue:** App.tsx already contained the WiringOverlay import and JSX from the 02-07 plan executor which ran in parallel. The file diff was empty on commit.
**Resolution:** No action required — the final state is correct. WiringOverlay renders after GridBackground as specified.
**Rule:** Not a deviation — parallel agent had already applied the matching integration.

No other deviations. Plan executed exactly as written.

## Known Stubs

None. This plan delivers CSS custom properties and a static SVG overlay — no data-dependent rendering.

## Self-Check: PASSED

- [x] `packages/frontend/src/styles/globals.css` — exists, verified
- [x] `packages/frontend/src/components/layout/WiringOverlay.tsx` — exists, verified
- [x] `packages/frontend/src/App.tsx` — contains WiringOverlay import and JSX, verified
- [x] Commit `88083b7` — exists
- [x] Commit `7776274` — exists
- [x] Zero "tron" references in globals.css — verified (grep returns 0)
- [x] All cockpit palette vars present — verified
- [x] All LED keyframes present — verified
- [x] CRT scanline (body::after) present — verified
- [x] chamfer-card utility present — verified
- [x] No font-weight 700 — verified
- [x] No borderTrace/gridPulse/@property --angle — verified
