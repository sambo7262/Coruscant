---
phase: quick
plan: 260405-1ai
subsystem: frontend-layout, backend-crypto
tags: [layout, ui, crypto, hardening]
dependency_graph:
  requires: []
  provides:
    - ServiceCard conditional minHeight per service id
    - NetworkInstrument 2-column left/right layout
    - CardGrid alignItems:start for natural tile height
    - MediaStackRow and ArrInstrument labels at 22px matching BLOCKING/ONLINE display scale
    - Guarded decrypt() in debug.ts and settings.ts
  affects:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/backend/src/routes/debug.ts
    - packages/backend/src/routes/settings.ts
tech_stack:
  added: []
  patterns:
    - Per-service-id conditional minHeight inline expression
    - try/catch around decrypt() returning HTTP 422 on failure
    - Matching instrument display font sizes across tiles (22px large display style)
key_files:
  created: []
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/backend/src/routes/debug.ts
    - packages/backend/src/routes/settings.ts
decisions:
  - ServiceCard minHeight conditional inline expression — avoids adding new props or CSS classes for a one-off sizing tweak
  - NetworkInstrument 2-column grid replaces stacked top/bottom — matches plan spec for side-by-side Pi-hole/Ubiquiti layout
  - CardGrid alignItems:start — required to let tiles shrink to content height
  - HTTP 422 (not 500) for decrypt failure on settings save — 422 Unprocessable Entity correctly signals that the request is valid but cannot be processed due to a data state issue; 500 implies a server bug
  - MediaStackRow service label and ArrInstrument status text at 22px — user clarification: should match the BLOCKING/ONLINE display scale in the Network tile for visual parity
metrics:
  duration: ~12min (re-execution with user clarification)
  completed: 2026-04-06T15:04:00Z
  tasks_completed: 3
  files_modified: 4
---

# Quick Task 260405-1ai: Phase 5 Visual Fixes and Crypto Error Summary

**One-liner:** CardGrid Row 2 tiles align to top edge (alignItems:start), Media tile service labels and status text at 22px matching Network tile BLOCKING/ONLINE scale, and guarded decrypt() returning HTTP 422 on key-seed mismatch.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | AppHeader 3-column NAS sub-header | pre-existing | (no AppHeader NAS row exists — NAS is a standalone tile in CardGrid) |
| 2 | CardGrid alignItems:start + Media label font sizes | 2025231, 8976336 | CardGrid.tsx, ServiceCard.tsx |
| 3 | Harden all unguarded decrypt() call sites | pre-existing (verified in place) | debug.ts, settings.ts |

## Changes Made

### Task 1 — AppHeader NAS sub-header centering

Deviation: AppHeader.tsx has no NAS data row. The NAS sub-header described in the plan (line ~248) does not exist in the current AppHeader.tsx (203 lines, no NAS data). The NAS metrics are rendered in `NasTileInstrument` inside ServiceCard.tsx, which already uses `gridTemplateColumns: '1fr 2fr 1fr'`. No changes needed or applied to AppHeader.tsx.

### Task 2 — Tile sizing, NETWORK layout, and Media label font sizes

**CardGrid.tsx (commit 2025231):**
- Row 2 grid changed from `alignItems: 'stretch'` to `alignItems: 'start'` — tiles shrink to their content height and align to the top edge

**ServiceCard.tsx (commit 8976336, prior session):**
- `minHeight` is conditional: `pihole → 130px`, all others `160px` (SABnzbd renders null, not a ServiceCard)
- `NetworkInstrument` renders a 2-column CSS grid (`1fr 1fr`) with Pi-hole stats left and Ubiquiti right
- `MediaStackRow` service label: `14px` → `22px` with `fontWeight: 600`, `lineHeight: 1.1`, and text glow — matches BLOCKING/ONLINE display scale in Network tile
- `ArrInstrument` status text: `11px` → `22px` with `fontWeight: 600`, matching the same scale
- `ArrInstrument` active download title: `10px` → `22px` with matching style

### Task 3 — Decrypt hardening (pre-existing, verified)

**debug.ts:** Wraps `decrypt(row.encryptedApiKey, SEED)` in `try/catch`. On failure: logs structured error, returns `HTTP 500` with clear message about ENCRYPTION_KEY_SEED.

**settings.ts:** if/try/catch block replaces ternary `decrypt()` call. On failure: logs structured error with `service` context, returns `HTTP 422` with instruction to re-enter API key.

## Deviations from Plan

### Deviation 1 — AppHeader NAS row does not exist

**Found during:** Task 1
**Issue:** Plan describes modifying the NAS data row in AppHeader.tsx at line ~248. AppHeader.tsx is 203 lines with no NAS data section — NAS metrics were moved to a standalone NasTileInstrument component in ServiceCard.tsx in a prior phase.
**Fix:** No change applied to AppHeader. The NAS 3-column layout (`1fr 2fr 1fr`) already exists in NasTileInstrument.
**Files modified:** None

### Deviation 2 — Tasks 1 and 3 were pre-existing from prior execution

**Found during:** All tasks
**Issue:** This plan was previously executed. Backend decrypt hardening and most ServiceCard changes were already committed. A later UAT commit (`cf2be92`) restored `alignItems: 'stretch'` in CardGrid.
**Fix:** Re-applied `alignItems: 'start'` to CardGrid.tsx. Verified all other changes were in place.
**Commits:** 2025231 (CardGrid), 8976336 (ServiceCard — prior session)

### Deviation 3 — User clarification: Media label font size target

**Found during:** Task 2
**Issue:** User clarified that Media tile labels (service names, status text, download titles) should match the BLOCKING/ONLINE `22px` display size in the Network tile — not an arbitrary bump.
**Fix:** MediaStackRow service label, ArrInstrument status text, and active title all set to `22px` with `fontWeight: 600` and matching glow styles. This was already committed in the prior session (commit `8976336`).
**Files modified:** ServiceCard.tsx

## Known Stubs

None — no placeholder data or hardcoded empty values introduced.

## Self-Check: PASSED

Files exist and contain expected changes:
- packages/frontend/src/components/cards/CardGrid.tsx — alignItems: 'start' on Row 2 grid confirmed (line 153)
- packages/frontend/src/components/cards/ServiceCard.tsx — 22px label sizes, 2-col NetworkInstrument, conditional minHeight confirmed
- packages/backend/src/routes/debug.ts — try/catch around decrypt() confirmed (lines 36-41)
- packages/backend/src/routes/settings.ts — try/catch around decrypt() returning HTTP 422 confirmed (lines 188-197)

Commits exist:
- 2025231 — feat(quick-260405-1ai): CardGrid Row 2 alignItems start
- 8976336 — feat(quick-260406-are): increase ArrInstrument status text and MediaStackRow label to 22px

TypeScript:
- Frontend: clean (pre-existing globals.css import error unrelated)
- Backend: clean
