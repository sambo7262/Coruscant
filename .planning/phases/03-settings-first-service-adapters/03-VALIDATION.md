---
phase: 3
slug: settings-first-service-adapters
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (backend + frontend) |
| **Config file** | `packages/backend/vitest.config.ts` / `packages/frontend/vite.config.ts` |
| **Quick run command** | `npm run test --workspace=packages/backend` |
| **Full suite command** | `npm run test` (root workspace — runs all packages) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=packages/backend`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-schema-01 | schema | 1 | CFG-01 | unit | `npm run test --workspace=packages/backend -- --reporter=verbose` | ✅ | ⬜ pending |
| 3-encrypt-01 | schema | 1 | CFG-04 | unit | `npm run test --workspace=packages/backend -- --reporter=verbose` | ✅ | ⬜ pending |
| 3-poll-01 | adapters | 2 | SVCST-01 | unit | `npm run test --workspace=packages/backend -- --reporter=verbose` | ✅ | ⬜ pending |
| 3-poll-02 | adapters | 2 | SVCACT-01 | unit | `npm run test --workspace=packages/backend -- --reporter=verbose` | ✅ | ⬜ pending |
| 3-settings-api-01 | api | 2 | CFG-03 | integration | `npm run test --workspace=packages/backend -- --reporter=verbose` | ✅ | ⬜ pending |
| 3-sse-01 | sse | 3 | SVCST-03 | integration | `npm run test --workspace=packages/backend -- --reporter=verbose` | ✅ | ⬜ pending |
| 3-ui-01 | settings-ui | 3 | CFG-01 | e2e-manual | — | — | ⬜ pending |
| 3-ui-02 | settings-ui | 3 | CFG-03 | e2e-manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/src/services/__tests__/arrAdapter.test.ts` — stubs for SVCST-01, SVCST-02, SVCST-04
- [ ] `packages/backend/src/services/__tests__/sabnzbdAdapter.test.ts` — stubs for SVCACT-01, SVCACT-02
- [ ] `packages/backend/src/services/__tests__/pollManager.test.ts` — stubs for SVCST-05, SVCACT-03
- [ ] `packages/backend/src/services/__tests__/encryption.test.ts` — stubs for CFG-04
- [ ] `packages/backend/src/routes/__tests__/settings.test.ts` — stubs for CFG-01, CFG-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings tab LED updates after save within one poll interval | SVCST-03 | Requires live service + real-time SSE observation | 1. Configure a real Radarr URL+key. 2. Press SAVE. 3. Verify dashboard card LED changes color within 60s. |
| "NOT CONFIGURED" card deep-links to correct Settings tab | CFG-01 | Navigation behavior needs browser interaction | 1. Ensure a service has no config. 2. Click its dashboard card. 3. Verify `/settings?service={name}` and correct tab is active. |
| API key masked by default, eye icon toggles visibility | CFG-04 | DOM input type inspection | 1. Open Settings for any service. 2. Verify key field is `type="password"`. 3. Click eye icon. 4. Verify field changes to `type="text"`. |
| Settings survive container restart | CFG-01, CFG-03 | Requires actual Docker restart | 1. Save config for all services. 2. Run `docker compose restart`. 3. Verify all fields are populated and LEDs reflect last-known state. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
