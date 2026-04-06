---
phase: 10
slug: production-deploy-and-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-00-01 | 00 | 0 | — | unit | `npm run test -- plex-adapter` | ✅ | ⬜ pending |
| 10-00-02 | 00 | 0 | — | unit | `npm run test -- nas-adapter` | ✅ | ⬜ pending |
| 10-00-03 | 00 | 0 | — | unit | `npm run test -- arr-webhooks` | ✅ | ⬜ pending |
| 10-00-04 | 00 | 0 | — | unit | `npm run test -- sse` | ✅ | ⬜ pending |
| 10-01-01 | 01 | 1 | PROD-01 | smoke | `grep "v1.0.0" compose.yaml` | N/A | ⬜ pending |
| 10-01-02 | 01 | 1 | PROD-01 | manual | Push v1.0.0 tag, verify Docker Hub | N/A | ⬜ pending |
| 10-02-01 | 02 | 2 | PROD-02 | smoke | `git branch -r \| grep worktree` returns empty | N/A | ⬜ pending |
| 10-02-02 | 02 | 2 | PROD-02 | smoke | `grep ".planning" .gitignore` | N/A | ⬜ pending |
| 10-03-01 | 03 | 3 | PROD-03 | unit | `npm run test -- arr-webhooks` | ✅ | ⬜ pending |
| 10-03-02 | 03 | 3 | PROD-03 | unit | `npm run test -- tautulli-webhook` | ✅ | ⬜ pending |
| 10-04-01 | 04 | 3 | — | manual | Browser smoke test on NAS | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/tests/plex-adapter.test.ts` — fix 3 failures: `fetchPlexServerStats` mock shape mismatch
- [ ] `packages/backend/tests/nas-adapter.test.ts` — fix 2 failures: `fetchNasDockerStats` sync mock issue
- [ ] `packages/backend/tests/arr-webhooks.test.ts` — fix 5 failures: stale logging format assertions
- [ ] `packages/backend/tests/sse.test.ts` — fix 6 failures: `ERR_HTTP_HEADERS_SENT` timing issue

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI builds versioned image on v* tag push | PROD-01 | Requires actual git push + Docker Hub check | Push `v1.0.0` tag, verify both `v1.0.0` and `latest` tags appear on Docker Hub |
| Worktree branches deleted from origin | PROD-02 | Destructive remote operation | Run `git branch -r \| grep worktree`, expect empty output |
| MediaStackRow LED glow matches other tiles | — | Visual/aesthetic judgment | Open dashboard, compare media stack LED glow to Pi-hole/NAS tiles |
| App loads and functions after v1.0 deploy | PROD-01 | Full integration smoke test | Pull image, compose up, open in browser, confirm all tiles render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
