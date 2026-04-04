---
phase: 4
slug: rich-service-integrations
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 4-01-01 | 01 | 0 | SVCRICH-01 | unit | `npm run test -- src/adapters/pihole` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | SVCRICH-01 | unit | `npm run test -- src/adapters/pihole` | ✅ | ⬜ pending |
| 4-02-01 | 02 | 0 | SVCRICH-02 | unit | `npm run test -- src/adapters/plex` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | SVCRICH-02 | unit | `npm run test -- src/adapters/plex` | ✅ | ⬜ pending |
| 4-03-01 | 03 | 0 | SVCRICH-03 | unit | `npm run test -- src/adapters/synology` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 1 | SVCRICH-03 | unit | `npm run test -- src/adapters/synology` | ✅ | ⬜ pending |
| 4-04-01 | 04 | 1 | SVCRICH-04 | manual | — | — | ⬜ pending |
| 4-05-01 | 05 | 2 | SVCRICH-05 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/adapters/__tests__/pihole.test.ts` — unit stubs for SVCRICH-01 (v6 auth, summary, blocking state)
- [ ] `src/adapters/__tests__/plex.test.ts` — unit stubs for SVCRICH-02 (sessions endpoint, JSON header)
- [ ] `src/adapters/__tests__/synology.test.ts` — unit stubs for SVCRICH-03 (auth sid, utilization, disk temps)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NAS amber stale-data state when DSM session expires | SVCRICH-04 | Requires live DSM session timeout (cannot mock accurately) | Let NAS credentials expire, confirm card shows amber indicator |
| Now Playing banner scrolls with live stream data | SVCRICH-02 | Visual animation requires live Plex stream | Start a stream in Plex, confirm banner animates and shows title |
| Detail view shows all expanded metrics on tap | SVCRICH-05 | Visual/interaction test | Tap each rich card, confirm detail panel opens with full metrics |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
