# Roadmap: Coruscant

## Overview

Coruscant is built in eleven phases that follow the natural dependency order of a monitoring dashboard: infrastructure before application code, architecture proven with one service before building ten, UI built against real data. Phases 1-2 are the critical path — everything after Phase 2 can be planned in parallel. Phase 11 (Raspberry Pi Kiosk) is already complete.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure Foundation** - Docker Compose on Synology NAS with proven data persistence and CI/CD pipeline (completed 2026-04-03)
- [ ] **Phase 2: Core UI Shell** - Star Wars X-Wing cockpit instrument panel UI with SSE live-data loop proven end-to-end with mock data
- [x] **Phase 3: Settings + First Service Adapters** - Settings page, then Radarr/Sonarr/Lidarr/Bazarr status cards and SABnzbd activity card (completed 2026-04-03)
- [ ] **Phase 4: Rich Service Integrations** - Pi-hole, Plex (Now Playing banner), and Synology NAS CPU/RAM/storage/disk/fans
- [x] **Phase 5: UI v2 — Instrument Panel Polish** - Second UI pass with real data: refine card metrics, layout density, interaction details, and visual hierarchy now that actual service data is flowing (completed 2026-04-05)
- [ ] **Phase 6: Network Monitoring** - UniFi device cards, client counts, WAN throughput, API token auth (UniFi OS 5.x)
- [x] **Phase 7: Notifications (Webhook Event Signaling)** - Arr webhook receivers with ephemeral card flash + header ticker, SABnzbd burst poll, Settings webhook URL tab (completed 2026-04-06)
- [x] **Phase 8: Logging, Polish + Performance** - Log viewer, SQLite pruning, poll interval tuning for real-time media feel (completed 2026-04-06)
- [x] **Phase 9: Local Weather** - Current conditions in AppHeader nav bar via self-hosted/no-key weather API (completed 2026-04-06)
- [ ] **Phase 10: Production Deploy + Hardening** - v1.0 tag, registry migration, final bug pass, git cleanup
- [x] **Phase 11: Raspberry Pi Kiosk** - Complete (set up manually)

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
**Goal**: The full data pipeline (poll -> SSE -> browser) is proven end-to-end with mock data, and the Star Wars X-Wing cockpit instrument panel aesthetic is in place on the primary 800x480 Raspberry Pi touchscreen viewport
**Depends on**: Phase 1
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08
**Success Criteria** (what must be TRUE):
  1. User opens the dashboard on an 800x480 viewport and sees a dark instrument wall panel background with amber seam lines and decorative wiring traces
  2. Service cards render as chamfered instrument panels with service-specific bodies (gauges, dot matrix, signal bars) and LED status indicators pulse/breathe per health state
  3. User taps a service card and navigates to a detail view with dot-leader readout format; back navigation returns to dashboard
  4. The Now Playing banner component renders (with mock data) in utilitarian cockpit style
  5. Dashboard layout shows ~4 cards per row at 800px width; works on both kiosk display and phone
**Plans:** 12/13 plans executed

Plans:
- [x] 02-01-PLAN.md — Shared types (DashboardSnapshot), SSE endpoint with mock data generator, frontend test infrastructure
- [x] 02-02-PLAN.md — Frontend deps, CSS design system, React Router setup, animated grid background, AppHeader
- [x] 02-03-PLAN.md — Service cards with border traces and health glow, CardGrid with tier sections, SSE hook wiring
- [x] 02-04-PLAN.md — Now Playing banner with expand/collapse drawer, enhanced ServiceDetailPage
- [x] 02-05-PLAN.md — Visual verification checkpoint on mobile viewport
- [x] 02-06-PLAN.md — [GAP CLOSURE] CSS design system rework (cockpit palette) + decorative SVG wiring overlay
- [x] 02-07-PLAN.md — [GAP CLOSURE] StatusDot LED restyle + AppHeader cockpit chrome + back navigation
- [x] 02-08-PLAN.md — [GAP CLOSURE] Static instrument wall background + service-specific instrument cards + CardGrid 800x480 optimization
- [x] 02-09-PLAN.md — [GAP CLOSURE] NowPlayingBanner + StreamRow + ServiceDetailPage dot-leaders + StaleIndicator restyle
- [ ] 02-10-PLAN.md — [GAP CLOSURE] Visual verification checkpoint on 800x480 viewport
**UI hint**: yes

### Phase 3: Settings + First Service Adapters
**Goal**: User can configure service endpoints and API keys, and the Radarr/Sonarr/Lidarr/Bazarr/Prowlarr/Readarr status cards plus SABnzbd activity card display live data
**Depends on**: Phase 2
**Requirements**: CFG-01, CFG-03, CFG-04, SVCST-01, SVCST-02, SVCST-03, SVCST-04, SVCST-05, SVCACT-01, SVCACT-02, SVCACT-03
**Success Criteria** (what must be TRUE):
  1. User navigates to Settings, enters a service base URL and API key, saves it, and the card on the dashboard reflects the live connection state within one poll interval
  2. User clicks "Test Connection" on any service in Settings and sees an immediate pass/fail response
  3. All four *arr cards (Radarr, Sonarr, Lidarr, Bazarr) show correct Blue/Red/Amber health state from live `/api/v3/health` poll data
  4. SABnzbd card shows current download speed, active queue item count, animated progress bars, and amber error state when queue items have failed status
  5. Settings and service configs survive a container restart without re-entry
**Plans:** 4/4 plans complete

Plans:
- [x] 03-01-PLAN.md — Backend foundation: Drizzle schema, AES-256-GCM encryption, service adapters (arr/bazarr/sabnzbd), PollManager
- [x] 03-02-PLAN.md — Backend API routes: settings CRUD, test-connection, SSE refactor from mock to PollManager
- [x] 03-03-PLAN.md — Frontend Settings page: tabbed layout, per-service config forms, test connection, deep-link
- [x] 03-04-PLAN.md — Frontend card integration: NOT CONFIGURED state, Prowlarr/Readarr support, visual verification
**UI hint**: yes

### Phase 4: Rich Service Integrations
**Goal**: Pi-hole DNS stats, Plex active streams with Now Playing banner, and Synology NAS hardware metrics are all live on the dashboard
**Depends on**: Phase 3
**Requirements**: SVCRICH-01, SVCRICH-02, SVCRICH-03, SVCRICH-04, SVCRICH-05
**Success Criteria** (what must be TRUE):
  1. Pi-hole card shows live total DNS queries today, block percentage, and blocklist size; targets Pi-hole v6 API only
  2. Plex card shows active stream count, playing titles, and playback state; the Now Playing banner scrolls with live stream data when streams are active
  3. NAS card shows live CPU %, RAM %, and per-volume storage usage bars updated within the poll interval
  4. NAS card shows per-disk temperatures and fan speed readings; surfaces amber stale-data state when DSM session has expired
  5. User can tap the NAS header strip to expand the full NAS panel (CPU, RAM, disks, fans, Docker stats), and tap any Pi-hole or Plex card/rail to reach a detail view with all metrics expanded
**Plans:** 3/5 plans executed

Plans:
- [x] 04-01-PLAN.md — Types, schema, settings routes, test-connection handlers for Pi-hole/Plex/NAS
- [x] 04-02-PLAN.md — Backend adapters (Pi-hole, Tautulli webhook, NAS) with unit tests + PollManager wiring
- [x] 04-03-PLAN.md — Frontend: Pi-hole card, Pi-hole detail view, Settings tabs, grid restructure
- [x] 04-04-PLAN.md — Frontend: AppHeader NAS live strip + expandable downward panel
- [x] 04-05-PLAN.md — Frontend: NowPlayingBanner Plex upgrade + visual verification checkpoint
**UI hint**: yes

### Phase 5: UI v2 — Instrument Panel Polish
**Goal**: The dashboard feels finished — card metrics reflect real service data, layout density is right for the 800x480 kiosk, and interaction details are solid
**Depends on**: Phase 4
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08
**Success Criteria** (what must be TRUE):
  1. Card instrument bodies show real metrics drawn from live service data (not mock placeholders)
  2. Any metric that was confusing or redundant on mock data has been simplified or removed
  3. Touch targets and tap areas are comfortable on the physical 800x480 Pi touchscreen
  4. Any visual bugs deferred from Phase 2 are resolved
  5. Overall aesthetic is cohesive — no obvious rough edges at normal kiosk viewing distance
**Plans:** 8/8 plans executed

Plans:
- [x] 05-01-PLAN.md — Backend data layer: extend shared types + SABnzbd/Plex/NAS adapters with missing fields
- [x] 05-02-PLAN.md — Frontend cards: fix LED colors, restructure arr tile, SABnzbd text fix, NETWORK card rename
- [x] 05-03-PLAN.md — Frontend AppHeader: kill expand/collapse, inline disk temps + Docker stats + image LED
- [x] 05-04-PLAN.md — Frontend Plex rail: PLEX label, cycling titles, server stats, media type badges
- [x] 05-05-PLAN.md — Viewport budget enforcement (800x480 no-scroll) + visual verification checkpoint
- [x] 05-08-PLAN.md — Plex play/pause state indicator (▶/⏸) in StreamRow and NowPlayingBanner rail
- [x] 05-09-PLAN.md — Gap closure: purple DOWNLOADS LED, consistent banners, tile layout, uniform heights
- [x] 05-11-PLAN.md — Layout gap closure: 2-col MEDIA+NETWORK grid, body scroll lock, DOWNLOADS progress bar
**UI hint**: yes

### Phase 6: Network Monitoring
**Goal**: UniFi network equipment is visible on the dashboard with device status, client counts, and throughput — authenticated via a static API token generated from the UniFi control panel
**Depends on**: Phase 5
**Requirements**: NET-01, NET-02, NET-03, NET-04
**Notes**:
- Controller version: UniFi OS 5.x
- Auth: static API token (generated from UniFi control panel settings) — NOT cookie/session auth
**Success Criteria** (what must be TRUE):
  1. UniFi card shows live active client count, WAN rx/tx throughput, and an overall network health state dot
  2. UniFi card lists per-device status (APs, switches, gateways) with online/offline indication
  3. User taps the UniFi card and reaches a detail view listing all monitored devices with uptime, model, and client count
  4. Backend authenticates via static API token header — no session management or re-auth logic needed
**Plans:** 2/3 plans executed

Plans:
- [x] 06-01-PLAN.md — Shared types (UnifiDevice/UnifiMetrics), backend adapter (pollUnifi), unit tests
- [x] 06-02-PLAN.md — Backend wiring: PollManager integration, settings routes, test-connection handler
- [ ] 06-03-PLAN.md — Frontend: UBIQUITI card section, settings tab, device detail view, visual verification
**UI hint**: yes

### Phase 7: Notifications (Webhook Event Signaling)
**Goal**: Arr apps POST webhook events directly to Coruscant, which broadcasts ephemeral card flash animations and AppHeader ticker overlays for 10 seconds per event, activates SABnzbd burst polling on grab events, and provides copy-able webhook URLs in a Settings Notifications tab
**Depends on**: Phase 6
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, CFG-02
**Notes**:
- Phase name legacy: originally "Pushover Inbox" but reframed during discuss-phase as webhook event signaling (D-01)
- No Pushover API polling, no inbox view, no notification history UI
- Events are ephemeral — flash/ticker state exists only in memory; page refresh clears all
- SABnzbd burst poll (1s) activates on grab, deactivates on import or queue-empty
- Threshold alert sending (NOTIF-02 to NOTIF-06 from REQUIREMENTS.md) deferred to Phase 8
**Success Criteria** (what must be TRUE):
  1. All 7 arr services (Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, Readarr, SABnzbd) can POST to `/api/webhooks/{service}` and receive 200
  2. Webhook events produce a 10-second colored card flash on the matching MediaStackRow label and a ticker overlay in the AppHeader
  3. SABnzbd poll interval switches to 1 second on grab and returns to 10 seconds on import-complete or queue-empty
  4. Settings Notifications tab lists all 7 arr services with copy-able webhook URLs
**Plans:** 2/2 plans complete

Plans:
- [x] 07-01-PLAN.md — Backend: shared types, arr webhook routes, PollManager event handling + burst poll, SSE arr-event emission, unit tests
- [x] 07-02-PLAN.md — Frontend: SSE hook extension, card flash animation, AppHeader ticker overlay, Settings Notifications tab, visual verification
**UI hint**: yes

### Phase 8: Logging, Polish + Performance
**Goal**: The user can inspect and manage application logs, the app is visually polished end-to-end, and polling intervals are tuned for real-time feel — especially for media (Plex streams, SABnzbd active downloads)
**Depends on**: Phase 7
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, PERF-01, PERF-02
**Notes**:
- Performance focus: discuss before planning — current intervals (NAS 3s, Plex 5s, arr 5s, Pi-hole 60s) may need tuning; explore whether SSE push-on-change vs fixed polling can reduce lag for media
- Goal: Plex stream state and SABnzbd progress feel real-time (sub-3s); NAS and arr can be slightly more relaxed
**Success Criteria** (what must be TRUE):
  1. User navigates to the log viewer and sees structured log entries covering poll events, errors, service state changes — filterable by service and level
  2. User selects an age threshold and purges logs older than that value; the log viewer reflects the change immediately
  3. SQLite file size remains bounded over weeks of operation — WAL mode verified, nightly pruning runs without user action
  4. Plex stream state updates feel immediate (≤3s lag from stream start to banner appearance)
  5. SABnzbd download progress updates smoothly in near-real-time during active downloads
  6. No visible polling artifacts (flicker, stale-data flash) at normal kiosk viewing distance
**Plans:** 2/5 plans executed

Plans:
- [x] 08-01-PLAN.md — Backend: DB schema (app_logs, kv_store), pino transport, log API routes, SSE change detection, poll interval tuning, Tautulli Plex re-poll, UniFi high-water marks
- [x] 08-02-PLAN.md — Theme preview page (3 background variants) + user selection checkpoint
- [x] 08-03-PLAN.md — Frontend: log viewer UI (LogsPage), SSE hook extension, Settings LOGS tab
- [x] 08-04-PLAN.md — Frontend: download bar removal, text scale-up, background + depth + glow, NAS tile, CRT sweep, color indicators, UniFi bars
- [x] 08-05-PLAN.md — Visual and functional verification checkpoint (approved 2026-04-06)
**UI hint**: yes
### Phase 9: Local Weather + UI Final Polish

**Goal**: Current local weather conditions appear in the AppHeader top nav bar; plus a final UI polish pass covering Claude-identified micro-issues and any remaining visual bugs surfaced during Phase 8 UAT
**Depends on**: Phase 8
**Requirements**: WTHR-01, WTHR-02
**Notes**:
- Weather source: Open-Meteo (free, no API key, no account)
- Location configured once in Settings (zip code); backend geocodes to lat/lon and caches
- Display: compact — animated SVG icon + temperature in the header right column
- UI polish pass: disconnect dot, header sizing, text sharpness, DOWNLOADS tile fixes, webhook log format, Settings side-rail, living/breathing animations
**Success Criteria** (what must be TRUE):
  1. AppHeader top nav bar shows current temperature and a weather condition indicator (icon or abbreviated label)
  2. Weather updates automatically on a configured interval without user interaction
  3. User sets location (lat/lon) once in Settings; weather persists across restarts
  4. If weather fetch fails, header shows last-known value with a stale indicator rather than crashing
  5. All Claude-identified UI micro-issues resolved and signed off
**Plans:** 4/4 plans complete

Plans:
- [x] 09-01-PLAN.md — Weather backend: shared types, adapter, poller, settings route, SSE integration, unit tests
- [x] 09-02-PLAN.md — UI polish: disconnect dot, header sizing, text sharpness, DOWNLOADS tile fixes, speed colors, webhook log format
- [x] 09-03-PLAN.md — Settings page side-rail restructure with section groupings
- [x] 09-04-PLAN.md — Weather frontend widget, living/breathing animations, visual verification checkpoint
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 (11 already done)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure Foundation | 2/2 | Complete | 2026-04-03 |
| 2. Core UI Shell | 13/13 | Complete | 2026-04-03 |
| 3. Settings + First Service Adapters | 4/4 | Complete | 2026-04-04 |
| 4. Rich Service Integrations | 5/5 | Complete | 2026-04-05 |
| 5. UI v2 — Instrument Panel Polish | 8/8 | Complete | 2026-04-05 |
| 6. Network Monitoring | 2/3 | In Progress|  |
| 7. Notifications (Webhook Event Signaling) | 2/2 | Complete   | 2026-04-06 |
| 8. Logging, Polish + Performance | 2/5 | In Progress|  |
| 9. Local Weather + UI Final Polish | 4/4 | Complete   | 2026-04-06 |
| 10. Production Deploy + Hardening | 2/3 | In Progress|  |
| 11. Raspberry Pi Kiosk | — | Complete (manual) | 2026-04-05 |

### Phase 10: Production Deploy and Hardening

**Goal**: App is deployed cleanly to the Synology NAS from the self-hosted registry, v1.0 is tagged, final bugs are resolved, and the codebase is clean for long-term maintenance
**Requirements**: PROD-01, PROD-02, PROD-03
**Depends on:** Phase 9
**Notes**:
- Final bug pass before v1.0 tag
- Git cleanup (worktree branches, stale files, .gitignore)
- Webhook logging hardened with dedicated filter category
**Plans:** 2/3 plans executed

Plans:
- [x] 10-01-PLAN.md — Fix pre-existing test failures + CI version tag support
- [x] 10-02-PLAN.md — Webhook logging hardening + Pi-hole BPM fix + MediaStackRow glow
- [ ] 10-03-PLAN.md — Git cleanup, .gitignore, compose.yaml pin, v1.0.0 tag + deploy verification
### Phase 11: Raspberry Pi Kiosk ✅

**Goal:** Coruscant running as a fullscreen browser kiosk on a Raspberry Pi on the local LAN
**Status:** COMPLETE — set up manually by user outside GSD workflow
**Depends on:** Phase 1

## Backlog

### Phase 999.1: CRT Signal Interference Screen Refresh Animation (BACKLOG)

**Goal:** Periodic full-screen "signal interference" animation — a horizontal static-noise band sweeps top-to-bottom on a configurable interval, doubling as a pixel refresh mechanism for the Raspberry Pi kiosk display
**Target phase:** Phase 8 (Logging, Polish + Performance)
**Requirements:** TBD
**Notes:**
- Animation: SVG `feTurbulence` filter on a full-screen fixed overlay, translated top→bottom via CSS `@keyframes` — GPU-composited, zero canvas per-frame cost, ARM64-safe
- Brief full-white flash frame before the band enters (forces all pixels to full brightness — actual pixel refresh)
- Slight desaturate/green tint during the sweep pass for Star Wars holoprojector feel
- Settings controls: on/off toggle, interval selector (15 / 30 / 60 min), "Trigger Now" button for testing
- Total animation duration: ~1.5s — dramatic but non-disruptive to monitoring use
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.2: Plex Now Playing — Vertical Bar Stats (BACKLOG)

**Goal:** Add vertical bar meters (instrument-panel style) to the right side of each Now Playing stream row, showing bitrate and transcode load at a glance without expanding the tile
**Requirements:** TBD
**Notes:**
- Bars for scalar stats only: bitrate (0–max Mbps) and transcode CPU load — these map naturally to gauge/meter metaphor
- Categorical stats (codec, resolution, direct play vs transcode) stay as small text badges, not bars
- Layout: bars column on the right of the stream row; title/user/progress on the left — verify fits on 800×480 kiosk width and phone portrait without clipping
- Multi-stream case: each stream row gets its own bar column — test with 2–3 concurrent streams
- Cockpit aesthetic: amber fill, dark background, thin stroke — matches fuel gauge / signal meter vibe
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
