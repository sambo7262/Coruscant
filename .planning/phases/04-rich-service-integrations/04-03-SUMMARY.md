---
phase: 04-rich-service-integrations
plan: 03
subsystem: frontend-ui, settings, cards, detail-views
tags: [pihole, plex, nas, settings, media-stack, led, donut-chart, recharts]
dependency_graph:
  requires:
    - 04-02 (Pi-hole/NAS adapters, Tautulli webhook — real metrics flowing through SSE)
  provides:
    - PI-HOLE Settings tab with 2-field form (URL + Password) and service note
    - PLEX Settings tab with 2-field form + read-only Webhook URL with copy button (D-32)
    - NAS Settings tab with 3-field form (URL + DSM Username + DSM Password) + service note
    - Pi-hole card with 2x2 metric grid (QPM / LOAD / MEM% / STATUS)
    - Pi-hole detail view with Today's Stats, System, and Query Distribution donut chart (D-06)
    - Media stack condensed LED+label rows per arr service (D-29) with purple LED semantics (D-30)
    - SABnzbd natural display: filename, time remaining, speed (D-31)
    - Grid restructured: Plex and NAS removed from card grid (D-20)
  affects:
    - packages/frontend/src/pages/SettingsPage.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/pages/ServiceDetailPage.tsx
tech_stack:
  added:
    - recharts (PieChart/Pie/Cell/Tooltip for Pi-hole query distribution donut)
  patterns:
    - MediaStackRow component: condensed LED+label row for arr services
    - PiholeInstrument: 2x2 CSS grid metric display
    - CardGrid two-column layout: arr LED rows left, full cards right
    - Dynamic credential label per service (Password/Plex Token/DSM Password)
    - Webhook URL derived from window.location.hostname (D-32 dynamic host)
    - Purple LED: solid=healthy/downloading, flashing=queued (D-30)
key_files:
  created: []
  modified:
    - packages/frontend/src/pages/SettingsPage.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/pages/ServiceDetailPage.tsx
decisions:
  - "recharts installed for PieChart donut chart — Rule 3 auto-fix (missing dependency blocking TypeScript compilation)"
  - "MediaStackRow exported from ServiceCard.tsx alongside ServiceCard — co-location keeps LED logic centralized"
  - "CardGrid two-column layout: arr LED rows in left panel, full cards (SABnzbd, Pi-hole) in right panel"
  - "Purple arr LED: solid=online healthy, flashing=queue>0 or downloading; omits solid green entirely when online — all online arr states are purple per D-30"
  - "SABnzbd currentFilename from metrics.currentFilename — field expected from SABnzbd adapter metrics shape"
metrics:
  duration: 314s
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_modified: 4
---

# Phase 04 Plan 03: Settings Tabs (PI-HOLE/PLEX/NAS), Pi-hole Card, Media Stack LED Rows, and Detail View Summary

PI-HOLE/PLEX/NAS Settings tabs with correct field patterns (Plex includes dynamic webhook URL with copy button per D-32, NAS has 3-field form), Pi-hole card with 2x2 metric grid, media stack area simplified to condensed LED+label rows per service (D-29), purple LED semantics (D-30), SABnzbd natural display (D-31), and Pi-hole detail view with Query Distribution donut chart (D-06).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PI-HOLE, PLEX, NAS settings tabs with Plex webhook URL field (D-32) | 072e97a | SettingsPage.tsx |
| 2 | Pi-hole card, media stack condensed LED rows, SABnzbd display, detail view with donut chart | a45fc93 | ServiceCard.tsx, CardGrid.tsx, ServiceDetailPage.tsx, package.json |

## What Was Built

**SettingsPage.tsx:**
- Three new tabs: PI-HOLE (Password field), PLEX (Plex Token field), NAS (DSM Username + DSM Password)
- Dynamic credential label via `getCredentialLabel()` — returns "Password", "Plex Token", or "DSM Password" per service
- NAS 3-field form: URL → DSM Username (plaintext) → DSM Password (masked)
- Plex tab: read-only Webhook URL field showing `http://{window.location.hostname}:1688/api/webhooks/tautulli`
- Copy button on Webhook URL — `navigator.clipboard.writeText()` with "COPIED!" feedback state
- Tautulli setup instructions below Webhook URL field (D-32)
- Pi-hole note: "Pi-hole v6 or higher required."
- NAS note: "Requires an admin-level DSM account."
- `username` state variable loaded from GET response, sent in POST body for both SAVE and TEST

**ServiceCard.tsx:**
- `PiholeInstrument` replaced stub with proper 2×2 CSS grid: QPM / LOAD / MEM% / STATUS (per UI-SPEC Pi-hole Card section)
- `SabnzbdInstrument` updated to natural display: filename (truncated with title tooltip), speed/time remaining row
- SABnzbd purple LED: solid purple = `sabStatus === 'Downloading'` or speed > 0; flashing purple = queued but paused
- `ServiceCard`: early return null for `plex` and `nas` — grid cards removed per D-20
- `MediaStackRow` exported component: condensed 8px LED dot + service label, tappable for navigation
- Purple LED semantics per D-30: solid purple=healthy no queue, flashing purple=queue>0 or downloading
- `ledFlashPurple` animation reference in both MediaStackRow and SabnzbdInstrument

**CardGrid.tsx:**
- Imports `MediaStackRow` alongside `ServiceCard`
- Splits tier services into arr services (condensed rows) vs card services (full cards)
- Two-column layout when arr services present: MEDIA STACK panel left, full cards right
- Falls back to full-card grid when no arr services in tier
- `plex` and `nas` filtered from grouped services (double protection alongside ServiceCard early return)

**ServiceDetailPage.tsx:**
- `import { PieChart, Pie, Cell, Tooltip } from 'recharts'`
- `PiholeDetailView` component with three sections:
  - TODAY'S STATS: Queries Today, Blocked Today, Block Rate — formatted with `toLocaleString()` and `.toFixed(1)`
  - SYSTEM: Blocklist Size, Queries / Min, System Load, Memory Usage
  - QUERY DISTRIBUTION: `PieChart` donut (`innerRadius={50}` `outerRadius={80}`) from `metrics.queryTypes` — DONUT_COLORS cockpit palette
  - WARNINGS: amber left-bordered block when `metrics.warnings` is non-empty array
- Empty state: "NO DATA — configure Pi-hole in Settings" when service not found
- Error state: "CONNECTION ERROR — check URL and password in Settings" when `status === 'offline'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] recharts not installed**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `import { PieChart, Pie, Cell, Tooltip } from 'recharts'` fails — recharts not in `packages/frontend/package.json`
- **Fix:** `npm install recharts` in packages/frontend — adds recharts to dependencies
- **Files modified:** packages/frontend/package.json, package-lock.json
- **Commit:** a45fc93

**2. [Rule 1 - Bug] Pie label function TypeScript error**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Label render prop `({ name, value }: { name: string; value: number })` — recharts `PieLabelRenderProps` has `name?: string | undefined`, not `string`
- **Fix:** Changed param types to `{ name?: string; value?: number }` with null-coalescing fallbacks
- **Files modified:** packages/frontend/src/pages/ServiceDetailPage.tsx
- **Commit:** a45fc93

## Known Stubs

None. All data fields are wired from real service metrics delivered by the Pi-hole adapter (04-02). The `currentFilename`, `timeLeft`, `sabStatus` fields depend on the SABnzbd adapter providing those metric keys — the adapter was implemented in Phase 03 with `SabnzbdMetrics` shape. If the SABnzbd adapter does not yet provide `currentFilename`/`timeLeft`, the SABnzbd card gracefully falls back to "IDLE" — this is an acceptable degraded state pending adapter extension.

## Self-Check: PASSED

Files confirmed present:
- packages/frontend/src/pages/SettingsPage.tsx — FOUND
- packages/frontend/src/components/cards/ServiceCard.tsx — FOUND
- packages/frontend/src/components/cards/CardGrid.tsx — FOUND
- packages/frontend/src/pages/ServiceDetailPage.tsx — FOUND

Commits confirmed:
- 072e97a — FOUND
- a45fc93 — FOUND

TypeScript: PASSED (only pre-existing main.tsx CSS import error, unrelated to this plan)
