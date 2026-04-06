---
phase: 7
slug: notifications-pushover-inbox
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-05
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test -- --reporter=verbose --run` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose --run`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | NOTIF-01 | unit (TDD) | `npm test -- --reporter=verbose --run` | Created in-task (TDD: tests written first, then implementation) | pending |
| 7-01-02 | 01 | 1 | NOTIF-01 | unit (TDD) | `npm test -- --reporter=verbose --run` | Extended in-task (TDD: tests written first, then implementation) | pending |
| 7-02-01 | 02 | 2 | NOTIF-01 | unit | `npm test -- --reporter=verbose --run` | Existing tests | pending |
| 7-02-02 | 02 | 2 | CFG-02 | unit | `npm test -- --reporter=verbose --run` | Existing tests | pending |
| 7-02-03 | 02 | 2 | NOTIF-01, CFG-02 | manual | curl + visual | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Handling

**No separate Wave 0 plan is needed.** Plan 07-01 Task 1 uses TDD ordering (`tdd="true"` with `<behavior>` block): test stubs are written FIRST (RED phase), then implementation follows (GREEN phase), all within the same task. This satisfies the Nyquist requirement that tests exist before implementation runs, without requiring a separate Wave 0 task/plan.

Test file created in-task: `packages/backend/src/__tests__/arr-webhooks.test.ts`

Coverage:
- Route registration: each arr service endpoint returns 200
- Payload classification: `Grab` -> `grab`, `Download` -> `download_complete`, `Health` -> `health_issue`, `ApplicationUpdate` -> `update_available`
- Title extraction per service: `movie.title`, `series.title`, `artist.name`, `author.authorName`
- Burst poll interval constants: `SABNZBD_BURST_MS === 1000`, `SABNZBD_INTERVAL_MS === 10000`
- Tolerates empty bodies: `POST /api/webhooks/radarr` with no body returns 200
- Unknown eventType: returns 200, logs and ignores

**Note:** Arr webhook tests must NOT test SSE delivery end-to-end. Mock `pollManager.handleArrEvent` and verify it was called (same pattern as Tautulli tests mock `pollManager.updatePlexState`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card label flash (amber/purple/red/green) fires on webhook | NOTIF-01 | CSS animation not testable in Vitest | POST a test Grab payload to `/api/webhooks/radarr` -> verify RADARR card label glows amber for ~10s |
| AppHeader ticker overlay appears for 10s then clears | NOTIF-01 | Browser visual behavior | POST grab payload -> verify `RADARR > GRABBED > [title]` appears in header for 10s then snaps back |
| SABnzbd burst poll activates visibly | NOTIF-01 | Runtime poll interval change | POST grab -> watch SABnzbd card update at 1s intervals; POST download_complete -> confirm interval returns to normal |
| Notifications settings tab renders copy-able URLs | CFG-02 | UI rendering | Navigate to Settings -> Notifications tab -> verify each arr service shows webhook URL with copy button |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or TDD ordering within task
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 handled via TDD ordering in Plan 01 Task 1 (no separate Wave 0 plan needed)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
