---
phase: 02-core-ui-shell
plan: 09
subsystem: frontend-ui
tags: [cockpit-aesthetic, restyle, banner, stream-row, detail-page, stale-indicator]
dependency_graph:
  requires: [02-06, 02-07]
  provides: [cockpit-styled-now-playing-banner, cockpit-styled-stream-rows, dot-leader-detail-page, cockpit-stale-badge]
  affects: [frontend-ui-shell]
tech_stack:
  added: []
  patterns: [cockpit-amber-palette, dot-leader-readout, utilitarian-stream-format]
key_files:
  created: []
  modified:
    - packages/frontend/src/components/layout/NowPlayingBanner.tsx
    - packages/frontend/src/components/layout/StreamRow.tsx
    - packages/frontend/src/pages/ServiceDetailPage.tsx
    - packages/frontend/src/components/ui/StaleIndicator.tsx
decisions:
  - "Back button removed from ServiceDetailPage — AppHeader showBack prop handles back navigation on all sub-pages (D-37)"
  - "StreamRow restructured to single row (USER > TITLE left, QUAL/DIRECT right) with 1px amber progress line below"
metrics:
  duration: 124s
  completed: "2026-04-03"
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 09: Cockpit Retheme — Banner, Stream Rows, Detail Page, Stale Badge Summary

**One-liner:** Completed cockpit retheme of all remaining UI surfaces — NowPlayingBanner with amber chrome, StreamRow in USER > TITLE utilitarian format with 1px progress bar, ServiceDetailPage with dot-leader LABEL...VALUE readouts, and StaleIndicator restyled as amber badge.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restyle NowPlayingBanner and StreamRow | 07f6ba5 | NowPlayingBanner.tsx, StreamRow.tsx |
| 2 | Restyle ServiceDetailPage and StaleIndicator | 8bc2920 | ServiceDetailPage.tsx, StaleIndicator.tsx |

## What Was Built

### NowPlayingBanner.tsx
- Banner border-top changed from cyan `rgba(0,200,255,0.15)` to amber `rgba(232,160,32,0.30)`
- Stream count label: `var(--cockpit-amber)` (was `var(--tron-blue)`)
- Ticker text: `var(--text-offwhite)` (was `var(--text-muted)`)
- Expanded drawer gets `borderTop: '1px solid var(--cockpit-amber)'`

### StreamRow.tsx
- Restructured to single header row: `USER > TITLE` left-aligned, `QUAL / DIRECT` right-aligned
- User name: `var(--cockpit-amber)`; title text: `var(--text-offwhite)`
- DIRECT label: `var(--cockpit-green)`; TRANSCODE label: `var(--cockpit-amber)`
- Progress bar reduced from 4px to 1px; fill changed from tron-blue to `var(--cockpit-amber)`
- Row divider: `rgba(232,160,32,0.08)` amber

### ServiceDetailPage.tsx
- Removed standalone back button (AppHeader `showBack` prop handles back navigation per D-37)
- Page title: uppercase, `var(--cockpit-amber)`
- All five metric readout rows now use dot-leader format: `LABEL ... VALUE`
  - Label: `var(--text-offwhite)`, uppercase
  - Dot leader: `1px dotted rgba(232,160,32,0.20)`
  - Value: `var(--cockpit-amber)`
- Footer placeholder text: `var(--text-offwhite)`

### StaleIndicator.tsx
- Color: `var(--cockpit-amber)` (was `var(--tron-amber)`)
- Border: `1px solid var(--cockpit-amber)` (was rgba(255,170,0,0.3))
- Padding reduced to `1px 6px`; added `textTransform: 'uppercase'`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- ServiceDetailPage metric rows (Response Time, Uptime, Version) show `---` placeholders — intentional, real data wired in Phase 3+ service integrations.

## Self-Check: PASSED

Files verified:
- packages/frontend/src/components/layout/NowPlayingBanner.tsx — exists, contains cockpit-amber
- packages/frontend/src/components/layout/StreamRow.tsx — exists, contains cockpit-amber, 1px, cockpit-green
- packages/frontend/src/pages/ServiceDetailPage.tsx — exists, contains dotted, cockpit-amber, no standalone back button
- packages/frontend/src/components/ui/StaleIndicator.tsx — exists, contains cockpit-amber, uppercase

Commits verified:
- 07f6ba5 — feat(02-09): restyle NowPlayingBanner and StreamRow for cockpit aesthetic
- 8bc2920 — feat(02-09): restyle ServiceDetailPage with dot-leader readouts and update StaleIndicator
