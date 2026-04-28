---
phase: 17-download-plex-bug-fixes
plan: "02"
subsystem: frontend-components
tags: [sabnzbd, download-progress, slot-tracking, eta-countdown, bug-fix]
dependency_graph:
  requires: [17-01]
  provides: [sabnzbd-pending-pulse, sabnzbd-eta-countdown]
  affects:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/styles/globals.css
tech_stack:
  added: []
  patterns: [slot-identity state machine, setInterval countdown with SSE resync, CSS modifier reusing existing keyframe]
key_files:
  created: []
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/styles/globals.css
decisions:
  - isPending defaults to false when no slotId present (backward-compatible with pre-slotId snapshots)
  - displayEta falls back to raw serverTimeLeft string when displaySeconds is 0 (handles first render before countdown starts)
  - Pre-existing CSS import TS2882 errors in main.tsx confirmed pre-existing; out of scope (Rule 1 scope boundary)
metrics:
  duration_minutes: 7
  completed_date: "2026-04-28"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 17 Plan 02: Frontend Download Progress Accuracy Summary

**One-liner:** SabnzbdInstrument now shows amber pulse track for new/unconfirmed downloads via slotId state machine, and counts ETA down every second between SSE updates with cleanup on unmount.

## What Was Built

### Task 1 — Pending Pulse CSS Modifier (DL-01)

Added `.sab-instrument__track--pending` CSS rule immediately after `.sab-instrument__fill` in `globals.css`. The rule applies `animation: arrDownloadPulse 1.2s ease-in-out infinite`, reusing the existing keyframe (amber opacity 0.7–1.0). No new `@keyframes` block was needed.

### Task 2 — Slot Tracking State Machine + ETA Countdown (DL-01, DL-02)

**Helper functions** added at file level above `SabnzbdInstrument`:
- `parseTimeleftToSeconds(timeleft)` — splits "H:MM:SS" or "MM:SS" into total seconds
- `formatSecondsToTimeleft(secs)` — formats back to "H:MM:SS" string

**Slot tracking (DL-01):**
- `slotStates: Map<string, 'pending' | 'active'>` — tracks state per `nzo_id` slot
- `prevProgressRef: Map<string, number>` — records last seen progress per slot
- `useEffect([slotId, progressPercent])` — new slot starts as `'pending'`; transitions to `'active'` only when `progressPercent` changes between two consecutive polls
- `isPending` — drives conditional class on track div and conditional fill render
- Slots never revert from `active` back to `pending` within the same component lifetime

**ETA countdown (DL-02):**
- `displaySeconds` state initialized from `parseTimeleftToSeconds(serverTimeLeft)` on each SSE update
- `countdownRef` setInterval ticks `displaySeconds` down by 1 every second
- `useEffect([serverTimeLeft])` clears and restarts the interval on each new server value; cleanup function ensures interval is cleared on unmount
- `displayEta` shown in ETA span: `formatSecondsToTimeleft(displaySeconds)` when counting, falls back to raw `serverTimeLeft` when seconds reach 0

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 0eabe65 | style | add sab-instrument__track--pending pulse CSS modifier (DL-01) |
| 3635b08 | feat | SabnzbdInstrument slot tracking + ETA countdown (DL-01, DL-02) |

## Verification

- `npx vitest run`: 192 tests passed (21 test files, 0 failures)
- `npx tsc --noEmit -p packages/frontend/tsconfig.json`: 2 pre-existing TS2882 errors in `main.tsx` (CSS side-effect imports) confirmed present before this plan's changes; no new errors introduced

## Deviations from Plan

**Pre-existing TypeScript CSS import errors (out of scope)**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `packages/frontend/src/main.tsx` has two TS2882 errors for CSS side-effect imports (`globals.css`, `viewport-iphone.css`) — confirmed pre-existing by stash test
- **Action:** Logged; not fixed (Rule 1 scope boundary — not caused by this plan's changes)
- **Files modified:** None

## Known Stubs

None. All data is wired to real `slotId` and `timeLeft` fields from the SSE snapshot provided by Plan 01's backend changes.

## Threat Flags

None. The `slotId` value is used only as a Map key for display logic (never sent to any API or persisted). The `setInterval` countdown is a single 1-second interval per component instance with explicit cleanup — no amplification vector. Both threats were reviewed in the plan's threat model (T-17-04, T-17-05) and accepted.

## Self-Check: PASSED

- packages/frontend/src/components/cards/ServiceCard.tsx: FOUND
- packages/frontend/src/styles/globals.css: FOUND
- Commit 0eabe65: FOUND
- Commit 3635b08: FOUND
