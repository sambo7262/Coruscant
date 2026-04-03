---
phase: 02-core-ui-shell
plan: 03
subsystem: frontend-cards
tags: [react, framer-motion, sse, animation, cards, dashboard, tron-ui]

# Dependency graph
requires:
  - phase: 02-core-ui-shell
    plan: 01
    provides: GET /api/sse endpoint, DashboardSnapshot/ServiceStatus types, generateMockSnapshot
  - phase: 02-core-ui-shell
    plan: 02
    provides: App.tsx shell, AppHeader, GridBackground, globals.css with animation keyframes

provides:
  - useDashboardSSE hook connecting to /api/sse with auto-reconnect
  - StatusDot: 8px animated health-state dot with per-state animation
  - StaleIndicator: amber badge rendered only when lastPollAt > 5 min
  - ServiceCard: animated card with conic-gradient border trace, health glow, Framer Motion entrance
  - CardGrid: tier-grouped section layout with skeleton and live states
  - DashboardPage: SSE-wired page with scroll restoration
  - AppHeader: extended with connected prop, amber reconnect indicator

affects:
  - 02-04 (now-playing banner — App.tsx already wired, streams prop provided)
  - 02-05 (settings page — AnimationSlider still wires to same App shell)
  - 03+ (real adapters flow into same ServiceCard/CardGrid components)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - EventSource SSE with addEventListener('dashboard-update') and onerror 5s reconnect
    - Framer Motion motion.div with initial/animate opacity+y, whileTap scale (transform only)
    - conic-gradient border trace using @property --angle and borderTrace keyframe
    - Per-card stagger: entrance delay = index * 0.05s, trace delay = index * 0.3s
    - sessionStorage scroll position save/restore for navigation continuity
    - SSE hook lifted to App.tsx so all routes share same snapshot

# Key files
key-files:
  created:
    - packages/frontend/src/hooks/useDashboardSSE.ts
    - packages/frontend/src/components/ui/StatusDot.tsx
    - packages/frontend/src/components/ui/StaleIndicator.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
  modified:
    - packages/frontend/src/pages/DashboardPage.tsx
    - packages/frontend/src/App.tsx
    - packages/frontend/src/components/layout/AppHeader.tsx

# Decisions
decisions:
  - SSE hook in App.tsx (not DashboardPage) so AppHeader gets NAS stats on all routes
  - Amber dot with title attribute for connection-lost indicator — no separate text component
  - globalIndex counter in CardGrid to ensure stagger continuity across tier sections
  - Parallel agent (Plan 02-02) had already added useDashboardSSE and NowPlayingBanner to App.tsx — integrated cleanly by adding connected prop

# Metrics
metrics:
  duration: 2m 12s
  completed: 2026-04-03
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 3
---

# Phase 02 Plan 03: Service Cards and SSE Data Wiring Summary

**One-liner:** Animated service cards with conic-gradient border traces, health-state glow, and Framer Motion entrance, fed by EventSource SSE hook with 5s auto-reconnect and tier-grouped CardGrid.

## What Was Built

### Task 1: SSE Hook, StatusDot, StaleIndicator, ServiceCard (commit 2a04ef7)

**useDashboardSSE** — EventSource hook at `/api/sse`. Listens for `dashboard-update` events, parses JSON into `DashboardSnapshot`. On error: sets `connected=false`, closes, schedules 5s reconnect. Returns `{ snapshot, connected }`.

**StatusDot** — 8px circle, colored per health state (`--tron-blue` for online/stale, `--tron-amber` for warning, `--tron-red` for offline), with matching animation (`breathe`, `pulseAmber`, `flashRed`). Marked `aria-hidden="true"`.

**StaleIndicator** — Computes `Date.now() - new Date(lastPollAt).getTime()`. Returns `null` if under 5 minutes. Otherwise renders amber "stale" badge with border.

**ServiceCard** — `motion.div` with:
- Entrance: `initial={{ opacity: 0, y: 12 }}` → `animate={{ opacity: 1, y: 0 }}`, delay = `index * 0.05s`
- Tap: `whileTap={{ scale: 0.97 }}`
- Border trace: inner `<div>` with `conic-gradient(from var(--angle), ...)` and `borderTrace 3s linear infinite`, delay = `index * 0.3s`
- Health glow: `boxShadow` + `animation` set per status from `GLOW_CONFIG`
- Navigation: `sessionStorage.setItem('dashboardScrollY', ...)` then `navigate(/services/:id)`
- Accessibility: `role="button"`, `tabIndex={0}`, `aria-label`, keyboard `Enter`/`Space` handler

### Task 2: CardGrid, DashboardPage, App.tsx wiring (commit 5a19744)

**CardGrid** — Renders three `<section>` elements (STATUS, ACTIVITY, RICH DATA) in declaration order. Uses `repeat(auto-fit, minmax(160px, 1fr))` — 2 columns on mobile, more on wider screens. Global card index maintained with `let globalIndex = 0` across sections for sequential stagger. Null-snapshot path renders skeleton placeholder cards (same dimensions, no content).

**DashboardPage** — Now accepts `snapshot: DashboardSnapshot | null` prop. Passes to `CardGrid`. Restores scroll position from `sessionStorage.getItem('dashboardScrollY')` on mount.

**App.tsx** — Added `connected` to the destructured `useDashboardSSE()` call. Passes `connected` to `AppHeader`, `snapshot` to `DashboardPage`.

**AppHeader** — Added `connected: boolean` to `AppHeaderProps`. When `connected === false`, renders an 8px amber dot with `title="Connection lost. Reconnecting..."` in the NAS stats strip.

## Deviations from Plan

### Integration Adjustment

**Found during:** Task 2 — App.tsx read

**Issue:** App.tsx had already been modified by parallel agent executing Plan 02-02 (NowPlayingBanner added, useDashboardSSE already imported and called with `const { snapshot } = useDashboardSSE()`).

**Fix:** Edited incrementally instead of overwriting. Changed destructure to `{ snapshot, connected }`, added `connected` prop to `AppHeader`, added `snapshot` prop to `DashboardPage`. All existing Plan 02-02 additions (NowPlayingBanner, ServiceDetailPage snapshot prop) preserved intact.

**Files modified:** packages/frontend/src/App.tsx

No other deviations — plan executed as written.

## Known Stubs

None. All components receive live SSE data from the backend. The skeleton/null state in CardGrid is intentional — it renders while the first SSE event is in-flight, not a permanent stub.

## Verification

- `npm run build --workspace=packages/frontend` — exits 0, 2142 modules transformed, 378KB bundle

## Self-Check: PASSED

Files created:
- [x] packages/frontend/src/hooks/useDashboardSSE.ts — FOUND
- [x] packages/frontend/src/components/ui/StatusDot.tsx — FOUND
- [x] packages/frontend/src/components/ui/StaleIndicator.tsx — FOUND
- [x] packages/frontend/src/components/cards/ServiceCard.tsx — FOUND
- [x] packages/frontend/src/components/cards/CardGrid.tsx — FOUND

Commits:
- [x] 2a04ef7 — feat(02-03): SSE hook, StatusDot, StaleIndicator, ServiceCard with animations
- [x] 5a19744 — feat(02-03): CardGrid with tier sections, wire DashboardPage SSE data, AppHeader connection state
