---
phase: 16-iphone-landscape
plan: "01"
subsystem: frontend/css
tags: [responsive, iphone, landscape, css, viewport, testing]
dependency_graph:
  requires:
    - 15-01  # portrait CSS foundation (shared selector contract, env() pattern)
    - 14-06  # CI lint enforcement (verify-viewport-isolation.mjs)
  provides:
    - landscape CSS token overrides under html[data-viewport="iphone-landscape"]
    - D-08 boundary regression tests proving kiosk/landscape separation
  affects:
    - packages/frontend/src/styles/viewport-iphone.css
    - packages/frontend/src/viewport/detect.test.ts
tech_stack:
  added: []
  patterns:
    - CSS attribute selector scoping (exact = match for orientation-specific overrides)
    - env(safe-area-inset-left/right) wrapped in max() for Dynamic Island lateral clearance
    - Per-orientation fixed-height release (max-height: none / height: auto must be repeated for each orientation independently)
key_files:
  created: []
  modified:
    - packages/frontend/src/styles/viewport-iphone.css
    - packages/frontend/src/viewport/detect.test.ts
decisions:
  - Landscape banner uses fixed height: 40px (CSS-controlled) — Framer Motion collapsedHeight (48px kiosk) is only the y-axis slide animation offset, not visible height; no JS changes needed
  - No grid-template-columns in landscape block — 2-col layout is the kiosk default already; portrait's 1fr override is scoped under iphone-portrait exact selector and does not bleed
  - No flex-wrap in landscape banner — that is portrait-only for 2-row reflow; landscape is 1-row compact
metrics:
  duration_minutes: 7
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  files_created: 0
---

# Phase 16 Plan 01: iPhone Landscape CSS Overrides + D-08 Boundary Regression Summary

**One-liner:** Landscape CSS token compression with Dynamic Island lateral clearance and explicit D-08 vitest proof that CoruscantKiosk UA always wins over landscape matchMedia.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Landscape CSS token overrides + Dynamic Island clearance + typography + banner compression | 7fc7b0e | packages/frontend/src/styles/viewport-iphone.css |
| 2 | D-08 vitest boundary regression test for landscape vs kiosk detection | 1294d00 | packages/frontend/src/viewport/detect.test.ts |

## What Was Built

### Task 1: Landscape CSS Section (viewport-iphone.css)

Replaced the two-line placeholder with a full landscape section (55 lines, 22 selectors) under `html[data-viewport="iphone-landscape"]`:

**Token override block:** `--tile-padding: 8px`, `--tile-gap: 4px`, `--tile-font-label: 11px`, `--tile-font-value: 17px`, `--led-size: 7px` — tighter than portrait, sized for 2-column landscape grid without vertical scroll.

**Per-orientation tile height releases:** `.media-tile { max-height: none }` and `.service-card--pihole { height: auto }` — required independently from the portrait releases (which are scoped under a different exact selector).

**Dynamic Island lateral clearance:**
- `.app-header`: `padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right)` — flush clearance for Dynamic Island housing
- `.card-grid`: `padding-left/right: max(var(--tile-padding), env(safe-area-inset-left/right))` — minimum tile padding preserved when safe-area is zero

**Banner compression:** `.now-playing-banner` and `.now-playing-banner--idle` → `height: 40px; min-height: 40px; padding: 0 max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left))` — 1-row compact, no flex-wrap.

**Typography scale (13 selectors):** ~80-90% of portrait values. `.app-header__title: 15px`, `.text-display: 15px`, `.text-body: 13px`, `.ribbon-label: 11px`, `.now-playing-banner__stat: 11px`, etc.

### Task 2: D-08 Boundary Regression Tests (detect.test.ts)

Added `describe('detectViewport -- landscape boundary regression (D-08)')` block with 2 test cases:

1. **932x430 DPR>=2 → iphone-landscape:** Sets landscape matchMedia query to `true`, verifies `detectViewport()` returns `'iphone-landscape'`. Query string copied verbatim from `detect.ts` line 13 to ensure mock key matches exactly.

2. **CoruscantKiosk UA → kiosk (hard separation):** Sets full kiosk UA string + landscape matchMedia to `true`, verifies `detectViewport()` returns `'kiosk'`. Proves D-08's core guarantee: UA check (step 2 in precedence) fires before matchMedia (step 3), so kiosk is never misidentified as iphone-landscape.

## Verification Results

All CI gates passed:

| Gate | Result |
|------|--------|
| `node scripts/verify-viewport-isolation.mjs` | PASS — all selectors scoped to `html[data-viewport^="iphone"]` |
| `npx vitest run` | PASS — 24/24 tests (22 pre-existing + 2 new D-08) |
| `npx vite build` | PASS — built in 656ms |

## Acceptance Criteria Check

| Criterion | Status |
|-----------|--------|
| `html[data-viewport="iphone-landscape"]` selectors (>=10) | PASS — 22 selectors |
| `--tile-padding: 8px` under landscape | PASS |
| `--tile-gap: 4px` under landscape | PASS |
| `--tile-font-value: 17px` under landscape | PASS |
| `--led-size: 7px` under landscape | PASS |
| `env(safe-area-inset-left)` in landscape | PASS |
| `env(safe-area-inset-right)` in landscape | PASS |
| `.now-playing-banner` with `height: 40px` | PASS |
| No `grid-template-columns` in landscape section | PASS |
| No `flex-wrap` in landscape section | PASS |
| No `!important` anywhere in file | PASS |
| No `@media` anywhere in file | PASS |
| D-08 describe block present | PASS |
| `expect(detectViewport()).toBe('iphone-landscape')` in D-08 | PASS |
| `expect(detectViewport()).toBe('kiosk')` with CoruscantKiosk UA | PASS |
| Verbatim landscape query string in both D-08 tests | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

The landscape CSS block introduces no new network endpoints, auth paths, or file access patterns. The only security-relevant concern is selector scope leakage (T-16-01), which is enforced by `verify-viewport-isolation.mjs` — the lint passed. No new threat flags.

## Self-Check: PASSED

- `packages/frontend/src/styles/viewport-iphone.css` — exists and contains landscape section
- `packages/frontend/src/viewport/detect.test.ts` — exists and contains D-08 describe block
- Commit `7fc7b0e` — present in git log
- Commit `1294d00` — present in git log
