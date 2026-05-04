---
phase: 20-performance-optimization
plan: "02"
subsystem: frontend
tags: [performance, memoization, react, timeline]
dependency_graph:
  requires: []
  provides: [PERF-03]
  affects:
    - packages/frontend/src/components/timeline/SparklineCard.tsx
    - packages/frontend/src/pages/TimelinePage.tsx
tech_stack:
  added: []
  patterns:
    - React.memo for component memoization
    - useMemo for stable derived array references
key_files:
  created:
    - packages/frontend/src/components/timeline/SparklineCard.memo.test.tsx
  modified:
    - packages/frontend/src/components/timeline/SparklineCard.tsx
    - packages/frontend/src/pages/TimelinePage.tsx
    - vitest.config.ts
    - packages/frontend/src/components/cards/ServiceCard.test.tsx
decisions:
  - "PI_HEALTH_METRICS moved to module scope for stable reference (avoids re-creation each render)"
  - "piHealthPointsF cpuTempF fallback changed from undefined to 0 for type correctness"
  - "@vitest-environment jsdom docblock used per-file so root vitest config can discover .tsx tests without overriding global node environment"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-03"
  tasks_completed: 2
  files_changed: 5
---

# Phase 20 Plan 02: SparklineCard Memo + TimelinePage useMemo Summary

**One-liner:** React.memo on SparklineCard with named inner function + useMemo on all five derived arrays in TimelinePage to eliminate unnecessary chart re-renders on parent state changes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | React.memo on SparklineCard + useMemo in TimelinePage | d2bb6fb | SparklineCard.tsx, TimelinePage.tsx |
| 2 | Vitest config update + SparklineCard memo test | b135092 | vitest.config.ts, SparklineCard.memo.test.tsx, ServiceCard.test.tsx |

## What Was Built

### SparklineCard.tsx
- Renamed `export function SparklineCard` to `function SparklineCardInner` (named inner function for React DevTools readability)
- Added `import React, { useState }` to bring `React.memo` into scope
- Added `export const SparklineCard = React.memo(SparklineCardInner)` after the closing brace
- `MetricConfig` interface export unchanged

### TimelinePage.tsx
- Added `useMemo` to the import on line 1
- Wrapped all five derived arrays: `diskMetrics`, `nasMetrics`, `nasPointsWithDiskF`, `diskTempMetrics`, `piHealthPointsF`
- Moved `PI_HEALTH_METRICS` from inline component body to module scope (stable reference, no re-creation each render)
- Correct dependency arrays: `nasPoints` for four of the arrays, `piHealthPoints` for piHealthPointsF, `diskMetrics` for nasMetrics

### Test Infrastructure
- Created `SparklineCard.memo.test.tsx` with three tests:
  1. Verifies `React.memo` wrapping via `$$typeof` and `type.name === 'SparklineCardInner'`
  2. Verifies props change still triggers re-render (loading state toggle)
  3. Compile-time check that `MetricConfig` is still exported
- Updated root `vitest.config.ts` include to discover `.test.tsx` files
- Added `@vitest-environment jsdom` docblock to both `.test.tsx` files so they run with DOM available under the node-environment root config

## Verification Results

- `npx tsc --noEmit -p packages/frontend/tsconfig.json` — no new errors (pre-existing errors in ServiceCard.tsx and DockerUpdatePanel.tsx are unrelated to this plan)
- `npm test` — 23 test files, 198 tests, all passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed piHealthPointsF cpuTempF undefined type error**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `piHealthPointsF` mapped `cpuTempF` to `undefined` as fallback, but `SparklineCardProps.points` requires `Array<Record<string, number | string>>` — `undefined` is not assignable
- **Fix:** Changed fallback from `undefined` to `0` (consistent with disk temp conversion pattern)
- **Files modified:** `packages/frontend/src/pages/TimelinePage.tsx`
- **Commit:** d2bb6fb

**2. [Rule 3 - Blocking] Added @vitest-environment jsdom to ServiceCard.test.tsx**
- **Found during:** Task 2 test run
- **Issue:** Root vitest config now discovers `ServiceCard.test.tsx` via the new `.test.tsx` include pattern, but root config uses `environment: 'node'` — `document is not defined` caused 2 test failures
- **Fix:** Added `// @vitest-environment jsdom` docblock to ServiceCard.test.tsx (same fix applied to new SparklineCard.memo.test.tsx)
- **Files modified:** `packages/frontend/src/components/cards/ServiceCard.test.tsx`
- **Commit:** b135092

## Known Stubs

None — this plan contains only performance optimizations with no data rendering stubs.

## Threat Flags

None — React.memo and useMemo are pure rendering optimizations with no security surface.

## Self-Check: PASSED

- [x] `packages/frontend/src/components/timeline/SparklineCard.tsx` — exists, contains `React.memo(SparklineCardInner)`
- [x] `packages/frontend/src/pages/TimelinePage.tsx` — exists, contains 5 useMemo calls
- [x] `packages/frontend/src/components/timeline/SparklineCard.memo.test.tsx` — exists
- [x] Commit d2bb6fb — exists
- [x] Commit b135092 — exists
- [x] All 198 tests pass
