---
phase: 7
slug: notifications-pushover-inbox
status: draft
nyquist_compliant: false
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
| 7-W0-01 | 01 | 0 | NOTIF-01 | unit | `npm test -- --reporter=verbose --run` | ❌ Wave 0 | ⬜ pending |
| 7-01-01 | 01 | 1 | NOTIF-01 | unit | `npm test -- --reporter=verbose --run` | ❌ Wave 0 | ⬜ pending |
| 7-01-02 | 01 | 1 | NOTIF-01 | unit | `npm test -- --reporter=verbose --run` | ❌ Wave 0 | ⬜ pending |
| 7-02-01 | 02 | 2 | NOTIF-02 | unit | `npm test -- --reporter=verbose --run` | ❌ Wave 0 | ⬜ pending |
| 7-03-01 | 03 | 2 | NOTIF-03 | manual | — | N/A | ⬜ pending |
| 7-04-01 | 04 | 3 | CFG-02 | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/src/__tests__/arr-webhooks.test.ts` — stubs covering:
  - Route registration: each arr service endpoint returns 200
  - Payload classification: `Grab` → `grab`, `Download` → `download_complete`, `Health` → `health_issue`, `ApplicationUpdate` → `update_available`
  - Title extraction per service: `movie.title`, `series.title`, `artist.name`, `author.authorName`
  - Burst poll activation: `handleArrEvent` calls `setBurstPoll` on grab, `clearBurstPoll` on download_complete
  - Tolerates empty bodies: `POST /api/webhooks/radarr` with no body returns 200
  - Unknown eventType: returns 200, logs and ignores
- [ ] No new test infrastructure needed — use existing Vitest config and Fastify `inject()` pattern from `tautulli-webhook.test.ts`

**Note:** Arr webhook tests must NOT test SSE delivery end-to-end. Mock `pollManager.handleArrEvent` and verify it was called (same pattern as Tautulli tests mock `pollManager.updatePlexState`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card label flash (amber/purple/red/green) fires on webhook | NOTIF-02 | CSS animation not testable in Vitest | POST a test Grab payload to `/api/webhooks/radarr` → verify RADARR card label glows amber for ~10s |
| AppHeader ticker overlay appears for 10s then clears | NOTIF-02 | Browser visual behavior | POST grab payload → verify `RADARR ▸ GRABBED ▸ [title]` appears in header for 10s then snaps back |
| SABnzbd burst poll activates visibly | NOTIF-01 | Runtime poll interval change | POST grab → watch SABnzbd card update at 1s intervals; POST download_complete → confirm interval returns to normal |
| Notifications settings tab renders copy-able URLs | CFG-02 | UI rendering | Navigate to Settings → Notifications tab → verify each arr service shows `http://{host}:1688/api/webhooks/{service}` with copy button |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
