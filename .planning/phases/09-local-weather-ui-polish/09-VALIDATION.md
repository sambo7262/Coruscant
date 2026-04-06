---
phase: 9
slug: local-weather-ui-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (root or packages/backend) |
| **Quick run command** | `npm run test --workspace=packages/backend -- --run` |
| **Full suite command** | `npm run test --workspace=packages/backend -- --run && npm run test --workspace=packages/frontend -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=packages/backend -- --run`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-weather-01 | weather-backend | 1 | WTHR-01 | unit | `npm run test --workspace=packages/backend -- --run --grep "weather"` | ❌ W0 | ⬜ pending |
| 09-weather-02 | weather-backend | 1 | WTHR-01 | unit | `npm run test --workspace=packages/backend -- --run --grep "geocode"` | ❌ W0 | ⬜ pending |
| 09-weather-03 | weather-backend | 2 | WTHR-01 | unit | `npm run test --workspace=packages/backend -- --run --grep "weatherPoller"` | ❌ W0 | ⬜ pending |
| 09-weather-04 | weather-frontend | 3 | WTHR-01 | manual | Visual check: AppHeader shows temp + icon | N/A | ⬜ pending |
| 09-weather-05 | weather-frontend | 3 | WTHR-02 | manual | Visual check: stale indicator appears on fetch failure | N/A | ⬜ pending |
| 09-settings-01 | settings-restructure | 2 | WTHR-02 | manual | Visual check: side rail renders all 5 sections | N/A | ⬜ pending |
| 09-polish-01 | ui-polish | 3 | WTHR-02 | manual | Visual check: 15 micro-issues resolved (see RESEARCH.md) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/src/adapters/__tests__/weather.test.ts` — stubs for WTHR-01 weather fetch + geocoding
- [ ] `packages/backend/src/adapters/__tests__/weatherPoller.test.ts` — poller interval + kvStore write stubs

*Existing vitest infrastructure covers backend test patterns — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AppHeader weather widget renders temp + animated icon | WTHR-01 | Visual/browser — CSS animation not testable in vitest | Open dashboard, verify right-column shows temp and icon animating |
| Weather stale indicator on fetch failure | WTHR-01 | Requires network failure simulation | Kill Open-Meteo (block via /etc/hosts), verify header shows last-known + StaleIndicator |
| Settings side-rail renders 5 sections | WTHR-02 | Visual layout — CSS layout not unit-testable | Open Settings page, verify MEDIA/NETWORK/SYSTEM/NOTIFICATIONS/LOGS sections in side rail |
| DOWNLOADS tile max-height matches NETWORK | WTHR-02 | Visual/pixel — layout comparison | Expand downloads list; verify tile doesn't extend below NETWORK tile bottom edge |
| Disconnect dot is visibly red and 10px | WTHR-02 | Visual/pixel | Disconnect from backend; verify header dot is red with glow, not amber |
| Speed numbers colored (blue DL, amber UL) | WTHR-02 | Visual | Active download in progress; verify speed text colors |
| Webhook log rows distinguishable | WTHR-02 | Visual/log viewer | Trigger Radarr webhook; verify `[WEBHOOK] RADARR → grab → "..."` format in log viewer |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
