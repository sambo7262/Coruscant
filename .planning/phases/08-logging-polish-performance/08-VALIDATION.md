---
phase: 8
slug: logging-polish-performance
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| 08-01-T1 | 01 | 1 | LOG-01, LOG-02, LOG-03, LOG-04 | unit | `npm run test --workspace=backend -- --run --reporter=verbose` | Plan 01 creates test files | pending |
| 08-01-T2 | 01 | 1 | PERF-01, PERF-02 | unit + grep | `npm run test --workspace=backend -- --run` | Covered by 01-T1 tests + acceptance grep checks | pending |
| 08-02-T1 | 02 | 1 | PERF-02 | manual | `test -f theme-preview.html` | Plan 02 creates file | pending |
| 08-03-T1 | 03 | 2 | LOG-01 | grep | `grep -c 'log-entry' packages/frontend/src/hooks/useDashboardSSE.ts` | N/A (wiring) | pending |
| 08-03-T2 | 03 | 2 | LOG-01, LOG-02, LOG-03, LOG-04 | grep + suite | `npm run test --workspaces -- --run` | N/A (UI) | pending |
| 08-04-T1 | 04 | 3 | PERF-02 | grep + suite | `npm run test --workspaces -- --run` | N/A (UI) | pending |
| 08-04-T2 | 04 | 3 | PERF-02 | suite | `npm run test --workspaces -- --run` | N/A (audit) | pending |
| 08-05-T1 | 05 | 4 | ALL | human-verify | Manual checkpoint | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Wave 0 is satisfied by Plan 08-01 Task 1, which creates test files inline:

- [x] `packages/backend/src/__tests__/log-transport.test.ts` — unit tests for pino-to-SQLite transport (LOG-01 capture, level filtering per D-25)
- [x] `packages/backend/src/__tests__/logs.test.ts` — unit tests for log API routes: GET /api/logs, POST /api/logs/purge, GET /api/logs/export, GET/POST /api/settings/logs-retention (LOG-02, LOG-03, LOG-04)

SSE fingerprint change detection (PERF-01) is covered by acceptance criteria grep checks in Plan 08-01 Task 2, plus human verification in Plan 08-05. An automated smoke test for SSE change detection is included in 08-01 Task 2 verify via the full backend test suite.

Polling interval correctness (PERF-02) is verified by acceptance criteria grep checks in Plan 08-01 Task 2 (exported constants match D-01 targets).

*No separate Wave 0 plan needed — test stubs are created within Plan 08-01 Task 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plex stream banner appears <=3s after stream start | PERF-01 | Requires live Plex session | Start a stream in Plex; time from play to banner appearing on dashboard |
| SABnzbd download progress updates smoothly | PERF-01 | Requires active download | Start a download; verify progress bar moves without stale flashes |
| Log viewer filtered by service shows only that service's entries | LOG-01 | UI interaction | Open log viewer, select a service filter, verify only matching rows show |
| Log purge via age threshold reflects immediately | LOG-02 | UI interaction | Select 1-day threshold, confirm purge, verify old entries gone from viewer |
| No polling flicker at kiosk distance | PERF-02 | Visual / subjective | View dashboard on phone at arm's length; verify no visible stale flash |
| SQLite WAL mode active | LOG-03 | Requires DB inspection | `sqlite3 data/coruscant.db 'PRAGMA journal_mode;'` -> must return `wal` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (revised per checker feedback)
