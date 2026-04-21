---
phase: 16-iphone-landscape
plan: "02"
subsystem: frontend/css
tags: [responsive, iphone, landscape, ci, smoke-test, verification]
dependency_graph:
  requires:
    - 16-01  # landscape CSS overrides + D-08 boundary tests
  provides:
    - D-10 automated gate closure (lint + vitest + build)
    - Phase 16 close gate pending real-device smoke test
  affects: []
tech_stack:
  added: []
  patterns:
    - Automated CI gate: isolation lint + vitest + vite build
    - Real-device smoke test gate per D-09, D-11
key_files:
  created: []
  modified: []
decisions:
  - Task 1 (automated CI) passed all three gates with no code changes required
  - Task 2 (real iPhone 15 smoke test) is a blocking human-verify checkpoint — cannot be auto-approved
metrics:
  duration_minutes: 3
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  smoke_test_result: "FAILED — 4 layout issues"
  files_modified: 0
  files_created: 0
---

# Phase 16 Plan 02: Phase Close Gate — Automated CI + iPhone Smoke Test Summary

**One-liner:** Automated CI gate (lint, vitest 24/24, build) passed; blocked at real iPhone 15 smoke test checkpoint pending user verification.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | D-10 automated CI gate (isolation lint + vitest + vite build) | 9c98ddb | (no file changes — verification only) |

## Task 2: Smoke Test — ISSUES FOUND

Real iPhone 15 landscape smoke test performed. Automated gates all passed but 4 layout issues found on real device:

1. **Media tile layout**: 2-col × 3-row is too tall — needs 3-col × 2-row horizontal layout + reduced internal padding
2. **Now Playing banner**: Too tall for landscape — needs ~50% height reduction from current size
3. **Network/UniFi tile**: Arc bar SVGs consume too much vertical space — show numbers only in one line under status, drop arc bars
4. **Pi-hole tile**: Too many metrics for landscape — show only blocked % and QPS side by side

**Result:** FAILED — gap-closure plans needed for landscape-specific component adaptations

## What Was Built

### Task 1: Automated CI Gate (D-10)

All three automated checks ran in sequence with zero failures:

| Gate | Result | Details |
|------|--------|---------|
| `node scripts/verify-viewport-isolation.mjs` | PASS | All selectors scoped to `html[data-viewport^="iphone"]` |
| `npx vitest run --reporter=verbose` | PASS | 24/24 tests (4 files), including D-08 landscape boundary regression tests |
| `npx vite build` | PASS | Built in 628ms, CSS 26.45kB / JS 731.71kB |

The D-08 boundary tests confirmed:
- iPhone 15 landscape matchMedia (932x430 DPR>=2) correctly returns `iphone-landscape`
- CoruscantKiosk UA wins over landscape matchMedia (kiosk UA check fires first in precedence)

## Deviations from Plan

None — Task 1 executed exactly as written. No code fixes required.

## Threat Surface Scan

No new code was written in this plan. This is a verification-only plan. T-16-03 (kiosk CSS bleed regression) is addressed in the smoke test checkpoint (Task 2) with kiosk visual comparison at 800x480.

## Known Stubs

None.

## Self-Check: FAILED

- All three CI gates exited 0
- Commit `9c98ddb` — present in git log
- Task 2 correctly returns as checkpoint (not skipped or auto-approved)
