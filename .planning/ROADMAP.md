# Roadmap: Coruscant

## Overview

Coruscant is built in eight phases that follow the natural dependency order of a monitoring dashboard: infrastructure before application code, architecture proven with one service before building ten, UI built against real data, and the two hardest integrations saved for last. Phases 1-2 are the critical path — everything after Phase 2 can be planned in parallel. Phase 8 (Smart Home) is research-gated and isolated from all other phases.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure Foundation** - Docker Compose on Synology NAS with proven data persistence and CI/CD pipeline (completed 2026-04-03)
- [ ] **Phase 2: Core UI Shell** - Tron/Grid living UI with animated components and SSE live-data loop proven end-to-end with mock data
- [ ] **Phase 3: Settings + First Service Adapters** - Settings page, then Radarr/Sonarr/Lidarr/Bazarr status cards and SABnzbd activity card
- [ ] **Phase 4: Rich Service Integrations** - Pi-hole, Plex (Now Playing banner), and Synology NAS CPU/RAM/storage/disk/fans
- [ ] **Phase 5: Network Monitoring** - UniFi device cards, client counts, WAN throughput, cookie session management
- [ ] **Phase 6: Notifications** - Pushover alert engine, per-service threshold config, debouncing/cooldown
- [ ] **Phase 7: Logging + Polish** - In-app log viewer, purge/export, SQLite WAL pruning, operational quality
- [ ] **Phase 8: Smart Home** - Google Nest OAuth wizard, Ring unofficial API integration — isolated, best-effort

## Phase Details

### Phase 1: Infrastructure Foundation
**Goal**: The project can be deployed to Synology NAS and data survives container restarts
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. User can run `docker compose up` on Synology NAS Container Manager and the app becomes accessible at a local IP and port
  2. Data written to SQLite survives `docker compose down && docker compose up` (bind mount verified)
  3. A new image built from the GitHub repo appears in the self-hosted registry with the correct version tag
  4. The app is reachable from outside the LAN via Tailscale without any app-level tunnel configuration
**Plans:** 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md — Scaffold npm workspaces monorepo with Fastify + SQLite backend, React + Vite frontend, shared types, and unit tests
- [x] 01-02-PLAN.md — Docker containerisation (multi-stage Dockerfile, compose.yaml, .env.example) and GitHub Actions CI/CD pipeline

### Phase 2: Core UI Shell
**Goal**: The full data pipeline (poll → SQLite → SSE → browser) is proven end-to-end with mock data, and the Tron/Grid aesthetic is in place
**Depends on**: Phase 1
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08
**Success Criteria** (what must be TRUE):
  1. User opens the dashboard on a phone and sees an animated grid background with traveling light pulses — the interface feels alive at rest
  2. Service card borders animate with light traces and health state components pulse/breathe using the Tron color system (Blue/Red/Amber)
  3. User taps a service card and navigates to a detail view; browser back returns to the dashboard
  4. The Now Playing banner component renders (with mock data) and scrolls smoothly at 60fps on a physical mobile device
  5. Dashboard layout is usable on both phone and desktop browser without horizontal scrolling
**Plans:** 2/5 plans executed

Plans:
- [x] 02-01-PLAN.md — Shared types (DashboardSnapshot), SSE endpoint with mock data generator, frontend test infrastructure
- [x] 02-02-PLAN.md — Frontend deps, CSS design system, React Router setup, animated grid background, AppHeader
- [ ] 02-03-PLAN.md — Service cards with border traces and health glow, CardGrid with tier sections, SSE hook wiring
- [ ] 02-04-PLAN.md — Now Playing banner with expand/collapse drawer, enhanced ServiceDetailPage
- [ ] 02-05-PLAN.md — Visual verification checkpoint on mobile viewport
**UI hint**: yes

### Phase 3: Settings + First Service Adapters
**Goal**: User can configure service endpoints and API keys, and the Radarr/Sonarr/Lidarr/Bazarr status cards plus SABnzbd activity card display live data
**Depends on**: Phase 2
**Requirements**: CFG-01, CFG-03, CFG-04, SVCST-01, SVCST-02, SVCST-03, SVCST-04, SVCST-05, SVCACT-01, SVCACT-02, SVCACT-03
**Success Criteria** (what must be TRUE):
  1. User navigates to Settings, enters a service base URL and API key, saves it, and the card on the dashboard reflects the live connection state within one poll interval
  2. User clicks "Test Connection" on any service in Settings and sees an immediate pass/fail response
  3. All four *arr cards (Radarr, Sonarr, Lidarr, Bazarr) show correct Blue/Red/Amber health state from live `/api/v3/health` poll data
  4. SABnzbd card shows current download speed, active queue item count, animated progress bars, and amber error state when queue items have failed status
  5. Settings and service configs survive a container restart without re-entry
**Plans**: TBD
**UI hint**: yes

### Phase 4: Rich Service Integrations
**Goal**: Pi-hole DNS stats, Plex active streams with Now Playing banner, and Synology NAS hardware metrics are all live on the dashboard
**Depends on**: Phase 3
**Requirements**: SVCRICH-01, SVCRICH-02, SVCRICH-03, SVCRICH-04, SVCRICH-05
**Success Criteria** (what must be TRUE):
  1. Pi-hole card shows live total DNS queries today, block percentage, and blocklist size; handles both v5 and v6 API responses correctly
  2. Plex card shows active stream count, playing titles, and playback state; the Now Playing banner scrolls with live stream data when streams are active
  3. NAS card shows live CPU %, RAM %, and per-volume storage usage bars updated within the poll interval
  4. NAS card shows per-disk temperatures and fan speed readings; surfaces amber stale-data state when DSM session has expired
  5. User can tap any rich-data card to reach a detail view with all available metrics expanded
**Plans**: TBD
**UI hint**: yes

### Phase 5: Network Monitoring
**Goal**: UniFi network equipment is visible on the dashboard with device status, client counts, and throughput — and the backend manages session auth automatically
**Depends on**: Phase 4
**Requirements**: NET-01, NET-02, NET-03, NET-04
**Success Criteria** (what must be TRUE):
  1. UniFi card shows live active client count, WAN rx/tx throughput, and an overall network health state dot
  2. UniFi card lists per-device status (APs, switches, gateways) with online/offline indication
  3. User taps the UniFi card and reaches a detail view listing all monitored devices with uptime, model, and client count
  4. After the UniFi session cookie expires, the backend re-authenticates automatically and data continues updating without user intervention
**Plans**: TBD
**UI hint**: yes

### Phase 6: Notifications
**Goal**: User receives Pushover alerts when services go down or configured thresholds are breached, with no duplicate-alert spam
**Depends on**: Phase 5
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, CFG-02
**Success Criteria** (what must be TRUE):
  1. User enters their Pushover application token and user key in Settings and receives a test notification confirming the credentials are valid
  2. When any monitored service transitions to offline/critical state, a Pushover notification arrives on the user's phone within one poll interval
  3. User configures a per-service numeric threshold (e.g., NAS storage > 85%) and receives a Pushover notification when the condition is breached
  4. A breached threshold does not generate repeated notifications — the same condition during the configured cooldown period produces at most one alert
  5. Pushover messages include the service name, condition, current value, and a deep-link URL to the Coruscant dashboard
**Plans**: TBD

### Phase 7: Logging + Polish
**Goal**: The user can inspect, filter, purge, and export application logs from within the dashboard, and the app operates cleanly over time without unbounded SQLite growth
**Depends on**: Phase 6
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04
**Success Criteria** (what must be TRUE):
  1. User navigates to the log viewer and sees structured log entries covering poll events, errors, service state changes, and alert dispatches — filterable by service and level
  2. User selects an age threshold and purges logs older than that value; the log viewer reflects the change immediately
  3. User clicks Export and receives a downloadable log file
  4. SQLite file size remains bounded over weeks of operation — WAL mode is verified and nightly pruning runs without user action
**Plans**: TBD
**UI hint**: yes

### Phase 8: Smart Home
**Goal**: Google Nest thermostat state and Amazon Ring device/event status are visible on the dashboard — both integrations are isolated and their absence does not affect any other phase
**Depends on**: Phase 7
**Requirements**: SMRTH-01, SMRTH-02, SMRTH-03, SMRTH-04
**Success Criteria** (what must be TRUE):
  1. User completes the one-time Nest OAuth wizard in the dashboard and the Nest card shows current temperature, humidity, and HVAC state without requiring manual token entry
  2. After Nest OAuth is complete, the Nest card updates from live SDM API data and shows connectivity status
  3. User completes Ring one-time 2FA setup and the Ring card shows each device (doorbells, cameras) with online/offline status and last-event indicators
  4. Cards for unconfigured smart home integrations show a "Not configured" placeholder with setup instructions rather than an error state
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure Foundation | 2/2 | Complete   | 2026-04-03 |
| 2. Core UI Shell | 2/5 | In Progress|  |
| 3. Settings + First Service Adapters | 0/? | Not started | - |
| 4. Rich Service Integrations | 0/? | Not started | - |
| 5. Network Monitoring | 0/? | Not started | - |
| 6. Notifications | 0/? | Not started | - |
| 7. Logging + Polish | 0/? | Not started | - |
| 8. Smart Home | 0/? | Not started | - |

### Phase 9: Production Deploy and Hardening

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 9 to break down)
