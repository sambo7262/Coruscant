---
phase: quick
plan: 260405-1ai
subsystem: frontend-layout, backend-crypto
tags: [layout, ui, crypto, hardening]
dependency_graph:
  requires: []
  provides:
    - AppHeader NAS sub-header 3-column centering
    - ServiceCard conditional minHeight per service id
    - NetworkInstrument 2-column left/right layout
    - CardGrid alignItems:start for natural tile height
    - Guarded decrypt() in debug.ts and settings.ts
  affects:
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/backend/src/routes/debug.ts
    - packages/backend/src/routes/settings.ts
tech_stack:
  added: []
  patterns:
    - CSS grid 1fr 1fr 1fr for equal-width 3-column header row
    - Per-service-id conditional minHeight inline expression
    - try/catch around decrypt() returning HTTP 422 on failure
key_files:
  created: []
  modified:
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/backend/src/routes/debug.ts
    - packages/backend/src/routes/settings.ts
decisions:
  - AppHeader NAS row uses CSS grid (1fr 1fr 1fr) — flex layout could not center the middle section independently when DISKS and DOCKER sections vary in width
  - ServiceCard minHeight conditional inline expression — avoids adding new props or CSS classes for a one-off sizing tweak
  - NetworkInstrument 2-column grid replaces stacked top/bottom — matches plan spec for side-by-side Pi-hole/Ubiquiti layout
  - CardGrid alignItems:start — required to let tiles shrink to content height after removing height:100%
  - HTTP 422 (not 500) for decrypt failure on settings save — 422 Unprocessable Entity correctly signals that the request is valid but cannot be processed due to a data state issue; 500 implies a server bug
metrics:
  duration: ~15min
  completed: 2026-04-05T08:00:43Z
  tasks_completed: 3
  files_modified: 5
---

# Quick Task 260405-1ai: Phase 5 Visual Fixes and Crypto Error Summary

**One-liner:** 3-column CSS grid NAS header centering, per-service tile height reduction, Pi-hole/Ubiquiti side-by-side layout, and guarded decrypt() returning HTTP 422 on key-seed mismatch.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | AppHeader 3-column equal-width NAS sub-header | a9c7357 | AppHeader.tsx |
| 2 | CardGrid + ServiceCard tile sizing and NETWORK split | 6c894d7 | CardGrid.tsx, ServiceCard.tsx |
| 3 | Harden all unguarded decrypt() call sites | 798747a | debug.ts, settings.ts |

## Changes Made

### Task 1 — AppHeader NAS sub-header centering

Replaced the NAS data row's `display: flex` wrapper with `display: grid, gridTemplateColumns: '1fr 1fr 1fr'`. Each section (DISKS / NAS stats / DOCKER) now occupies exactly one third of the row and centers its own content independently.

- DISKS left: `justifyContent: 'flex-start'`, removed `flexShrink: 0`
- NAS stats middle: removed `flex: 1`, kept `justifyContent: 'center'`
- DOCKER right: `justifyContent: 'flex-end'`, removed `flexShrink: 0`

### Task 2 — Tile sizing and NETWORK layout

**ServiceCard.tsx:**
- `minHeight` is now conditional: `sabnzbd → 110px`, `pihole → 130px`, all others `160px`
- `NetworkInstrument` returns a 2-column CSS grid (`1fr 1fr`) with Pi-hole stats on the left and Ubiquiti placeholder on the right. Removed the stacked top/bottom layout with the amber divider.

**CardGrid.tsx:**
- Outer grid changed from `alignItems: 'stretch'` to `alignItems: 'start'` — tiles shrink to content height
- Removed `height: '100%'` from the arr MEDIA tile (no longer needed)
- DOWNLOADS section changed from `gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'` to `'1fr'` — SABnzbd spans one column at natural width

### Task 3 — Decrypt hardening

**debug.ts line 31:** Wrapped `decrypt(row.encryptedApiKey, SEED)` in `try/catch`. On failure, logs a structured error and returns `HTTP 500` with message `'Failed to decrypt NAS credentials — ENCRYPTION_KEY_SEED may have changed'`.

**settings.ts line 184:** Replaced the ternary `apiKey !== '' ? apiKey : decrypt(encryptedApiKey, seed)` with an if/try/catch block. On failure, logs structured error with `service` context and returns `HTTP 422` with `'Stored API key could not be decrypted. The encryption seed may have changed — please re-enter the API key.'`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder data or hardcoded empty values introduced.

## Self-Check: PASSED

Files exist:
- packages/frontend/src/components/layout/AppHeader.tsx — confirmed modified
- packages/frontend/src/components/cards/ServiceCard.tsx — confirmed modified
- packages/frontend/src/components/cards/CardGrid.tsx — confirmed modified
- packages/backend/src/routes/debug.ts — confirmed modified
- packages/backend/src/routes/settings.ts — confirmed modified

Commits exist:
- a9c7357 — feat(quick-260405-1ai): AppHeader NAS sub-header 3-column equal-width grid
- 6c894d7 — feat(quick-260405-1ai): tile sizing and NETWORK left/right split
- 798747a — fix(quick-260405-1ai): harden decrypt() call sites with try/catch

TypeScript:
- Frontend: clean (pre-existing globals.css import error is unrelated to these changes)
- Backend: clean
