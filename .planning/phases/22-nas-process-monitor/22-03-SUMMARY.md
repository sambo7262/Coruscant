---
phase: 22-nas-process-monitor
plan: 03
subsystem: ui
tags: [nas, react, framer-motion, typescript, process-monitor, dashboard]

# Dependency graph
requires:
  - phase: 22-nas-process-monitor
    plan: 01
    provides: "NasProcess shared type + GET /api/nas/processes backend endpoint"
  - phase: 22-nas-process-monitor
    plan: 02
    provides: "CSS classes for nas-process-panel and nas-tile__cpu-tap-btn"
provides:
  - NasProcessPanel component with on-demand fetch, loading/error/empty/populated states
  - CPU tap affordance (chevron button) when NAS CPU > 30%
  - Mutual exclusion between Docker update panel and process panel via unified openPanel state
  - Framer Motion slide-down animation for process panel
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unified openPanel state ('docker'|'process'|null) replaces separate boolean flags for mutually exclusive panels"
    - "On-demand fetch via useEffect on mount — panel unmounts between opens, no continuous polling"
    - "Conditional CPU tap affordance: button wrapper only when cpu > CPU_TAP_THRESHOLD (30%)"

key-files:
  created:
    - packages/frontend/src/components/layout/NasProcessPanel.tsx
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx

key-decisions:
  - "Unified openPanel state ('docker'|'process'|null) achieves mutual exclusion with a single state variable — no synchronization logic needed"
  - "CPU_TAP_THRESHOLD = 30 constant co-located in NasTileInstrument per D-09/D-10 — plain row when CPU normal, button when elevated"
  - "NasProcessPanel fetches on mount (useEffect empty deps) because panel unmounts when closed — each open triggers a fresh fetch per D-02"
  - "getProcBarColor: amber 0-60%, orange 61-85%, red 86-100% matches Plan 02 CSS variables per D-11"

patterns-established:
  - "Unified panel state pattern: useState<'panelA'|'panelB'|null> for mutually exclusive expandable panels in a single component"

requirements-completed: [NAS-01, NAS-02]

# Metrics
duration: 3min
completed: 2026-05-04
---

# Phase 22 Plan 03: NAS Process Panel Frontend Summary

**NasProcessPanel component with on-demand DSM fetch wired into NAS tile — CPU tap affordance at >30% threshold, mutual exclusion with Docker update panel, Framer Motion slide-down**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-04T14:29:13Z
- **Completed:** 2026-05-04T14:31:51Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify, blocked awaiting real NAS verification)
- **Files modified:** 2

## Accomplishments
- Created `NasProcessPanel.tsx` with on-demand fetch, loading skeleton, error row, empty row, and populated process rows with color-coded usage bars
- Refactored `NasTileInstrument` to replace `dockerPanelOpen: boolean` with `openPanel: 'docker'|'process'|null` for mutual exclusion
- CPU metric row conditionally renders as tappable button with chevron when `nasStatus.cpu > 30%`, plain div when at or below threshold
- Both Docker update panel and NAS process panel use AnimatePresence for slide-down animation, mutual exclusion guaranteed by unified state
- All 222 tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NasProcessPanel component** - `00a6273` (feat)
2. **Task 2: Wire NasProcessPanel into NasTileInstrument with CPU tap affordance and mutual exclusion** - `f70671b` (feat)
3. **Task 3: Verify NAS process monitor on real hardware** - checkpoint:human-verify (awaiting user)

## Files Created/Modified
- `packages/frontend/src/components/layout/NasProcessPanel.tsx` - New component: on-demand fetch from /api/nas/processes, loading/error/empty states, process rows with label+bar+pct, Framer Motion slide-down
- `packages/frontend/src/components/cards/ServiceCard.tsx` - NasTileInstrument refactored: unified openPanel state, CPU tap affordance button at >30% threshold, NasProcessPanel AnimatePresence block

## Decisions Made
- Unified `openPanel` state (`'docker' | 'process' | null`) achieves mutual exclusion automatically — setting one panel closes the other with no extra logic
- `CPU_TAP_THRESHOLD = 30` constant co-located in `NasTileInstrument` (not a shared constant) since only this component uses it
- `NasProcessPanel` fetches on mount because it unmounts when closed — each panel open is a fresh fetch, matching D-02 on-demand requirement
- Bar color progression implemented in `getProcBarColor`: amber (0-60%), orange (61-85%), red (86-100%) per D-11

## Deviations from Plan

None — plan executed exactly as written.

---

**Total deviations:** 0
**Impact on plan:** None.

## Issues Encountered

- Worktree branch was behind main by 13 commits (Phase 22 Plans 01 and 02 were merged to main but not in the worktree). Reset worktree branch to `ed5d25e` (main HEAD) to acquire NasProcess type and CSS classes before executing.

## User Setup Required

None — no external service configuration required. The feature uses existing NAS credentials configured via Settings.

## Known Stubs

None — all data flows from the live `/api/nas/processes` endpoint.

## Next Phase Readiness
- Task 3 (checkpoint:human-verify) awaits user verification on real NAS hardware
- User should visit /debug/nas-processes to inspect DSM field names
- User should verify CPU tap affordance appears when CPU > 30%, process panel opens/closes, mutual exclusion with Docker panel works

---
*Phase: 22-nas-process-monitor*
*Completed: 2026-05-04*
