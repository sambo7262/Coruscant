---
phase: 5
slug: ui-v2-instrument-panel-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (root workspace config) |
| **Config file** | `/vitest.config.ts` (root, covers `packages/*/src/__tests__/**/*.test.ts`) |
| **Quick run command** | `npm run test -- --reporter=verbose 2>&1 \| tail -20` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| SABnzbd filename/ETA fields | 01 | 1 | DASH-05 | unit | `npm run test -- packages/backend/src/__tests__/sabnzbd-adapter.test.ts` | Yes (extend) | ⬜ pending |
| SABnzbd LED/text color fix | 01 | 1 | DASH-05 | unit | `npm run test -- packages/backend/src/__tests__/sabnzbd-adapter.test.ts` | Yes (extend) | ⬜ pending |
| Arr LED green when idle | 02 | 1 | DASH-05 | unit | `npm run test` | Partial | ⬜ pending |
| Plex mediaType/audio fields | 03 | 1 | DASH-06 | unit | `npm run test -- packages/backend/src/__tests__/plex-adapter.test.ts` | Yes (extend) | ⬜ pending |
| NAS Docker stats | 04 | 1 | DASH-03 | unit | `npm run test -- packages/backend/src/__tests__/nas-adapter.test.ts` | Yes (extend) | ⬜ pending |
| Dashboard no-scroll at 800×480 | — | — | DASH-01 | manual | Chrome DevTools viewport 800×480 | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/src/__tests__/sabnzbd-adapter.test.ts` — add test cases for `currentFilename` and `timeLeft` field extraction from slot data
- [ ] `packages/backend/src/__tests__/plex-adapter.test.ts` — add test cases for `mediaType: 'audio'`, `albumName`, `trackTitle`, and correct `season`/`episode` = `undefined` for track type
- [ ] `packages/backend/src/__tests__/nas-adapter.test.ts` — add test for `checkNasImageUpdates` field name variant; test Docker stats aggregation shape

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard fits 800×480 without scrolling | DASH-01 | Visual layout check | Open Chrome DevTools → Device Toolbar → set 800×480 → verify no scrollbars on dashboard page |
| LED breathing animations correct per status | DASH-02 | Animation timing | Load dashboard with each service status and verify LED pulse rate/color matches D-12 spec |
| Touch targets 44×44px minimum | DASH-03 | Physical device | Test on Pi touchscreen: tap header expand, rail expand, card navigation — all must be hittable comfortably |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
