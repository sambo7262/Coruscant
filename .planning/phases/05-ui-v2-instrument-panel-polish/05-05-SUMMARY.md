---
plan: 05-05
phase: 05-ui-v2-instrument-panel-polish
status: awaiting-checkpoint
completed: 2026-04-05
subsystem: frontend-layout
tags: [ui, layout, viewport, kiosk, no-scroll, dash-01, dash-02, dash-03]
dependency-graph:
  requires: [05-02, 05-03, 05-04]
  provides: [800x480-no-scroll-layout, kiosk-viewport-budget]
  affects: [App.tsx, DashboardPage.tsx, globals.css]
tech-stack:
  added: []
  patterns:
    - "overflow: hidden on main element for kiosk no-scroll enforcement"
    - "CSS media query (max-height: 480px) for body-level scroll lock"
    - "128px paddingTop matches always-visible NAS header height"
key-files:
  created: []
  modified:
    - packages/frontend/src/App.tsx
    - packages/frontend/src/pages/DashboardPage.tsx
    - packages/frontend/src/styles/globals.css
decisions:
  - "paddingTop set to 128px in App.tsx main — matches full always-visible NAS header (44px title + 51px disks + 18px docker + 15px image LED)"
  - "paddingBottom set to 40px — matches collapsed Plex rail height (Plan 04)"
  - "overflow: hidden on main enforces no-scroll at any viewport height"
  - "CSS @media(max-height:480px) body overflow:hidden adds kiosk-level body protection"
  - "DashboardPage scroll restoration removed — incompatible with overflow:hidden no-scroll layout"
  - "GridBackground (DASH-02) confirmed intact — renders outside main with position:fixed"
  - "Card border trace glow (DASH-03) confirmed intact — boxShadow not clipped by overflow:hidden on parent"
metrics:
  duration: ~2min
  completed: 2026-04-05T05:52:43Z
  tasks: 1
  files: 3
---

# Phase 05 Plan 05: 800x480 Viewport Budget Enforcement Summary

**One-liner:** Enforced 800x480 no-scroll constraint across the full dashboard — corrected paddingTop to 128px to clear the always-visible NAS header, reduced paddingBottom to 40px for the Plex rail, applied overflow:hidden to main and a kiosk body CSS guard.

## What Was Built

### Task 1: Audit and enforce 480px vertical budget across all dashboard components

**App.tsx `main` element:**
- Increased `paddingTop` from `88px` to `128px` — the always-visible NAS header added in Plan 03 expanded the header beyond the original 88px estimate (44px title + disk temp bars + Docker stats + image LED = ~128px)
- Reduced `paddingBottom` from `64px` to `40px` — matches confirmed Plex rail height from Plan 04
- Added `overflow: 'hidden'` to enforce no-scroll in the card grid area at all viewports
- Added `boxSizing: 'border-box'` for correct padding calculations

**globals.css body overflow protection:**
- Added `@media (max-height: 480px)` block: `overflow: hidden`, `height: 100vh`, `max-height: 480px` — prevents body scroll at exact kiosk viewport height
- Added `@media (min-height: 481px)` block: `max-height: none`, `overflow-x: hidden` — restores normal scroll on larger viewports (desktop, phones in portrait)

**DashboardPage.tsx:**
- Removed `useEffect` scroll restoration logic (`sessionStorage.getItem('dashboardScrollY')`, `window.scrollTo`) — this code was incompatible with the no-scroll layout and served no purpose once overflow:hidden is enforced
- Removed unused `useEffect` import

**Animated grid background (DASH-02) — INTACT:**
- `GridBackground` component renders outside `main` as a sibling in App.tsx fragment
- Uses `position: fixed; inset: 0; zIndex: 0` — completely unaffected by `main` overflow or padding changes
- `spaceFloat` and `nebulaBreath` CSS animations confirmed present in globals.css

**Card border trace glow (DASH-03) — INTACT:**
- `ServiceCard` uses `boxShadow: getCardGlow(status)` for status glow effect
- Framer Motion `motion.div` entrance animations (`opacity: 0 → 1`, `y: 12 → 0`) unchanged
- `overflow: hidden` on `main` does not clip box-shadow (box-shadow is a painting effect outside geometric overflow)
- No `@keyframes borderTrace` exists in the codebase — the "border trace" is implemented via status-colored box-shadow and the chamfer clip-path; both confirmed intact

**Pixel budget achieved:**
```
Viewport:            480px
AppHeader (fixed):  ~128px (44px + 32px disks + 18px docker + 14px image LED)
NowPlayingBanner:    40px  (collapsed rail, confirmed Plan 04)
main paddingTop:    128px
main paddingBottom:  40px
CardGrid area:      ~312px (480 - 128 - 40)
```

## Deviations from Plan

### Scope adjustment

**Plan specified modifying `DashboardPage.tsx` to add a `<main>` wrapper.** The `<main>` element already exists in `App.tsx` and wraps all page routes. Adding a second `<main>` in DashboardPage would create nested `<main>` elements (invalid HTML). Applied the padding/overflow changes to the existing `main` in App.tsx instead.

## Known Stubs

None — all layout changes are structural. No data stubs introduced.

## Awaiting

**Task 2 (checkpoint:human-verify):** Visual verification of complete Phase 5 dashboard at 800x480 by user in Chrome DevTools.

## Self-Check: PASSED

- `packages/frontend/src/App.tsx` — FOUND, paddingTop updated
- `packages/frontend/src/pages/DashboardPage.tsx` — FOUND, scroll restoration removed
- `packages/frontend/src/styles/globals.css` — FOUND, kiosk media query added
- Commit `b6db4d0` — FOUND in git log
- Build: passed (tsc --build tsconfig.build.json)
- Tests: 86/86 passed
