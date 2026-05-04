---
phase: 22
slug: nas-process-monitor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~6 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 6 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | NAS-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | NAS-01 | unit | `npm test` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `packages/backend/src/__tests__/nas-processes.test.ts` — stubs for NAS-02 process fetch/label
- [ ] Debug endpoint `/debug/nas-processes` — passthrough to inspect raw DSM response before parser is finalized

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tap affordance appears when CPU >30% | NAS-01 | Requires live NAS data | Watch NAS tile during elevated CPU |
| Process panel opens with labeled rows | NAS-01 | Requires browser + live DSM | Tap CPU metric, verify panel content |
| Panel dismisses correctly | NAS-01 | Requires tap interaction | Tap outside or tap CPU again |
| Kiosk/portrait/landscape layout | NAS-01 | Viewport-dependent | Check all three viewports |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 6s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
