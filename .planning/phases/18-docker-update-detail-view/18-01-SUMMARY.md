---
phase: 18-docker-update-detail-view
plan: "01"
subsystem: backend
tags: [docker, nas, sse, types, polling]
one_liner: "Promote Docker image update check from boolean to per-image ImageUpdateDetail array flowing through SSE snapshot"

dependency_graph:
  requires: []
  provides:
    - ImageUpdateDetail interface in @coruscant/shared
    - ImageUpdateResult interface in nas adapter
    - per-image update data in SSE nasData snapshot
  affects:
    - packages/shared/src/types.ts
    - packages/backend/src/adapters/nas.ts
    - packages/backend/src/poll-manager.ts

tech_stack:
  added: []
  patterns:
    - Per-image accumulator pattern replacing early-return boolean
    - Shared type extension for SSE payload fields

key_files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/backend/src/adapters/nas.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/__tests__/nas-adapter.test.ts

decisions:
  - ImageUpdateResult interface placed in nas.ts (not shared types) — only backend produces it; frontend consumes ImageUpdateDetail[] via NasStatus
  - localSha extracted from RepoDigests format (repo@sha256:xxx) before comparison — preserves existing logic, now stored per image
  - Outer catch (Docker socket unreachable) returns empty images array with current timestamp — consistent shape, no data loss

metrics:
  duration: "2m"
  completed: "2026-04-28"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 18 Plan 01: Docker Update Detail — Backend Types and Adapter Summary

Promoted the Docker image update check from a scalar `boolean` return to a structured `ImageUpdateResult` carrying a per-image `ImageUpdateDetail[]` array with tag, localSha, remoteSha, and updateAvailable fields. The result flows through PollManager into the SSE `nasData` snapshot under `imageUpdateDetails` and `imageUpdateCheckedAt`, enabling the frontend detail panel (D-04) in plan 18-02.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ImageUpdateDetail interface and extend NasStatus | c727c94 | packages/shared/src/types.ts |
| 2 | Refactor checkNasImageUpdates() and update PollManager + tests | ef6600d | packages/backend/src/adapters/nas.ts, packages/backend/src/poll-manager.ts, packages/backend/src/__tests__/nas-adapter.test.ts |

## Verification

- All 9 nas-adapter tests pass (vitest run)
- shared package TypeScript compiles cleanly (tsc --noEmit -p packages/shared/tsconfig.json)
- backend package TypeScript compiles cleanly (tsc --noEmit -p packages/backend/tsconfig.json)
- Acceptance criteria for both tasks confirmed via grep

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — per-image data is fully wired from Docker socket through PollManager into SSE snapshot. No placeholder values.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes beyond what is described in the plan threat model. All three threats (T-18-01, T-18-02, T-18-03) carry `accept` disposition per plan.

## Self-Check: PASSED

- packages/shared/src/types.ts — FOUND (ImageUpdateDetail interface, imageUpdateDetails, imageUpdateCheckedAt fields)
- packages/backend/src/adapters/nas.ts — FOUND (ImageUpdateResult interface, Promise<ImageUpdateResult> signature)
- packages/backend/src/poll-manager.ts — FOUND (imageUpdateDetails: result.images, imageUpdateCheckedAt: result.checkedAt)
- packages/backend/src/__tests__/nas-adapter.test.ts — FOUND (result.available assertions, Docker socket unreachable test)
- Commit c727c94 — Task 1
- Commit ef6600d — Task 2
