---
plan: 06-03
phase: 06-network-monitoring
status: complete
completed: 2026-04-05
commits:
  - 6369110
  - 485474e
  - f2596e1
  - 6d08a8f
  - 6461d47
key-files:
  modified:
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/pages/SettingsPage.tsx
    - packages/frontend/src/pages/ServiceDetailPage.tsx
    - packages/backend/src/adapters/unifi.ts
    - packages/backend/src/routes/debug.ts
---

## What Was Built

**Task 1 — UBIQUITI card section + settings tab:**
- `ThroughputBar` component for TX (red #FF4444) / RX (blue #00c8ff) bars scaling to peak
- `NetworkInstrument` updated to accept `unifiService` prop, shows live health LED + client count + bars when configured, "NOT CONFIGURED" placeholder when not
- `ServiceCard` passes `allServices` prop, finds unifi from snapshot and threads to NetworkInstrument
- `SettingsPage` SERVICES array includes `{ id: 'unifi', label: 'UBIQUITI' }` with API Token credential label

**Task 2 — UniFi device detail view:**
- `DeviceRow`, `DeviceSection`, `UnifiDetailView` components in ServiceDetailPage
- Devices grouped into GATEWAYS / SWITCHES / ACCESS POINTS / OTHER
- Appended below Pi-hole stats in NETWORK detail page under "UBIQUITI DEVICES" header
- Scrollable, uptime hidden when 0 (Integration API doesn't provide per-device uptime)

## Bug Fixes During Verification

- **Self-signed cert**: Added `httpsAgent` with `rejectUnauthorized: false` to adapter and test-connection (same as Plex)
- **API field names**: Sites endpoint returns `id`/`internalReference` not `siteId`/`internalId` — fixed resolveSiteId
- **Model classification**: `UCG Ultra` (user's gateway) not recognized — added UCG/UXG prefixes, normalize spaces/hyphens
- **State case**: Integration API returns `"ONLINE"` not `"online"` — normalize to lowercase on parse
- **Duplicate tile**: `unifi` was rendering as a standalone card — excluded in CardGrid like `nas`/`plex`
- **Debug endpoint**: Added `/debug/unifi` route that walks through all API calls step-by-step

## Known Gaps (deferred to Phase 8)

- Per-device client count not available via Integration API (`features` is a string array)
- Per-device uptime not in Integration API response (hidden, not shown as 0h)
- Minor visual polish deferred to Phase 8 UI pass
