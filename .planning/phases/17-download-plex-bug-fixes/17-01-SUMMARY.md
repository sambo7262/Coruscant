---
phase: 17-download-plex-bug-fixes
plan: "01"
subsystem: backend-adapters
tags: [plex, sabnzbd, transcode, burst-polling, bug-fix]
dependency_graph:
  requires: []
  provides: [plex-transcode-fix, sabnzbd-slotid, sabnzbd-burst-polling]
  affects: [packages/backend/src/adapters/plex.ts, packages/backend/src/adapters/sabnzbd.ts, packages/backend/src/poll-manager.ts, packages/shared/src/types.ts]
tech_stack:
  added: []
  patterns: [OR-based decision field inspection, burst poll activation on metric threshold]
key_files:
  created: []
  modified:
    - packages/backend/src/adapters/plex.ts
    - packages/backend/src/__tests__/plex-adapter.test.ts
    - packages/shared/src/types.ts
    - packages/backend/src/adapters/sabnzbd.ts
    - packages/backend/src/poll-manager.ts
    - packages/backend/src/__tests__/sabnzbd-adapter.test.ts
decisions:
  - Plex transcode uses OR of videoDecision/audioDecision === 'transcode' rather than object presence
  - slotId extracted via optional chaining on nzo_id — undefined (not empty string) when absent
  - Burst poll activation uses type-narrowed queueCount from metrics cast to Record<string, unknown>
metrics:
  duration_minutes: 8
  completed_date: "2026-04-28"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 6
---

# Phase 17 Plan 01: Plex Transcode Fix + SABnzbd SlotId and Burst Polling Summary

**One-liner:** Fixed false transcode glow on direct-play Plex streams via videoDecision/audioDecision field inspection; exposed SABnzbd nzo_id as slotId and triggered burst polling on active queue.

## What Was Built

### Task 1 — Plex Transcode Detection Fix (PLEX-01)

The previous implementation set `transcode: item.TranscodeSession !== undefined`, which fired the transcode glow on any stream with an active transcode session object — even direct-play streams where Plex still attaches a `TranscodeSession` with `videoDecision: 'directplay'`.

**Fix:** Changed transcode boolean to `videoDecision === 'transcode' || audioDecision === 'transcode'`. Extended the `TranscodeSession` type to include `audioDecision?: string`.

**Test coverage (4 new/updated cases):**
- Video-only transcode with explicit audioDecision directplay → `true`
- Audio-only transcode (videoDecision directplay) → `true`
- Both decisions directplay → `false`
- Empty TranscodeSession object (no decision keys) → `false`

### Task 2 — SABnzbd slotId + Burst Poll on queueCount (DL-01, DL-02)

**slotId (DL-01):** Added `nzo_id?: string` to `SabnzbdSlot` interface; extracted `firstActiveSlot?.nzo_id ?? undefined` into `slotId`; added `slotId?: string` to `SabnzbdMetrics` shared type. Frontend can now track a stable slot identifier across polls.

**Burst polling (DL-02):** Added activation logic in `PollManager.doPoll` immediately after `pollSabnzbd` returns: type-narrows `metrics.queueCount` and calls `this.activateSabnzbdBurstPoll()` when `queueCount > 0 && !this.burstPollActive`. Previously burst mode only activated on grab webhooks, leaving users with stale time-remaining displays for already-queued downloads.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| ab4d36c | fix | Plex transcode detection using videoDecision/audioDecision |
| dd46d1f | feat | SABnzbd slotId extraction + burst poll on queueCount > 0 |

## Verification

All tests pass:
- `plex-adapter.test.ts`: 27 tests passed (23 existing + 4 new/updated)
- `sabnzbd-adapter.test.ts`: 13 tests passed (12 existing + 1 new)
- `npx tsc --noEmit -p packages/backend/tsconfig.json`: exit 0

## Deviations from Plan

**[Rule 3 - Blocking] Rebuilt shared package dist after types.ts edit**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `packages/shared/dist` is gitignored (built artifact); `npx tsc --noEmit -p packages/backend/tsconfig.json` resolved `SabnzbdMetrics` from the stale dist, reporting `slotId does not exist in type 'SabnzbdMetrics'`
- **Fix:** Ran `npx tsc` in `packages/shared` to regenerate dist locally before re-running the backend type check. Dist files not committed (gitignored by design).
- **Files modified:** packages/shared/dist/ (local only, not committed)

## Known Stubs

None. All data fields are wired to real API values.

## Threat Flags

None. All surfaces (SABnzbd nzo_id, Plex TranscodeSession fields, burst poll frequency) were reviewed in the plan's threat model and accepted as low-risk local LAN interactions.

## Self-Check: PASSED

- packages/backend/src/adapters/plex.ts: FOUND
- packages/shared/src/types.ts: FOUND
- packages/backend/src/adapters/sabnzbd.ts: FOUND
- packages/backend/src/poll-manager.ts: FOUND
- Commit ab4d36c: FOUND
- Commit dd46d1f: FOUND
