---
phase: 02-core-ui-shell
plan: 13
subsystem: frontend-ui
tags: [background, animation, burn-in, deep-space, color-tokens, kiosk]
dependency_graph:
  requires: []
  provides: [deep-space-bg-palette, drift-animation, nebula-glow]
  affects: [GridBackground, globals.css]
tech_stack:
  added: []
  patterns: [CSS custom properties, GPU-composited keyframe animation, repeating-linear-gradient two-tone grid]
key_files:
  created: []
  modified:
    - packages/frontend/src/styles/globals.css
    - packages/frontend/src/components/layout/GridBackground.tsx
decisions:
  - "Deep-space blue tokens kept at low opacity (0.06–0.15) so amber remains dominant structural color"
  - "GridBackground restructured to two-div layout: grid-bg-layer (drifting seams) + grid-nebula-layer (static radial glow)"
  - "spaceFloat uses translate() only — GPU composited, zero layout/paint cost"
  - "nebulaBreath opacity oscillates 0.6–1.0 — barely perceptible intensity shift"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-03T17:17:46Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 02 Plan 13: Deep-Space Background Palette and Drift Animation Summary

Deep-space blue-grey color tokens added to globals.css and applied to GridBackground with two-tone seam grid, faint nebula radial glow, slow 90s drift animation, and 120s nebula opacity breath for OLED/LCD burn-in prevention.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Add deep-space blue-grey to background palette | Done | 6055784 |
| 2 | Add slow drift animation for burn-in prevention | Done | 6055784 |

Note: Both tasks modified the same two files atomically — the GridBackground rewrite required both the palette tokens and the drift animations to be coherent. Single commit covers both deliverables.

## What Was Built

### New CSS Tokens (globals.css)

Four new deep-space blue-grey tokens added to `:root`:

- `--space-deep: #080C14` — Very dark blue-black, replaces `#0A0A0A` for `html` background
- `--space-mid: #0E1520` — Dark blue-grey for panel slot backgrounds (future use)
- `--space-nebula: rgba(30, 60, 120, 0.12)` — Faint blue glow reference token
- `--bg-seam-cold: rgba(60, 100, 180, 0.08)` — Blue-tinted seam lines reference token

### GridBackground Restructure

GridBackground now uses two child divs instead of a flat single div:

1. **`grid-bg-layer`** — Background div carrying the seam grid via `repeating-linear-gradient`:
   - Amber vertical seams every 120px at `rgba(232,160,32,0.15)` — structural chrome
   - Blue atmosphere seams every 60px at `rgba(60,100,180,0.06)` — subtle space depth
   - Amber horizontal seams every 200px at `rgba(232,160,32,0.15)`
   - Blue atmosphere seams every 100px at `rgba(60,100,180,0.06)`
   - Applies `spaceFloat 90s ease-in-out infinite` with `will-change: transform`

2. **`grid-nebula-layer`** — Overlay div with radial gradient:
   - `radial-gradient(ellipse at 30% 60%, rgba(20,40,100,0.15) 0%, transparent 60%)`
   - Applies `nebulaBreath 120s ease-in-out infinite` opacity oscillation

### Keyframe Animations (globals.css)

```css
@keyframes spaceFloat {
  0%   { transform: translate(0px, 0px); }
  25%  { transform: translate(2px, -1px); }
  50%  { transform: translate(1px, 2px); }
  75%  { transform: translate(-2px, 1px); }
  100% { transform: translate(0px, 0px); }
}

@keyframes nebulaBreath {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1.0; }
}
```

- `spaceFloat`: ±3px max drift over 90 seconds — below conscious perception at kiosk distance
- `nebulaBreath`: 0.6→1.0 opacity over 120 seconds — like the cockpit passing through a faint nebula
- `prefers-reduced-motion` media query already present in globals.css stops both animations on accessibility request

## Verification

- Background base is `#080C14` (deep blue-black) — not pure black
- Amber seam lines remain at 0.15 opacity; blue at 0.06 — amber stays dominant
- Nebula radial glow at 0.15 max opacity — barely visible atmospheric depth
- All animations use `transform`/`opacity` only — GPU composited, zero layout/paint overhead
- `prefers-reduced-motion: reduce` collapses both animations to single instant frame

## Deviations from Plan

None — plan executed exactly as written.

The plan specified adding `::before` pseudo-element for the nebula glow. Implementation used a separate child `<div>` instead, which is equivalent in rendering behavior and more explicit in React's inline-style approach. No CSS class would be needed for a `::before` without a stylesheet rule, and the inline-style pattern is consistent with the existing GridBackground implementation.

## Known Stubs

None. Both tokens (`--space-mid`, `--bg-seam-cold`) are available but not yet applied to card panels — they are palette references, not wired stubs. Future plans can use them for panel backgrounds without modification.

## Self-Check: PASSED

- FOUND: packages/frontend/src/styles/globals.css
- FOUND: packages/frontend/src/components/layout/GridBackground.tsx
- FOUND: commit 6055784
