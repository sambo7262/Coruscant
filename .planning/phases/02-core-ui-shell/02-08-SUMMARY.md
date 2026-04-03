---
phase: 02-core-ui-shell
plan: "08"
subsystem: frontend-cards
tags: [ui, cards, background, cockpit, instrument-panel, mock-data]
dependency_graph:
  requires: ["02-06"]
  provides: ["instrument-cluster-cards", "static-instrument-wall-background"]
  affects: ["DashboardPage", "CardGrid", "ServiceCard", "GridBackground"]
tech_stack:
  added: []
  patterns:
    - "Chamfered instrument panel cards via chamfer-card CSS class"
    - "Service-specific instrument body rendering via switch on service.id"
    - "Static repeating-linear-gradient seam lines for structural background"
    - "Hover border state via React useState (onMouseEnter/onMouseLeave)"
key_files:
  created: []
  modified:
    - packages/frontend/src/components/layout/GridBackground.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/backend/src/mock/generator.ts
decisions:
  - "Static instrument wall uses repeating-linear-gradient at 120px vertical / 200px horizontal pitch for amber seam lines"
  - "Card glow only applied to warning/offline states — healthy cards blend into panel (D-13)"
  - "DotMatrix uses 4x3 (12 slots) grid — first N=queueCount shown in amber, next M=monitoredCount in green, rest grey"
  - "React.ReactNode return type for renderInstrumentBody avoids need for explicit React import (TypeScript infers from JSX)"
metrics:
  duration: "3m"
  completed: "2026-04-03"
  tasks_completed: 2
  files_modified: 4
---

# Phase 2 Plan 8: Instrument Wall Panel and Service Cluster Cards Summary

Static structural background with amber seam lines and chamfered instrument cluster cards with service-specific bodies (NAS gauges, arr dot matrix, Plex signal bars, SABnzbd progress, Pi-hole stats).

## What Was Built

### Task 1: Static Instrument Wall Panel + Mock Metrics (commit: 71e20fa)

Replaced the animated Tron light grid with a static structural instrument wall panel. The background is a dark `#0A0A0A` surface divided by 1px amber seam lines at 120px vertical / 200px horizontal pitch using `repeating-linear-gradient`. Zero animations, zero `willChange`, zero animated child divs.

Updated the mock generator to add `metrics` fields to all 8 service entries:
- NAS: `{ cpu, ram, diskPercent, tempC }`
- Plex: `{ activeStreams, maxStreams }`
- SABnzbd: `{ speedMBs, queueCount, progressPercent }`
- Pi-hole: `{ blockedPercent, totalQueries }`
- Radarr/Sonarr/Lidarr/Bazarr: `{ queueCount, monitoredCount }`

### Task 2: ServiceCard Instrument Cluster + CardGrid 800x480 (commit: 0155a10)

Complete rewrite of ServiceCard from Tron-styled card to chamfered instrument panel:

- `chamfer-card` CSS class for clip-path chamfered corners
- 6px amber header strip across card top with uppercase service name (amber) and StatusDot flush right
- Card body with service-specific instrument rendering via `renderInstrumentBody()` switch on `service.id`
- Hover state border via React `useState` (onMouseEnter/onMouseLeave)
- Non-healthy outline glow: warning gets amber `0 0 12px rgba(232,160,32,0.3)`, offline gets red `0 0 12px rgba(255,59,59,0.3)`
- Framer Motion entrance preserved: stagger 0.05s, y: 12→0, opacity 0→1
- All Tron references removed: conic-gradient, borderTrace, --angle, --tron-*, GLOW_CONFIG, BORDER_COLORS

Six instrument body types implemented:
1. **NAS** (`nas-detail`) — 4 labeled gauge bars: CPU%, RAM%, DISK%, TEMP°C
2. **Arr services** (`radarr/sonarr/lidarr/bazarr`) — 4×3 dot matrix LED grid, amber=queued, green=monitored, grey=empty
3. **Plex** (`plex`) — 5 vertical signal bars (4/8/12/16/20px heights), green fill = stream count
4. **SABnzbd** (`sabnzbd`) — speed label + queue count + 6px amber progress bar
5. **Pi-hole** (`pihole`) — two stat readout rows: BLOCKED%/QUERIES
6. **Generic** — header + LED only (no body content)

CardGrid updated:
- Section labels: `var(--cockpit-amber)` instead of `var(--section-label)`
- Grid: `minmax(180px, 1fr)` (was 160px) for 800×480 kiosk (~4 cards/row)
- Skeleton cards: `chamfer-card` class, `var(--bg-panel)` background, `var(--border-rest)` border, 160px height
- All `rgba(0, 200, 255, ...)` references removed

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All instrument bodies are wired to mock `metrics` fields populated by the mock generator. No hardcoded empty values that flow to UI rendering — all metrics have concrete mock values.

## Self-Check: PASSED

Files verified:
- `packages/frontend/src/components/layout/GridBackground.tsx` — exists, contains amber seam lines, no animations
- `packages/frontend/src/components/cards/ServiceCard.tsx` — exists, contains chamfer-card, renderInstrumentBody, 0 tron/conic-gradient references
- `packages/frontend/src/components/cards/CardGrid.tsx` — exists, contains minmax(180px, cockpit-amber
- `packages/backend/src/mock/generator.ts` — exists, contains metrics on all 8 services

Commits verified:
- `71e20fa` — feat(02-08): replace animated grid with static instrument wall panel
- `0155a10` — feat(02-08): rebuild ServiceCard as instrument cluster, update CardGrid for 800x480
