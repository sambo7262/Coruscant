---
phase: 2
slug: core-ui-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/backend/vitest.config.ts` (backend) + `packages/frontend/vitest.config.ts` (Wave 0 install) |
| **Quick run command** | `npm run test --workspace=packages/backend` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=packages/backend`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | DASH-01 | unit | `npm run test --workspace=packages/frontend` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | DASH-02 | unit | `npm run test --workspace=packages/frontend -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | DASH-03 | unit | `npm run test --workspace=packages/frontend -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | DASH-04 | unit | `npm run test --workspace=packages/backend -- --reporter=verbose` | ✅ | ⬜ pending |
| 2-02-02 | 02 | 1 | DASH-05 | unit | `npm run test --workspace=packages/backend -- --reporter=verbose` | ✅ | ⬜ pending |
| 2-03-01 | 03 | 2 | DASH-06 | manual | — | — | ⬜ pending |
| 2-03-02 | 03 | 2 | DASH-07 | manual | — | — | ⬜ pending |
| 2-03-03 | 03 | 2 | DASH-08 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/frontend/vitest.config.ts` — jsdom environment config for React component tests
- [ ] `packages/frontend/src/test/setup.ts` — @testing-library/jest-dom matchers
- [ ] Install `jsdom`, `@testing-library/react`, `@testing-library/user-event` in frontend package

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Animated grid at 60fps on physical mobile device | DASH-08 | GPU/display performance not testable in jsdom | Open dashboard on iPhone, observe animation smoothness in browser DevTools timeline |
| Now Playing banner 60fps scroll | DASH-07 | Scroll performance requires physical device | Expand banner with 2 mock streams, scroll content, verify no jank |
| Card border trace animation visual quality | DASH-02 | Visual fidelity not assertable via unit tests | Open in Chrome, observe Tron-blue border trace on each card |
| Browser back returns to scroll position | DASH-05 | Navigation/scroll restoration requires real browser | Scroll dashboard, tap card, press back, verify scroll position preserved |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
