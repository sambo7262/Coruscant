---
phase: 8
slug: logging-polish-performance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (backend) / `vitest.config.ts` (frontend) |
| **Quick run command** | `npm run test --workspace=backend -- --run` |
| **Full suite command** | `npm run test --workspaces -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=backend -- --run`
- **After every plan wave:** Run `npm run test --workspaces -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-W0-01 | 01 | 0 | LOG-01 | unit | `npm run test --workspace=backend -- --run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 08-W0-02 | 01 | 0 | LOG-02 | unit | `npm run test --workspace=backend -- --run` | ❌ W0 | ⬜ pending |
| 08-W0-03 | 01 | 0 | LOG-03 | unit | `npm run test --workspace=backend -- --run` | ❌ W0 | ⬜ pending |
| 08-W0-04 | 01 | 0 | LOG-04 | unit | `npm run test --workspace=backend -- --run` | ❌ W0 | ⬜ pending |
| 08-W0-05 | 02 | 0 | PERF-01 | unit | `npm run test --workspace=backend -- --run` | ❌ W0 | ⬜ pending |
| 08-W0-06 | 02 | 0 | PERF-02 | unit | `npm run test --workspace=backend -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/db/__tests__/logging.test.ts` — unit tests for `app_logs` insert, query, purge (LOG-01, LOG-02, LOG-03)
- [ ] `backend/src/db/__tests__/kv-store.test.ts` — unit tests for `kv_store` get/set (LOG-04 retention key)
- [ ] `backend/src/__tests__/sse-fingerprint.test.ts` — unit tests for change-detection fingerprint logic (PERF-01)
- [ ] `backend/src/__tests__/polling-intervals.test.ts` — verify interval constants match D-01 targets (PERF-02)

*Existing vitest infrastructure assumed — Wave 0 adds test stubs only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plex stream banner appears ≤3s after stream start | PERF-01 | Requires live Plex session | Start a stream in Plex; time from play to banner appearing on dashboard |
| SABnzbd download progress updates smoothly | PERF-01 | Requires active download | Start a download; verify progress bar moves without stale flashes |
| Log viewer filtered by service shows only that service's entries | LOG-01 | UI interaction | Open log viewer, select a service filter, verify only matching rows show |
| Log purge via age threshold reflects immediately | LOG-02 | UI interaction | Select 1-day threshold, confirm purge, verify old entries gone from viewer |
| No polling flicker at kiosk distance | PERF-02 | Visual / subjective | View dashboard on phone at arm's length; verify no visible stale flash |
| SQLite WAL mode active | LOG-03 | Requires DB inspection | `sqlite3 data/coruscant.db 'PRAGMA journal_mode;'` → must return `wal` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
