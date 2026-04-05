---
phase: 6
slug: network-monitoring
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `/vitest.config.js` (root) — `include: ['packages/*/src/__tests__/**/*.test.ts']` |
| **Quick run command** | `npm test -- --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | NET-01, NET-02, NET-04 | unit (TDD — creates test file) | `npm test -- --reporter=verbose 2>&1 \| tail -40` | ✅ created by task | ⬜ pending |
| 6-02-01 | 02 | 2 | NET-01 | unit | `npm test -- --reporter=verbose 2>&1 \| tail -20` | ✅ created in 01 | ⬜ pending |
| 6-02-02 | 02 | 2 | NET-04 | unit | `npm test -- --reporter=verbose 2>&1 \| tail -20` | ✅ created in 01 | ⬜ pending |
| 6-03-01 | 03 | 3 | NET-01, NET-02 | unit | `npm test -- --reporter=verbose 2>&1 \| tail -20` | ✅ created in 01 | ⬜ pending |
| 6-03-02 | 03 | 3 | NET-03 | unit | `npm test -- --reporter=verbose 2>&1 \| tail -20` | ✅ created in 01 | ⬜ pending |
| 6-03-03 | 03 | 3 | NET-01, NET-02, NET-03 | manual (UI) | n/a — checkpoint task | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

TDD-in-place approach: Plan 01 Task 1 (`tdd="true"`) creates the test file and implementation together in Wave 1. No separate Wave 0 plan is needed.

- [x] `packages/backend/src/__tests__/unifi-adapter.test.ts` — created by Plan 01 Task 1 (TDD)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UniFi card renders on dashboard with live data | NET-01 | Requires live UniFi controller | Open dashboard, verify UBIQUITI card shows client count + TX/RX bars |
| Detail view lists all devices grouped by type | NET-02 | UI state — requires live data | Tap UniFi card, verify GATEWAYS / SWITCHES / ACCESS POINTS sections |
| Test connection in settings validates token | NET-04 | Requires live controller + valid token | Settings → UniFi → enter URL + token → TEST CONNECTION → verify site name returned |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are checkpoint tasks (manual)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] TDD-in-place: test file created by Plan 01 Task 1 (no separate Wave 0 needed)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-04-05
