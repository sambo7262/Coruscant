---
phase: 4
slug: rich-service-integrations
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --reporter=dot` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --reporter=dot`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-02-1a | 02 | 2 | SVCRICH-01 | unit | `npx vitest run packages/backend/src/__tests__/pihole-adapter.test.ts` | TDD inline | pending |
| 4-02-1b | 02 | 2 | SVCRICH-02, SVCRICH-03, SVCRICH-04 | unit | `npx vitest run packages/backend/src/__tests__/tautulli-webhook.test.ts packages/backend/src/__tests__/nas-adapter.test.ts` | TDD inline | pending |
| 4-02-02 | 02 | 2 | SVCRICH-01, SVCRICH-03 | integration | `npx tsc --noEmit -p packages/backend/tsconfig.json && npx vitest run packages/backend` | yes | pending |
| 4-03-01 | 03 | 3 | SVCRICH-01 | compile | `npx tsc --noEmit -p packages/frontend/tsconfig.json` | yes | pending |
| 4-03-02 | 03 | 3 | SVCRICH-01, SVCRICH-05 | compile | `npx tsc --noEmit -p packages/frontend/tsconfig.json` | yes | pending |
| 4-04-01 | 04 | 3 | SVCRICH-03, SVCRICH-04, SVCRICH-05 | compile | `npx tsc --noEmit -p packages/frontend/tsconfig.json` | yes | pending |
| 4-05-01 | 05 | 3 | SVCRICH-02, SVCRICH-05 | compile | `npx tsc --noEmit -p packages/frontend/tsconfig.json` | yes | pending |
| 4-05-02 | 05 | 3 | ALL | manual+auto | `npx vitest run && npx tsc --noEmit` | yes | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Tests are created TDD-inline in Plan 04-02 Task 1a and Task 1b — no separate Wave 0 plan. VALIDATION.md tracks the test files created there.

Test files created by Plan 02:
- [x] `packages/backend/src/__tests__/pihole-adapter.test.ts` — Pi-hole v6 auth, summary, blocking state, re-auth on 401, query types
- [x] `packages/backend/src/__tests__/tautulli-webhook.test.ts` — Tautulli webhook play/pause/stop/resume events, payload mapping
- [x] `packages/backend/src/__tests__/nas-adapter.test.ts` — DSM auth sid, utilization, disk temps, fan speeds, image update check

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NAS amber stale-data state when DSM session expires | SVCRICH-04 | Requires live DSM session timeout (cannot mock accurately) | Let NAS credentials expire, confirm card shows amber indicator |
| Now Playing banner scrolls with live stream data | SVCRICH-02 | Visual animation requires live Plex stream | Start a stream in Plex, confirm banner animates and shows title |
| Detail view shows all expanded metrics on tap | SVCRICH-05 | Visual/interaction test | Tap Pi-hole card for detail view, tap NAS header strip for expanded panel |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (folded into Plan 02 TDD tasks)
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
