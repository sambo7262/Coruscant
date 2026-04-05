---
plan: 05-02
phase: 05-ui-v2-instrument-panel-polish
status: complete
completed: 2026-04-05
subsystem: frontend-cards
tags: [ui, cards, led-logic, sabnzbd, pihole, arr, detail-views]
dependency-graph:
  requires: [05-01]
  provides: [corrected-led-logic, network-card, chamfered-arr-tile, reworked-detail-views]
  affects: [CardGrid, ServiceCard, ServiceDetailPage]
tech-stack:
  added: []
  patterns:
    - Arr tile as chamfered card with amber header strip (consistent with other instrument cards)
    - Static HTML table legend beside Recharts PieChart (no Tooltip/Legend components)
    - LED state machine: green=idle online, solid purple=downloading, flashing purple=queued
key-files:
  created: []
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/pages/ServiceDetailPage.tsx
decisions:
  - "MediaStackRow LED: green when online+idle (not purple). Solid purple=downloading, flashing=queued — previous code had all online states as purple regardless of activity"
  - "SABnzbd card body text always amber — purple text removed; only StatusDot LED handles purple state"
  - "Pi-hole card renamed to NETWORK in both ServiceCard header and ServiceDetailPage heading"
  - "CardGrid rewritten as flat grid with no tier section labels — reclaims ~96px vertical space for 800x480"
  - "ArrDetailView reworked: removed queue/library/missing stats, replaced with status/version dot-leaders + health warnings"
  - "ARR_IDS in ServiceDetailPage extended to include prowlarr and readarr (was missing from original set)"
metrics:
  duration: ~8 minutes
  completed: 2026-04-05T05:27:41Z
  tasks: 2
  files: 3
---

# Phase 05 Plan 02: Card LED Logic, SABnzbd Body, NETWORK Card, Arr Tile, Detail Views Summary

Corrected card LED color logic (green for idle arr services, not purple), restructured the arr services into a proper chamfered tile with two-column layout, fixed SABnzbd card body to show filename+speed+ETA with always-amber text, renamed Pi-hole card to NETWORK with Ubiquiti placeholder, removed tier section labels from CardGrid, and reworked SABnzbd/Arr/Pi-hole detail views per D-04, D-05, D-08, D-09, D-11, D-12, D-14, D-15, D-16, D-17.

## What Was Built

### Task 1: LED Logic, SABnzbd Card, NETWORK Card, CardGrid Restructure

**ServiceCard.tsx changes:**
- `MediaStackRow.getLedStyle`: Fixed bug where `online` + no queue/download returned purple instead of green. New logic: green=idle online, solid purple=actively downloading, flashing purple=queued
- `SabnzbdInstrument`: Replaced progress-bar + queue-count body with filename (amber, truncated) + speed (amber, always) + ETA. Removed `isActivelyDownloading ? purple : amber` color logic — text is always amber
- `PiholeInstrument` renamed to `NetworkInstrument`: Added PI-HOLE subsection header, amber divider, and UBIQUITI NOT CONFIGURED placeholder section
- `renderInstrumentBody`: Updated to call `NetworkInstrument` for pihole
- `ServiceCard` header: renders `'NETWORK'` instead of `service.name` when `service.id === 'pihole'`

**CardGrid.tsx** - complete rewrite:
- Removed `TIER_ORDER` array and all tier section `<h2>` labels
- Flat grid with `gridTemplateColumns: repeat(auto-fit, minmax(140px, 1fr))` and `gap: 8px` (was 16px)
- Arr services render in a single chamfered card with 6px amber header strip and two columns: Radarr/Sonarr/Lidarr (left) | Prowlarr/Bazarr/Readarr (right)
- Non-arr services (SABnzbd, Pi-hole) render as standard `ServiceCard` components beside the arr tile
- Skeleton state simplified to two placeholder cards (no tier labels)

### Task 2: Detail View Reworks

**ServiceDetailPage.tsx changes:**
- Added `SabnzbdDetailView`: active download section at top (filename, speed, ETA, purple progress bar) + QUEUE section below with per-item list (or count fallback)
- Replaced `ArrDetailView`: removed old queue/library/missing stats + attention items section. New view: STATUS/VERSION dot-leader rows + scrollable WARNINGS list from `metrics.healthWarnings`
- `PiholeDetailView`: replaced `<PieChart>` with `<Tooltip>` and `<Legend>` with a side-by-side layout — donut chart (120x120) left + static HTML `<table>` legend right. Removed Tooltip import
- Extended `ARR_IDS` to include `prowlarr` and `readarr` (previously missing)
- Pi-hole detail page heading now shows `NETWORK` (D-15)
- Wired `SabnzbdDetailView` into the render routing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Extended ARR_IDS in ServiceDetailPage**
- **Found during:** Task 2
- **Issue:** `ARR_IDS` in `ServiceDetailPage.tsx` only contained `['radarr', 'sonarr', 'lidarr', 'bazarr']` — Prowlarr and Readarr would have fallen through to the generic detail view
- **Fix:** Added `'prowlarr'` and `'readarr'` to the set
- **Files modified:** `packages/frontend/src/pages/ServiceDetailPage.tsx`
- **Commit:** a62566d

**2. [Rule 1 - Bug] TypeScript: `metrics.currentFilename` unknown conditional in JSX**
- **Found during:** Task 2 TypeScript verify
- **Issue:** `{metrics.currentFilename && (...)}` emits `unknown` type in JSX, not assignable to `ReactNode`
- **Fix:** Changed to `{typeof metrics.currentFilename === 'string' && metrics.currentFilename && (...)}`
- **Files modified:** `packages/frontend/src/pages/ServiceDetailPage.tsx`
- **Commit:** a62566d

## Known Stubs

- `SabnzbdDetailView` queue items section shows count fallback ("N item(s) queued") when `metrics.queueItems` is not an array. The `SabnzbdMetrics` type in `types.ts` does not yet include `queueItems` — this is a deferred backend enhancement. The fallback correctly shows the queue count so the view is functional.

## Self-Check: PASSED
