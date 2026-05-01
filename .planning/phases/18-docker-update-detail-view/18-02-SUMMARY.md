---
phase: 18-docker-update-detail-view
plan: "02"
subsystem: frontend
tags: [docker, framer-motion, inline-expand, cockpit-ui, responsive]
one_liner: "DockerUpdatePanel inline expand component wired into NasTileInstrument with tap-to-toggle, Framer Motion animation, and cockpit-aesthetic CSS"

dependency_graph:
  requires:
    - ImageUpdateDetail interface from @coruscant/shared (plan 18-01)
    - imageUpdateDetails, imageUpdateCheckedAt fields on NasStatus (plan 18-01)
  provides:
    - DockerUpdatePanel component (inline tap-to-expand)
    - NasTileInstrument docker-update area with button tap target and state
  affects:
    - packages/frontend/src/components/layout/DockerUpdatePanel.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/styles/globals.css

tech_stack:
  added: []
  patterns:
    - Framer Motion AnimatePresence + height animation (mirror of PiHealthPanel pattern)
    - useState toggle for inline expand/collapse
    - CSS button reset (all: unset) for accessible tap target
    - Hover gated behind @media (hover: hover) and (pointer: fine)

key_files:
  created:
    - packages/frontend/src/components/layout/DockerUpdatePanel.tsx
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/styles/globals.css

decisions:
  - DockerUpdatePanel mirrors PiHealthPanel motion.div pattern exactly (D-09) — height 0→auto animate with 0.25s easeInOut
  - Panel renders inline within NAS tile col-right (not position:fixed, not modal) per D-01
  - hasUpdates prop drives ALL IMAGES UP TO DATE vs per-image list rendering (D-06)
  - Relative timestamp (Nm ago) computed from checkedAt ISO string per D-08
  - Button wraps docker-update div with aria-expanded for accessibility; existing LED dot + label content unchanged
  - CSS variables adapted to codebase actuals: --cockpit-amber and --cockpit-green instead of --led-amber/--led-green which do not exist in :root
  - Hover gated behind @media (hover: hover) and (pointer: fine) per project convention

metrics:
  duration: "8m"
  completed: "2026-04-28"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 3
---

# Phase 18 Plan 02: Docker Update Detail — Frontend Panel Summary

Built the `DockerUpdatePanel` inline expand component and wired it into the NAS tile's Docker update area. Tapping the LED dot + label area toggles an animated detail panel showing per-image update status. When updates are pending, each image is listed with "UPDATE AVAILABLE"; when all images are current, the panel shows "ALL IMAGES UP TO DATE" with a relative last-checked timestamp. The component mirrors the proven PiHealthPanel pattern and uses cockpit-aesthetic monospace typography with amber/green palette.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create DockerUpdatePanel and wire into ServiceCard NasTileInstrument | dc763d5 | packages/frontend/src/components/layout/DockerUpdatePanel.tsx, packages/frontend/src/components/cards/ServiceCard.tsx |
| 2 | Add Docker update panel CSS styles in cockpit aesthetic | 851b055 | packages/frontend/src/styles/globals.css |

## Verification

- TypeScript compiles cleanly for frontend package (tsc --noEmit -p packages/frontend/tsconfig.json) — only pre-existing CSS import warnings in main.tsx unrelated to this plan
- All 193 tests pass (21 test files, vitest run)
- Acceptance criteria confirmed via grep for all 7 criteria in Task 1 and 4 criteria in Task 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Build shared package before TypeScript check**
- **Found during:** Task 1 verification
- **Issue:** @coruscant/shared dist/ directory was absent in worktree; tsc reported ImageUpdateDetail not exported from @coruscant/shared
- **Fix:** Ran `npm run build` in packages/shared to generate dist/types.js and dist/types.d.ts; TypeScript then resolved correctly
- **Files modified:** packages/shared/dist/ (build artifacts, not committed)
- **Commit:** N/A (build step, not a code change)

**2. [Rule 2 - Convention] CSS variables adapted to codebase actuals**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified --text-dim, --text-primary, --led-green, --led-amber, --border-dim — none of these exist in :root; codebase uses --cockpit-amber, --cockpit-green
- **Fix:** Used var(--cockpit-amber), var(--cockpit-green) and raw rgba() fallbacks matching the established palette
- **Files modified:** packages/frontend/src/styles/globals.css
- **Commit:** 851b055

## Known Stubs

None — panel reads live `imageUpdateDetails` from SSE nasData snapshot (wired in plan 18-01). `checkedAt` shows "Checking..." until first check completes, which is expected transient behavior, not a stub.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes. All three threat entries in plan threat model (T-18-04, T-18-05, T-18-06) carry `accept` disposition; no mitigations required. Image tags rendered via React JSX text nodes — auto-escaped, no dangerouslySetInnerHTML.

## Self-Check: PASSED

- packages/frontend/src/components/layout/DockerUpdatePanel.tsx — FOUND (export function DockerUpdatePanel)
- packages/frontend/src/components/cards/ServiceCard.tsx — FOUND (dockerPanelOpen, AnimatePresence, DockerUpdatePanel, aria-expanded)
- packages/frontend/src/styles/globals.css — FOUND (.docker-update-panel, .nas-tile__docker-update-btn)
- Commit dc763d5 — Task 1: FOUND
- Commit 851b055 — Task 2: FOUND
