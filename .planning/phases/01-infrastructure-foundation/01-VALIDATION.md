---
phase: 1
slug: infrastructure-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (Wave 0 creates) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | INFRA-01 | file existence | `test -f compose.yaml` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | INFRA-01 | file existence | `test -f Dockerfile` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | INFRA-02 | integration | `docker compose up -d && docker compose exec app test -f /app/data/coruscant.db` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | INFRA-03 | CI check | `gh run view --exit-status` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | INFRA-04 | manual | see manual section | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test framework config
- [ ] `package.json` `test` script pointing to vitest
- [ ] `tests/` directory with placeholder stubs for INFRA-01 through INFRA-03

*Existing infrastructure covers none — project is greenfield.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tailscale WAN access | INFRA-04 | Requires physical NAS + Tailscale device enrollment | 1. Deploy to NAS. 2. Access dashboard via Tailscale IP from external device. 3. Confirm page loads. |
| NAS UID/GID permissions | INFRA-01 | Requires SSH into NAS to verify owner of bind-mount dir | 1. SSH to NAS. 2. `ls -la /volume1/docker/coruscant/data`. 3. Confirm UID/GID matches .env PUID/PGID. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
