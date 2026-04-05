# Phase 5: UI v2 — Instrument Panel Polish — Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Second UI pass with real data flowing: fix broken card instruments, correct LED/color logic, rework the NAS header, rework the Plex rail, restructure the media stack tile, rename Pi-hole to NETWORK, and enforce the no-scroll constraint across the whole dashboard at 800×480.

**Hard constraint:** The entire dashboard — header, card grid, bottom rail — must fit within the 800×480 landscape kiosk viewport without vertical or horizontal scrolling. Every layout decision in this phase must satisfy this constraint.

Phase ends when:
- All card instruments display real data correctly
- LED color logic is correct across all services
- NAS header is always-visible (no expand/collapse) with Docker stats and disk temp bars
- Plex rail shows Tautulli-sourced stream data with correct audio formatting
- Media stack is a two-column 3×3 tile with correct LED semantics
- Pi-hole card is renamed NETWORK with Pi-hole + Ubiquiti (placeholder) sections
- Full dashboard fits at 800×480 without scrolling
- Image update LED detection is working

</domain>

<decisions>
## Implementation Decisions

### Layout — No-Scroll Constraint

- **D-01:** The complete dashboard (AppHeader + CardGrid + NowPlayingBanner/rail) must fit within 800×480 landscape without any vertical or horizontal scrolling. This applies to every tile, every section, and every component.
- **D-02:** Available vertical space breakdown: header height + card grid + bottom rail = 480px total. Phase 5 must audit and enforce this budget across all tiles.
- **D-03:** SABnzbd tile must be narrow — it always shows at most one active download. No scrolling, fixed compact height.

### SABnzbd Card

- **D-04:** Card instrument body shows: active filename (truncated), download speed, and ETA. Replace current speed + progress bar + queue count layout.
- **D-05:** Color logic is currently inverted — fix: LED changes to **solid purple** when actively downloading; card text/labels stay **amber** (`#E8A020`). Text does not go purple.
- **D-06:** Backend must expose `filename` and `eta` fields in the SABnzbd metrics. Confirm these are present in `SabnzbdMetrics` type or add them. ETA as a formatted string (e.g., `"4m 32s"`) is acceptable.
- **D-07:** Card is narrow — sized for one download, no scrolling of any kind.

### SABnzbd Detail View

- **D-08:** Detail view shows: active job at top (filename, speed, ETA, progress bar), then full queue list below (filename + size + status per item).

### Media Stack Tile

- **D-09:** All arr services (Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, Readarr) render in a **single tile** with **two columns of three rows**: left column = Radarr / Sonarr / Lidarr; right column = Prowlarr / Bazarr / Readarr.
- **D-10:** Each row: LED + service name only. No secondary data (warning count, queue count, etc.).
- **D-11:** LED logic (fix from current broken state where everything shows purple):
  - **Green** (`#4ADE80`) — service up and healthy
  - **Red** (`#FF3B3B`) — service down / unreachable
  - **Amber** (`#E8A020`) — service up but needs attention (health warnings from arr `/api/v3/health`)
  - **Solid purple** (`#9B59B6`) — actively downloading (file sent to SABnzbd, in progress)
  - **Flashing purple** — queued (file is in arr queue but not yet active in SABnzbd)
- **D-12:** Tile has amber header bar (same pattern as all other instrument cards). Remove "MEDIA STACK" section label from the grid.
- **D-13:** SABnzbd is a separate narrow tile, not part of the 3×3 arr tile.

### Arr Service Detail Views

- **D-14:** Arr detail view: status + version as dot-leader rows, then health warnings from `/api/v3/health` displayed as a scrollable warning list below. Each warning shows source + message.

### NETWORK Card (renamed from Pi-hole)

- **D-15:** Pi-hole card renamed to **NETWORK**. Header bar reads "NETWORK".
- **D-16:** Card body has **two sections** separated by a subtle divider:
  1. **PI-HOLE** section — current stats: blocking active/inactive, QPM, system load, memory %
  2. **UBIQUITI** section — static `NOT CONFIGURED` placeholder (dim grey, no LED animation). Phase 6 wires real data.
- **D-17:** Pi-hole detail view: donut chart for query type breakdown. Replace broken dynamic legend with a **static legend table** to the right of the donut: color swatch + query type label + count per type. No tooltip-based legend.

### NAS Header — Rework (kill expand/collapse)

- **D-18:** **Kill the expand/collapse mechanic entirely.** NAS header is always-visible with all data shown at once. No drawer, no tap-to-expand.
- **D-19:** Header layout (always visible, no scrolling):
  1. **Stats strip** (existing): CPU%, RAM%, network up/down Mbps, primary volume disk %
  2. **Disk temps bar section**: grouped bars — SSDs first, HDDs second. Each disk shown as a labeled bar (disk name + temp in **°F**). Only render disks that DSM returns data for; no placeholder rows.
  3. **Docker stats section**: CPU%, RAM%, network up/down for Docker daemon. Always visible (not behind expand). Only render if DSM returns Docker data.
  4. **Image update LED**: blinks amber if any Container Manager image has an update available; static grey if all current.
- **D-20:** Image update LED is broken — investigate and fix. User has confirmed a stale image exists but the LED is not triggering.
- **D-21:** Temps in **°F** throughout (convert from °C returned by DSM API).
- **D-22:** Docker stats likely were not implemented correctly in Phase 4 — executor must verify the SYNO.Docker implementation and fix if needed.

### Plex Rail (NowPlayingBanner) — Rework

- **D-23:** Data source: **Tautulli webhooks primary, direct Plex poll as fallback**. Webhooks fire instantly on play/pause/stop/resume; polling covers reconnects.
  - Tautulli triggers to enable: Playback Start, Playback Stop, Playback Pause, Playback Resume.
  - Tautulli provides rich stream metadata: title, media type, quality, transcode flag, track/album/artist for audio.
  - Plex server stats (CPU/MEM/bandwidth) source to be confirmed by researcher (Tautulli `get_activity` vs. Plex API).
- **D-24:** Collapsed rail shows:
  - Left: **"PLEX"** label (replace the current "N STREAMS" display — remove stream count)
  - Center: rotating/cycling stream titles if multiple streams active (cycle every ~4s)
  - Right: Plex server stats — CPU%, RAM%, bandwidth Mbps
- **D-25:** Each stream row includes a **media type badge**: `AUDIO` or `VIDEO`.
- **D-26:** Audio stream display fix: tracks currently show `SxEx` format (TV episode format). Audio streams must show **Track title + Album name** instead.
- **D-27:** Audio quality fix: currently shows "unknown". Must display real quality string from Tautulli payload (e.g., `FLAC`, `MP3 320`, `AAC`).
- **D-28:** Expanded rail shows: full stream rows (user, title, quality, direct/transcode, progress bar) + Plex server stats panel on right.
- **D-29:** "PLEX" label must be visible somewhere on the rail in collapsed state — it currently appears nowhere in the UI.

### Claude's Discretion

- Exact disk temp bar height, label truncation strategy for long disk names
- Whether Docker stats section in header uses vertical or horizontal layout
- Rotation interval for multi-stream cycling in collapsed Plex rail
- Exact SabnzbdMetrics type fields for filename and ETA (add to shared types or keep in metrics record)
- Whether image update check result is cached in DB or in-memory
- SYNO.Docker.Image API endpoint and response shape for update detection

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Context
- `.planning/phases/02-core-ui-shell/02-CONTEXT.md` — full cockpit aesthetic (color palette, chamfered cards, LED design, typography, animation philosophy)
- `.planning/phases/03-settings-first-service-adapters/03-CONTEXT.md` — color semantics (D-locked section: green/red/amber/purple/grey), unconfigured card behavior
- `.planning/phases/04-rich-service-integrations/04-CONTEXT.md` — NAS header design intent, Plex rail design, media stack condensed layout, Pi-hole card fields, purple LED semantics for arr/SABnzbd

### Requirements
- `.planning/REQUIREMENTS.md` §DASH-01 through DASH-08 — all eight dashboard requirements this phase refines

### Project Context
- `.planning/PROJECT.md` §Requirements (Dashboard — Core) — vision-level description
- `.planning/PROJECT.md` §Constraints — ARM NAS, Docker, local-only

### Key Existing Files
- `packages/frontend/src/components/cards/ServiceCard.tsx` — NasInstrument, ArrInstrument, PlexInstrument, SabnzbdInstrument, PiholeInstrument, MediaStackRow (all subject to modification)
- `packages/frontend/src/components/layout/AppHeader.tsx` — NAS stats strip + expandable panel (expand mechanic to be removed)
- `packages/frontend/src/components/layout/NowPlayingBanner.tsx` — Plex rail (full rework)
- `packages/frontend/src/components/cards/CardGrid.tsx` — tier grouping, section labels
- `packages/shared/src/types.ts` — NasStatus, PlexStream, PlexServerStats, SabnzbdMetrics (may need extension for filename/ETA)
- `packages/backend/src/poll-manager.ts` — Plex polling, Tautulli webhook endpoint, image update check timer

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatusDot` component — already implements LED breathing/flashing animations; reuse for media stack rows and rail
- `ServiceCard` — chamfer clip-path, amber header bar pattern is established; NETWORK card sections follow same pattern
- `AppHeader` — existing NAS stats strip layout; Phase 5 removes expand, adds disk temp bars and Docker section inline
- `NowPlayingBanner` + `StreamRow` — rewrite stream row to support audio type display and media type badge

### Established Patterns
- Cockpit aesthetic: amber `#E8A020`, near-black `#0D0D0D`, JetBrains Mono, chamfered cards
- LED semantics from Phase 3 are locked — only changes are fixing implementation bugs, not redefining semantics
- Framer Motion for card entrance, `AnimatePresence` for rail expand/collapse

### Integration Points
- `PollManager` — add/fix Tautulli webhook handler; confirm Docker stats SYNO API call; fix image update detection
- `SabnzbdMetrics` shared type — add `filename?: string` and `etaSeconds?: number` fields
- `DashboardSnapshot` — no structural changes needed; data already flows through SSE
- `CardGrid` — remove "MEDIA STACK" section label; restructure arr services into single tile

</code_context>

<specifics>
## Specific Details

- **No-scroll is a hard constraint:** Every tile must fit within the 800×480 viewport budget. Measure and enforce during implementation.
- **NAS header always-visible sections:** stats strip → disk temp bars (SSD group, HDD group, °F) → Docker stats → image update LED. All inline, no drawer.
- **Media stack tile layout:** single chamfered card, two columns, 3 rows each. Left: Radarr/Sonarr/Lidarr. Right: Prowlarr/Bazarr/Readarr.
- **SABnzbd LED vs text:** LED = purple when downloading; card labels/text = amber always. Current behavior is inverted.
- **Pi-hole → NETWORK card:** two sections with a 1px amber divider. Pi-hole section top, Ubiquiti NOT CONFIGURED section bottom.
- **Plex "PLEX" label:** must appear in the collapsed rail — currently invisible in the UI.
- **Audio streams:** track title + album name (not SxEx episode format). Quality from Tautulli payload (FLAC, MP3, AAC, etc.).
- **Tautulli triggers:** Playback Start, Playback Stop, Playback Pause, Playback Resume — these four only.
- **Docker stats investigation:** Phase 4 may not have implemented SYNO.Docker correctly; executor must verify and fix.
- **Image update check:** user has a container with an available update but the LED is not triggering; must be debugged.

</specifics>

<deferred>
## Deferred Ideas

None captured this session — all discussion stayed within Phase 5 scope or Phase 6+ work already planned (Ubiquiti integration in Phase 6).

</deferred>

---

*Phase: 05-ui-v2-instrument-panel-polish*
*Context gathered: 2026-04-04*
