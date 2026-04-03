# Phase 2: Core UI Shell — Context

**Gathered:** 2026-04-02
**Updated:** 2026-04-03 (aesthetic rework — Tron replaced by Star Wars cockpit)
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Star Wars X-Wing cockpit instrument panel UI shell with dark segmented background, service-specific instrument cards, NAS header stats bar, Now Playing banner, and card-to-detail navigation. Prove the full data pipeline (mock poll → SSE → browser state → instrument UI) end-to-end. Phase ends when a user can open the dashboard on a physical phone, see an instrument panel with live-ish data updating every 5 seconds, tap a card to reach a detail view, and tap a Plex stream summary to see per-stream details. All data is mock in Phase 2 — real service integrations come in Phase 3+.

No service credentials, no real API calls, no Settings page content — that's Phase 3.

**Reference aesthetic:** Original Star Wars (1977) cockpit instrumentation — retro-70s utilitarian, analog instrument panels, warm amber/green on near-black, physical-feeling controls and readouts. Like the X-Wing cockpit: https://kalspriggs.com/wp-content/uploads/2014/12/b262918263290b76bdaaa35a4511684abe962dd2.jpg

**PRIMARY DISPLAY: 800×480 Raspberry Pi touchscreen (landscape, kiosk mode).** The app loads full-screen on this device as an always-on panel. This is the primary target viewport — NOT a phone. Phone access via Tailscale is secondary. All layout, grid density, font sizing, and touch targets must be designed for 800×480 landscape first. No browser chrome assumed.

</domain>

<decisions>
## Implementation Decisions

### Colour Palette (replaces Tron palette)

- **D-01:** Primary accent: warm amber `#E8A020`. Used for structural chrome — panel borders, section labels, headings, title.
- **D-02:** Health-state green: muted `#4ADE80` at 80% opacity. Used ONLY for healthy/online status indicators. Not a general accent.
- **D-03:** Alert red: `#FF3B3B`. Used for offline/down status and warning outlines.
- **D-04:** Panel background: near-black `#0D0D0D` for card/panel faces. Structural seam colour: `#1A1A1A`.
- **D-05:** Off-white stencil labels: `#C8C8C8` for secondary text, values, timestamps.
- **D-06:** Amber at 20% opacity (`rgba(232,160,32,0.20)`) for panel borders at rest; full amber on active/hover.
- **D-07:** NO cyan, NO neon blue, NO `#00c8ff`. Strip all Tron palette values.

### Background — Instrument Wall Panel

- **D-08:** Background is a **physical instrument wall**. Dark structural segments divided by visible amber seam lines (`1px solid rgba(232,160,32,0.15)`). The seams form a grid of panel "slots" — not an animated light grid.
- **D-09:** **Decorative SVG wiring** rendered as a fixed-position SVG overlay behind cards. Paths represent bundled cable runs / PCB traces connecting panel sections — organic but geometric (horizontal/vertical with corner curves). Amber at 8% opacity. Static, no animation. SVG is `pointer-events: none`.
- **D-10:** Subtle CRT scanline overlay: repeating-linear-gradient of 1px lines at 2px pitch, `rgba(0,0,0,0.15)` — baked into body `::after` pseudo-element. Adds texture depth without performance cost.
- **D-11:** NO animated traveling light pulses. NO glowing grid lines. Background is structural, not decorative.

### Status Indicators (replaces border traces)

- **D-12:** Primary status indicator: **round LED** — 10px circle with `box-shadow` radial glow in status colour.
  - Online/healthy: muted green `#4ADE80`, slow breathing pulse (3s ease-in-out, opacity 0.7→1.0)
  - Warning/degraded: amber `#E8A020`, faster pulse (1s)
  - Offline/down: red `#FF3B3B`, rapid flash (0.4s)
  - Unknown/stale: dim grey `#666666`, static (no animation)
- **D-13:** Cards with **non-healthy status** get an amber or red `box-shadow` outline glow on the card border (not the LED). Healthy cards have no outline glow — they blend into the panel.
- **D-14:** NO conic-gradient border traces. NO neon sweeps. Status communicated by LED + card outline glow only.

### Card Design — Instrument Cluster Panels

- **D-15:** Each card = a physical instrument section. Chamfered corners (CSS `clip-path: polygon(8px 0%, ...)` cutting the top-left and bottom-right corners at 8px). Inset appearance: `inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)` inner shadow.
- **D-16:** Card border: `1px solid rgba(232,160,32,0.20)` at rest. Amber `#E8A020` at 60% on hover/focus.
- **D-17:** Card header strip: `6px` tall amber bar across the full card top. Contains service name in uppercase stencil mono, flush left. Status LED flush right.
- **D-18:** Card body instrument type is **service-specific**:
  - **NAS card** → horizontal bar gauges with tick marks: CPU%, RAM%, disk usage per volume, temperature (°C). Each gauge is a labeled meter bar.
  - **Radarr / Sonarr / Lidarr / Bazarr** → dot matrix panel: N×M grid of small square LEDs (8px), each representing a queue item or monitored-item slot. Colour = status of that item.
  - **Plex** → signal strength bars (5 vertical bars, fill = stream count / max), plus active stream count label.
  - **SABnzbd** → download progress bar with speed label and queue count.
  - **Pi-hole** → two stat readouts: queries blocked % + total queries. Minimal display.
  - **UniFi** → client count + network health bar.
  - **Generic / unknown service** → icon + name + LED only. No data body.
- **D-19:** All Phase 2 card instruments use mock data from the existing `DashboardSnapshot` mock generator. No new data contracts needed — executors map existing mock fields to visual instrument types.
- **D-20:** Framer Motion used for card entrance (stagger 0.05s, y: 12px→0, opacity 0→1, spring). NO border trace animations. Entrance happens once on mount.

### App Header

- **D-21:** Fixed top bar. Two rows (same structure as before):
  1. **Title row:** `CORUSCANT` in amber monospace uppercase. Settings and Logs icon buttons right (44×44px touch targets).
  2. **NAS stats strip:** CPU% + RAM% left, disk usage + temp right. Values in amber. Labels in dim off-white.
- **D-22:** Header border-bottom: `1px solid rgba(232,160,32,0.30)`. Subtle amber glow `box-shadow: 0 1px 8px rgba(232,160,32,0.15)`.
- **D-23:** Header background: same near-black as body with slight transparency `rgba(13,13,13,0.95)` + `backdrop-filter: blur(4px)`.
- **D-24:** **Back navigation fix**: Settings and Logs pages must include a back/home link. AppHeader receives an optional `showBack: boolean` prop. When true, the title becomes a tappable link to `/`. Applied on all non-dashboard routes.

### Card Grid Layout

- **D-25:** Same tier grouping as before (STATUS / ACTIVITY / RICH DATA / SMART HOME). Section labels in amber uppercase.
- **D-26:** Grid optimized for 800×480 landscape: `repeat(auto-fill, minmax(180px, 1fr))`. At 800px wide with ~16px gutters, this yields ~4 cards per row — good density for the kiosk display. Cards should be ~160px tall minimum to show instrument content without scrolling.
- **D-27:** Available viewport area at 800×480: subtract header (~72px) + bottom banner (~48px when visible) = ~360px card grid height. The grid should ideally show 2 rows of cards without scrolling — 2×160px = 320px fits.
- **D-28:** Stale-data indicator: amber "STALE" badge on card when last poll >5 min. Same logic, different styling.

### Typography

- **D-28:** Monospace throughout — JetBrains Mono loaded, system monospace fallback. No change.
- **D-29:** Uppercase for labels, section headers, card names. Lowercase for values. Font weight 400 for values, 500/600 for labels.
- **D-30:** NO italic. Stencil / utilitarian feel — everything is structured, nothing is decorative.

### Now Playing Banner

- **D-31:** Same structure (fixed bottom strip, expand/collapse drawer). Restyled to match cockpit aesthetic.
- **D-32:** Collapsed: amber "▶ N STREAMS" label + scrolling ticker text in off-white mono.
- **D-33:** Expanded drawer: dark panel with amber top border. Stream rows in utilitarian list style — no rounded cards, just horizontal dividers.
- **D-34:** Stream row: `USER > TITLE S0XEX` left, `QUAL / DIRECT` right. Progress as a simple `1px` amber bar below the row text.

### Detail View Navigation

- **D-35:** Same React Router pattern (`/services/:serviceId`). Scroll restoration unchanged.
- **D-36:** Detail page: service name as page title (amber), status LED, mock metric slots as labeled readout rows (not floating cards). Each readout row: `LABEL ........... VALUE` format with dot leaders.
- **D-37:** Back navigation: AppHeader shows `← CORUSCANT` link on detail/settings/logs pages.

### SSE Data Pipeline

- **D-38:** No change to SSE plumbing, types, or mock data structure. Only visual layer changes.
- **D-39:** `DashboardSnapshot`, `ServiceStatus`, `NasStatus`, `PlexStream` types remain identical.

### Animation Philosophy

- **D-40:** Near-static at rest. Only LED status lights animate (breathing/pulsing per health state).
- **D-41:** Card entrance: stagger spring animation (once on mount only).
- **D-42:** Data value updates: snap immediately (no tween) — like a physical instrument changing reading.
- **D-43:** Banner expand/collapse: spring slide (Framer Motion `AnimatePresence`). Same as before but snappier.
- **D-44:** Reduce motion: `@media (prefers-reduced-motion: reduce)` — all animations disabled, LEDs static.

### Claude's Discretion

- Exact SVG wiring path coordinates and number of cable run paths
- Icon set for service-specific icons within instrument panels
- Exact tick mark count on NAS gauge bars
- Dot matrix dimensions per service card (e.g., 5×3 for Radarr queue)
- Exact chamfer angle/size on card corners
- Whether CRT scanline overlay uses `::after` on body or a fixed `<div>`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §DASH-01 through DASH-08 — all eight dashboard requirements this phase must satisfy

### Project Context
- `.planning/PROJECT.md` §Requirements (Dashboard — Core) — vision-level description
- `.planning/PROJECT.md` §Key Decisions — stack locked
- `.planning/PROJECT.md` §Constraints — ARM NAS, mobile-first, local-only

### Prior Phase Context
- `.planning/phases/01-infrastructure-foundation/01-CONTEXT.md` — SSE chosen, Fastify serves static, PUID/PGID

### Technology Stack Reference
- `CLAUDE.md` §Technology Stack — Framer Motion, CSS animation variant guidance
- `CLAUDE.md` §Stack Patterns by Variant — CSS-only animation pattern (chosen)

### Existing Implemented Code (Phase 2 Wave 1+2 — to be restyled)
- `packages/frontend/src/styles/globals.css` — current Tron CSS vars/keyframes to be REPLACED
- `packages/frontend/src/components/layout/GridBackground.tsx` — to be REPLACED with instrument wall panel
- `packages/frontend/src/components/layout/AppHeader.tsx` — to be RESTYLED + back nav added
- `packages/frontend/src/components/layout/NowPlayingBanner.tsx` — to be RESTYLED
- `packages/frontend/src/components/cards/ServiceCard.tsx` — to be REPLACED with instrument cluster
- `packages/frontend/src/components/cards/CardGrid.tsx` — section labels to be restyled
- `packages/frontend/src/components/ui/StatusDot.tsx` — to be RESTYLED as LED
- `packages/frontend/src/pages/DashboardPage.tsx` — minor restyle
- `packages/frontend/src/pages/ServiceDetailPage.tsx` — to be RESTYLED with dot-leader readouts
- `packages/frontend/src/pages/SettingsPage.tsx` — add back navigation
- `packages/frontend/src/pages/LogsPage.tsx` — add back navigation
- `packages/backend/src/mock/generator.ts` — may need minor extension for service-type-specific mock fields

</canonical_refs>

<specifics>
## Specific Ideas and References

- **Reference image:** X-Wing cockpit https://kalspriggs.com/wp-content/uploads/2014/12/b262918263290b76bdaaa35a4511684abe962dd2.jpg — warm amber/green instruments on near-black panels, physical segmented layout, utilitarian stencil labels
- **Decorative SVG wiring:** Static SVG paths (bundled cable runs / PCB traces) at amber 8% opacity, `pointer-events: none`, fixed position behind cards. Creates visual depth and reinforces the "physical panel" feel.
- **Service-specific instrument types:** NAS=gauges, Radarr/Sonarr/Lidarr/Bazarr=dot matrix, Plex=signal bars, SABnzbd=download bar, Pi-hole=stat readouts, UniFi=client count+bar. All fed by existing mock data.
- **Dot-leader readout format** for detail page: `LABEL ........... VALUE` — classic instrument display formatting.
- **Animation intensity slider** on Settings page still valid — now controls LED pulse speed/intensity rather than grid pulse.

</specifics>

<deferred>
## Deferred Ideas

- **Drag-to-reorder cards** — v2 (DASH-V2-02). Not Phase 2.
- **WebGL/Three.js upgrade** — not needed; CSS instrument panel aesthetic doesn't require WebGL.
- **Mobile PWA** — v2 (DASH-V2-03). Not Phase 2.
- **Sparkline trend charts** — v2 (DASH-V2-01). Meter bars in Phase 2 are sufficient.
- **Sound effects** (beeps, chirps) — discussed but deferred. No IP risk but adds complexity.

</deferred>

---

*Phase: 02-core-ui-shell*
*Context gathered: 2026-04-02 | Updated: 2026-04-03 — full aesthetic rework to Star Wars cockpit*
