---
phase: 16-iphone-landscape
plan: "03"
subsystem: frontend/viewport
tags: [css, landscape, iphone, gap-closure, network-card, media-tile, banner]
dependency_graph:
  requires: [16-01]
  provides: [landscape-gap-closure]
  affects: [viewport-iphone.css, ServiceCard.tsx, NowPlayingBanner.tsx]
tech_stack:
  added: []
  patterns: [css-attribute-scoping, useViewport-hook, conditional-jsx-rendering]
key_files:
  modified:
    - packages/frontend/src/styles/viewport-iphone.css
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
decisions:
  - "UniFi arcs replaced with compact-stats div in landscape — SVG arc height was the biggest vertical offender in the network card"
  - "Pi-hole hides BLOCKED% and MEM% in landscape — BLOCKING status + QPS is sufficient at a glance"
  - "media-tile__col: display contents collapses column wrappers so 6 rows participate directly in 3-column parent grid"
  - "Banner 24px in landscape matches collapsedHeight JS value to CSS height — Framer Motion exit animation stays consistent"
metrics:
  duration_minutes: 8
  completed_date: 2026-04-21
  tasks_completed: 1
  files_modified: 3
---

# Phase 16 Plan 03: Landscape Gap Closure Summary

**One-liner:** 4 targeted layout fixes — media 3-across grid, banner 50% shorter, UniFi numbers-only, Pi-hole compact — to achieve zero vertical scroll on iPhone 15 landscape.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 16-03-01 | Landscape gap closure — 4 component fixes | 4c1a1ea | viewport-iphone.css, ServiceCard.tsx, NowPlayingBanner.tsx |

## What Was Built

### Fix 1: Media tile 3-across (CSS)
Added `html[data-viewport="iphone-landscape"] .media-tile__cols` with `grid-template-columns: repeat(3, 1fr)` and `.media-tile__col` with `display: contents`. The `display: contents` trick collapses the column wrapper divs so all 6 `MediaStackRow` children participate directly in the 3-column parent grid, producing a 3-across × 2-row layout instead of the previous 2-across × 3-row. Header height reduced to 16px, padding-bottom to 2px.

### Fix 2: NowPlayingBanner 24px height (CSS + JS)
- CSS: landscape banner rules updated from `height: 40px` to `height: 24px` / `min-height: 24px`
- CSS: banner font sizes reduced to 9px (stat) and 10px (label/title/message)
- JS: `collapsedHeight` in NowPlayingBanner updated from `isPortrait ? 56 : 48` to `isPortrait ? 56 : isLandscape ? 24 : 48` so Framer Motion's exit animation uses the correct pixel offset

### Fix 3: UniFi numbers-only in landscape (JS + CSS)
- Added `useViewport` import to ServiceCard.tsx (from existing `../../viewport/index.js` re-export)
- Added `const viewport = useViewport()` and `const isLandscape = viewport === 'iphone-landscape'` at top of `NetworkInstrument` function (unconditional — satisfies React hook ordering rule)
- Wrapped the existing `<div className="net-instrument__arcs">` block in an `isLandscape` ternary; landscape shows `<div className="net-instrument__compact-stats">` with DOWN/UP/CLIENTS as plain text spans
- CSS: `.net-instrument__compact-stats` flex row with `align-items: baseline`, `gap: 4px`, `flex-wrap: wrap`, `justify-content: center`

### Fix 4: Pi-hole compact in landscape (JS + CSS)
- Wrapped `hasPercentData && (...)` BLOCKED% section in `{!isLandscape && hasPercentData && (...)}` 
- Wrapped MEM% section in `{!isLandscape && (...)}` 
- Landscape Pi-hole column shows: BLOCKING status label + QPS value only
- CSS: `.net-instrument__col` gap reduced to 2px in landscape

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. All new CSS rules are scoped under `html[data-viewport="iphone-landscape"]` exact-match selector. CI lint (`verify-viewport-isolation.mjs`) confirmed clean.

## Verification Results

- `node scripts/verify-viewport-isolation.mjs` — PASSED: all selectors scoped to `html[data-viewport^="iphone"]`
- `npx vitest run` — PASSED: 24/24 tests pass across 4 test files
- `npx vite build` — PASSED: 2709 modules transformed, clean build in 693ms

## Self-Check: PASSED

- `/packages/frontend/src/styles/viewport-iphone.css` — modified, contains `net-instrument__compact-stats`, `media-tile__cols`, `24px` banner height
- `/packages/frontend/src/components/cards/ServiceCard.tsx` — modified, contains `useViewport` import, `isLandscape` variable, `net-instrument__compact-stats` div, `!isLandscape` guards on BLOCKED% and MEM%
- `/packages/frontend/src/components/layout/NowPlayingBanner.tsx` — modified, contains `isLandscape ? 24 : 48`
- Commit `4c1a1ea` exists in git log
