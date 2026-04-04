# Phase 4: Rich Service Integrations — Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up backend adapters for Pi-hole, Plex, and Synology NAS so real data flows through SSE into the dashboard. This phase also restructures how NAS and Plex surface in the UI — NAS moves into the header (replacing the stub stats strip), Plex lives entirely in the bottom rail (NowPlayingBanner). Pi-hole remains a standard card in the grid.

Phase ends when:
- Pi-hole card shows live DNS stats from a real v6 API poll
- Plex streams appear in the bottom rail from real Tautulli/Plex API data; expanding the rail shows server stats
- NAS header strip shows live CPU/RAM/network/disk/temp; expanding the header panel shows per-drive data, Docker daemon stats, and update LED
- Settings tabs for Pi-hole, Plex, and NAS are functional with TEST button validation

No UniFi, no notifications, no logging — those are Phase 6+.

</domain>

<decisions>
## Implementation Decisions

### Pi-hole Integration

- **D-01:** Pi-hole adapter targets **v6 API only**. No v5 support. Settings tab displays a note: *"Pi-hole v6 or higher required."*
- **D-02:** Pi-hole v6 auth: POST to `/api/auth` with `{"password": "..."}` → returns session `sid`. Backend manages session lifecycle (re-auth on expiry), same pattern as DSM.
- **D-03:** Settings tab fields: **Pi-hole URL** + **Password** (two fields). Password is masked with eye-toggle (same pattern as Phase 3 API key fields).
- **D-04:** **Pi-hole card** (standard grid card) shows:
  - Active/inactive status — is Pi-hole currently blocking? (distinct from up/down — Pi-hole can be up but blocking disabled)
  - Queries per minute (QPM)
  - System load
  - Memory usage %
- **D-05:** Active/inactive blocking state maps to color semantics: blocking active = green LED, blocking disabled = amber LED (user action required — Pi-hole is up but not doing its job), offline = red LED.
- **D-06:** **Pi-hole detail view** shows:
  - Query distribution — **donut chart** of query type breakdown (A, AAAA, HTTPS, etc.) from `/api/stats/query_types`
  - Day totals: total queries today, total blocked today
  - Any warning/error messages from the Pi-hole API

### Plex Integration

- **D-07:** Plex auth uses **X-Plex-Token** (not a password). Settings tab fields: **Plex URL** + **Plex Token** (labeled explicitly as "Plex Token", not "API Key" — different enough to warrant a clear label). Masked with eye-toggle.
- **D-08:** **No Plex card in the grid.** Plex lives entirely in the **bottom rail (NowPlayingBanner)**. The grid slot previously planned for Plex is freed.
- **D-09:** Bottom rail (collapsed state) shows active streams: title, device name, transcode vs direct-play indicator. One row per active stream, scrolling if multiple.
- **D-10:** Bottom rail (expanded state) additionally shows **Plex server stats**: bandwidth (Mbps), Plex server CPU %, Plex server RAM %. These are Plex Media Server's own resource figures, not the NAS host.
- **D-11:** Rail expand/collapse behavior: tap the rail to toggle expanded state (same drawer mechanic as Phase 2 NowPlayingBanner). When no streams are active, rail shows a dim "NO ACTIVE STREAMS" label.

### Synology NAS Integration

- **D-12:** NAS auth uses **DSM username + password**. Backend calls `SYNO.API.Auth` to obtain a session `sid` and manages session lifecycle (re-auth on expiry, transparent to user).
- **D-13:** Settings tab fields: **NAS URL** + **DSM Username** + **DSM Password** (three fields — unique pattern among services). Password masked with eye-toggle. Note in settings: *"Requires an admin-level DSM account."*
- **D-14:** TEST button for NAS: performs a real SYNO.API.Auth login. Success returns version info; failure shows error (wrong credentials, unreachable, etc.).
- **D-15:** **No NAS card in the grid.** NAS lives entirely in the **AppHeader** as an expandable downward panel (inverse of the bottom rail — drops down from the header).
- **D-16:** **Header strip (collapsed state)** shows:
  - CPU %
  - RAM %
  - Network: upload speed + download speed (Mbps)
  - Disk space (aggregate or primary volume %)
  - CPU temperature (°C)
- **D-17:** **Header panel (expanded state)** shows:
  - Per-disk: read/write speeds + temperature — **only rendered if DSM returns data for that disk**
  - Docker daemon stats: CPU %, RAM %, network — **only rendered if DSM returns data**
  - Fan speeds — **only rendered if DSM returns fan data** (fanless NAS models return nothing; no placeholder rows)
  - Image update LED: blinks amber if any Container Manager image has an update available. Static grey if all images are current.
- **D-18:** Image update check polls `SYNO.Docker.Image` API **2× per day** (not on every NAS poll cycle). Result is cached and included in the NAS expanded panel data.
- **D-19:** General rule for NAS expanded panel: **only show sections for data that exists.** No "N/A" rows, no placeholder sections. If a metric isn't available from DSM, it's omitted entirely.

### Layout Changes (grid restructure)

- **D-20:** The grid card slots for **Plex** and **NAS** are removed. The grid now contains: Pi-hole (rich tier), Pi-hole being the only new service in the card grid. Arr services + SABnzbd + Pi-hole constitute the full grid.
- **D-21:** The "RICH DATA" tier section label in the grid now applies to Pi-hole only (Plex and NAS have moved to dedicated UI zones).

### Settings Page Additions

- **D-22:** Three new tabs added to the Settings tab bar: **PI-HOLE**, **PLEX**, **NAS**. Follow Phase 3 tab conventions (status LED, horizontal scroll overflow).
- **D-23:** Pi-hole and Plex tabs follow the 2-field pattern (URL + credential). NAS tab has 3 fields (URL + username + password). All use the same cockpit instrument panel aesthetic as Phase 3 tabs.

### Poll Intervals

- **D-24:** Pi-hole: **60 second** interval.
- **D-25:** Plex: **Tautulli webhooks** (user has Plex Pass + Tautulli). Backend exposes a POST endpoint that Tautulli calls on play/pause/stop/resume events — stream state updates instantly, no polling. No fallback poll needed.
- **D-26:** NAS: **3 second** interval for live hardware stats. Image update check: 2× per day (separate timer, not the main poll cycle).
- **D-27:** Media stack (Radarr, Sonarr, etc.): **5 second** interval.
- **D-28:** SABnzbd: **10 second** interval.

### Media Stack UI Simplification

- **D-29:** The media stack area shows a **condensed list: one LED + label row per service** (Radarr, Sonarr, SABnzbd, etc.) — no expanded card UI, just tight rows. Each service label row remains tappable to navigate to that service's detail view. Condensed for dashboard space, full drill-down still accessible.
- **D-30:** Purple LED semantics — each service is independent:
  - **Media stack LED (Radarr/Sonarr/etc.):**
    - Solid purple — actively monitored (healthy, no pending queue)
    - Flashing purple — a file is queued in the arr service (waiting to be sent or already sent to SABnzbd)
  - **SABnzbd LED:**
    - Solid purple — actively downloading
    - Flashing purple — files are in the SABnzbd queue but downloading is paused or not yet started (downloader is up, has work, but not running — distinct from the arr service state)
  - These states are independent: arr service can be flashing (has a queue entry) while SABnzbd is also flashing (paused). Both tell a different story about where in the pipeline the hold-up is.
  - Standard green/red/amber apply when no download activity is present.
- **D-31:** SABnzbd display shows the current job naturally: **filename**, **time remaining**, **speed**. No app-attribution needed — the download client only runs one job at a time, so the active file in SABnzbd implicitly maps to whoever queued it.
- **D-32:** Tautulli webhook setup must be self-contained in the Plex settings tab. The tab shows a read-only **Webhook URL** field (e.g. `http://<host>:1688/api/webhooks/tautulli`) with a one-click **Copy** button. Below it, inline setup instructions: *"In Tautulli → Settings → Notification Agents → Add → Webhook → paste URL above. Enable: Playback Start, Playback Stop, Playback Pause, Playback Resume."* No external docs needed — the tab is self-guiding.

### Claude's Discretion

- Exact DSM API endpoints for each metric category (system utilization, storage volumes, disk health, hardware/fan, Docker daemon stats, Docker image update status)
- `NasStatus` type extension: add `networkMbpsUp`, `networkMbpsDown`, `cpuTempC`, per-disk entries with speeds and temps, fan entries, Docker daemon stats, imageUpdateAvailable boolean
- `PlexServerStats` type shape (bandwidth, CPU %, RAM % from Plex API)
- Pi-hole v6 session management approach (whether to store sid in memory or re-auth each poll cycle)
- Exact poll interval values within the spec ranges
- Whether Pi-hole session needs explicit logout or just re-auth on 401
- Plex API endpoint for server stats (resource utilization — Plex exposes this via `/status/sessions/statistics` or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §SVCRICH-01 — Pi-hole card requirements
- `.planning/REQUIREMENTS.md` §SVCRICH-02 — Plex card requirements
- `.planning/REQUIREMENTS.md` §SVCRICH-03 — NAS CPU/RAM/storage requirements
- `.planning/REQUIREMENTS.md` §SVCRICH-04 — NAS disk temps + fan speeds
- `.planning/REQUIREMENTS.md` §SVCRICH-05 — detail views for rich services

### Prior Phase Context
- `.planning/phases/02-core-ui-shell/02-CONTEXT.md` — full cockpit aesthetic, AppHeader design (D-21 through D-24), NowPlayingBanner drawer mechanic, color palette
- `.planning/phases/03-settings-first-service-adapters/03-CONTEXT.md` — Settings tab pattern (D-01 through D-07), color semantics (D-locked section), SSE data pipeline, ServiceStatus shape, unconfigured card behavior

### Project Context
- `.planning/PROJECT.md` §Constraints — Docker/NAS, no cloud telemetry
- `.planning/STATE.md` — current phase position and stack decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/poll-manager.ts` — `PollManager` already has `pihole`, `plex`, `nas` in `ALL_SERVICE_IDS`; stubs return `makeUnconfigured()`. Phase 4 wires in real adapters by adding cases in `doPoll()`.
- `packages/backend/src/adapters/arr.ts` — reference adapter pattern for new Pi-hole/Plex/NAS adapters
- `packages/backend/src/routes/settings.ts` — existing settings CRUD; Phase 4 adds rows for pihole/plex/nas service configs
- `packages/backend/src/schema.ts` — `serviceConfig` table already exists; new services are new rows, no schema change needed
- `packages/frontend/src/components/cards/ServiceCard.tsx` — has `NasInstrument` stub expecting `metrics.cpu/ram/diskPercent/tempC`; will be refactored since NAS moves to header
- `packages/frontend/src/pages/ServiceDetailPage.tsx` — dot-leader row pattern; Pi-hole detail view adds here
- `packages/shared/src/types.ts` — `NasStatus`, `PlexStream` already defined; Phase 4 extends both

### Established Patterns
- Cockpit aesthetic: amber `#E8A020`, near-black `#0D0D0D`, JetBrains Mono, chamfered cards, dot-leader rows in detail views
- LED semantics: green=healthy, red=down, amber=user action required, grey=unconfigured (Phase 3 D-locked section)
- SSE: `DashboardSnapshot` pushed from `PollManager.getSnapshot()` on interval; `streams` and `nas` fields already in snapshot shape
- Settings: 2-field URL+credential per service, per-tab SAVE, TEST button with inline result, eye-toggle for masked fields
- Framer Motion for animations; React Router for navigation

### Integration Points
- `packages/backend/src/poll-manager.ts` — add adapter calls for pihole/plex/nas in `doPoll()` switch; add separate 2×/day timer for image update check
- `packages/backend/src/routes/settings.ts` — add test-connection handlers for pihole (v6 auth), plex (token validate), nas (SYNO.API.Auth)
- `packages/frontend/src/components/layout/AppHeader.tsx` — replace stub NAS stats strip with real data + expand/collapse drawer
- `packages/frontend/src/App.tsx` — NowPlayingBanner receives real `streams` data; Plex server stats fed from snapshot
- `packages/shared/src/types.ts` — extend `NasStatus` and add `PlexServerStats`

</code_context>

<specifics>
## Specific Details

- Pi-hole blocking active/inactive is a distinct status from up/down — Pi-hole can be reachable but have blocking disabled. Amber LED for "up but blocking disabled."
- NAS expanded panel drops DOWN from the header (inverse drawer mechanic vs. the bottom rail which expands UP). Same Framer Motion drawer pattern, opposite direction.
- Image update LED in NAS panel: blinks amber if updates available, static grey if all current. Same LED component as dashboard cards.
- Pi-hole Settings tab note text: *"Pi-hole v6 or higher required."*
- NAS Settings tab note text: *"Requires an admin-level DSM account."*
- Plex token field label: "Plex Token" (not "API Key") — explicit because X-Plex-Token is not a standard API key pattern.
- NAS Settings has 3 fields (URL + DSM Username + DSM Password) — only service with 3 fields; exception to the 2-field pattern.

</specifics>

<deferred>
## Deferred Ideas

None captured this session.

</deferred>

---

*Phase: 04-rich-service-integrations*
*Context gathered: 2026-04-04*
