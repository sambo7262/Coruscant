---
phase: 6
slug: network-monitoring
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 6-01-01 | 01 | 0 | NET-01, NET-02, NET-04 | unit stub | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | NET-01 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | NET-01 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 1 | NET-02 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 6-03-02 | 03 | 1 | NET-02 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 1 | NET-04 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 6-05-01 | 05 | 2 | NET-03 | unit | `npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/src/__tests__/unifi-adapter.test.ts` — stubs for NET-01, NET-02, NET-03, NET-04
- [ ] Shared fixtures/mocks for UniFi API responses (devices list, clients list, stat/health)

*Wave 0 must create test file with stubs before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UniFi card renders on dashboard with live data | NET-01 | Requires live UniFi controller | Open dashboard, verify UBIQUITI card shows client count + TX/RX bars |
| Detail view lists all devices grouped by type | NET-02 | UI state — requires live data | Tap UniFi card, verify GATEWAYS / SWITCHES / ACCESS POINTS sections |
| Test connection in settings validates token | NET-04 | Requires live controller + valid token | Settings → UniFi → enter URL + token → TEST CONNECTION → verify site name returned |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
