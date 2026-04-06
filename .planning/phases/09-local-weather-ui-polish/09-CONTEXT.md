# Phase 9: Local Weather + UI Final Polish — Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Two parallel tracks:

1. **Weather widget** — Current local weather (animated SVG icon + temperature) in the AppHeader right column. Backend polls Open-Meteo every 15 minutes. User enters zip code once in Settings; backend geocodes to lat/lon and caches it.

2. **UI final polish** — Claude enumerates visual micro-issues before planning, plus a set of user-specified fixes and living/breathing enhancements across the dashboard.

Phase ends when:
- AppHeader shows animated weather icon + temperature in the right column
- Weather updates automatically every 15 minutes; stale indicator on failure
- Zip code entered once in Settings persists across restarts
- All Claude-identified visual micro-issues resolved
- DOWNLOADS tile height capped + long-title marquee active
- Speed numbers in DOWNLOADS scaled up and colorful
- Webhook events appear legibly in the log viewer
- Settings page has side-rail navigation with section groupings

</domain>

<decisions>
## Implementation Decisions

### Weather: Source + Data

- **D-01:** Weather source: **Open-Meteo** (`api.open-meteo.com`). Free, no API key, no account. REST JSON. Returns temp + WMO weather code.
- **D-02:** Location input: **zip code** in Settings. Backend calls Open-Meteo's free geocoding API (`geocoding-api.open-meteo.com/v1/search?name={zip}`) on first save to convert zip → lat/lon. Resolved coordinates cached in `kvStore` under a key like `weather.lat` / `weather.lon`. Re-geocodes only when zip changes.
- **D-03:** Poll interval: **15 minutes**. Cached result served until next poll. On fetch failure: serve last-known value from `kvStore` + stale timestamp; frontend shows `StaleIndicator` component (already exists at `packages/frontend/src/components/ui/StaleIndicator.tsx`).
- **D-04:** Weather data stored in `kvStore` as JSON (`weather.current`): `{ temp_f, wmo_code, fetched_at }`. No new SQLite tables required.

### Weather: Display in AppHeader

- **D-05:** Placement: **right column** of AppHeader, left of the Settings + Logs icons. Single row, 44px height maintained. Layout within right column: `[temp + icon | ⚙ 📋]`.
- **D-06:** Condition display: **animated custom SVG icons**, ~28–32px. Amber/warm palette matching cockpit. Animations are pure CSS `@keyframes` on `transform` / `opacity` only — GPU-composited, ARM64-safe. Icon set:
  | Condition | WMO codes | Animation |
  |-----------|-----------|-----------|
  | Sun | 0 | Rays rotate slowly (20s loop) |
  | Partly cloudy | 1–2 | Cloud drifts slightly left/right |
  | Overcast | 3 | Slow opacity breathe |
  | Rain | 51–67, 80–82 | 3 drops fall in staggered loop |
  | Snow | 71–77, 85–86 | Flakes drift down slowly |
  | Storm | 95–99 | Bolt flicker/pulse |
  | Fog | 45–48 | Horizontal band fade in/out |
- **D-07:** Temperature text is larger than the current header element sizes — prominent at kiosk distance.

### Header Resizing + Disconnect Dot

- **D-08:** Disconnect dot: color changed to **red** (`#ff4444`) with stronger glow (`box-shadow: 0 0 8px 3px rgba(255,68,68,0.7)`), size increased (6px → 10px). Red = alarm state, not amber ambiguity.
- **D-09:** Header text and icon sizes bumped up to fill the 44px boundaries — `CORUSCANT` title, nav icons, and weather text all slightly larger than the dashboard body text. The header should read as the "commander" of the UI, especially from kiosk distance.

### DOWNLOADS Tile: Layout + UX

- **D-10:** Expanded DOWNLOADS tile **max-height capped** to match the NETWORK tile height. Uses the available space, but does not extend below the grid line. Implement via `max-height` CSS matching the NETWORK container's computed height.
- **D-11:** Long filenames/titles in DOWNLOADS: **marquee scroll** — CSS `@keyframes translateX` on the title element when text overflows. Brief pause (~2s) at start position before scrolling begins, then loops. Same visual pattern as `NowPlayingBanner` title cycling (Phase 5). No JS timer required — pure CSS animation with `animation-delay`.
- **D-12:** Download/upload speed numbers: **scaled up** to match Pi-hole stat text size. Speed text colored: download speed in Tron blue (`#00c8ff`); upload speed in amber (`#E8A020`). Makes live throughput the visual anchor of the tile.

### Logging: Webhook Event Legibility

- **D-13:** Webhook events logged with a **consistent, distinguishable format**: `[WEBHOOK] SERVICE → event_type → "title"`. Examples:
  - `[WEBHOOK] RADARR → grab → "The Dark Knight (2008)"`
  - `[WEBHOOK] SONARR → download_complete → "Breaking Bad S05E16"`
  - `[WEBHOOK] TAUTULLI → PlaybackStart → "user: john"`
  - Log level: `info`. Service tag in the log viewer: the relevant arr/service name. This makes webhook rows instantly scannable vs. poll heartbeat rows.

### Settings Page Restructure

- **D-14:** Settings page navigation: **left side rail** with section groupings as vertical nav items. Replaces the current single-column scroll.
- **D-15:** Side rail sections and their service tabs:
  | Section | Tabs |
  |---------|------|
  | MEDIA | Radarr · Sonarr · Lidarr · Bazarr · Prowlarr · Readarr · Plex · SABnzbd |
  | NETWORK | Pi-hole · UniFi |
  | SYSTEM | NAS · Weather (new) |
  | NOTIFICATIONS | Pushover |
  | LOGS | Retention · Purge |
- **D-16:** Within each section, the **existing sliding tab component** is preserved — side rail selects the section, tabs select the service. No new tab component needed.
- **D-17:** Side rail styling: amber vertical nav items, active item highlighted with amber left border + glow. Matches cockpit panel-selector aesthetic.

### Living/Breathing UI Enhancements (Polish Pass)

- **D-18:** Claude will enumerate visual micro-issues (spacing, alignment, typography drift, animation timing) before writing plans. This is a **mandatory pre-plan audit step**.
- **D-19:** Ambient micro-animations to add across the dashboard:
  - **LED glow pulse on state change** — when a service transitions status, its LED briefly over-pulses before settling to steady state
  - **Tile entrance stagger** — cards animate in with a staggered delay on initial load (already partially present via Framer Motion — verify and tighten timing)
  - **Animated metric count-up** — key numeric values (CPU%, client counts, throughput) animate from previous value to new value on update (CSS counter or JS tween, short 300–500ms duration)
  - **Animated weather SVGs** — per D-06
  - **DOWNLOADS title marquee** — per D-11

### Claude's Discretion

- WMO code → icon mapping for edge cases (e.g. freezing drizzle, blowing snow) — Claude picks the closest of the 7 defined icons
- Exact `max-height` value for DOWNLOADS tile — measure NETWORK tile height at runtime or match via CSS variable
- Marquee scroll speed — slow enough to read, fast enough not to annoy (~40px/s is a reasonable starting point)
- Metric count-up duration and easing — 300–500ms, ease-out

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Context
- `.planning/ROADMAP.md` — Phase 9 requirements: WTHR-01, WTHR-02
- `.planning/REQUIREMENTS.md` — Full requirement specs
- `.planning/phases/05-ui-v2-instrument-panel-polish/05-CONTEXT.md` — Layout constraints (D-01 no-scroll 800×480, NAS header pattern, NowPlayingBanner cycling pattern for marquee reference)
- `.planning/phases/08-logging-polish-performance/08-CONTEXT.md` — Log viewer architecture, SSE log-entry event, pino transport, kvStore usage patterns

### Key Source Files
- `packages/frontend/src/components/layout/AppHeader.tsx` — Header to modify (weather widget + disconnect dot + size bump)
- `packages/frontend/src/components/ui/StaleIndicator.tsx` — Reuse for stale weather display
- `packages/frontend/src/pages/SettingsPage.tsx` — Settings page to restructure with side rail
- `packages/backend/src/routes/settings.ts` — Settings route pattern; add `weather` to VALID_SERVICES
- `packages/backend/src/schema.ts` — `kvStore` table for weather cache + location storage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppHeader.tsx` — 3-column grid, 44px fixed. Right column currently has Settings+Logs icon links. Weather widget slots in left of those icons.
- `StaleIndicator.tsx` — Already handles "last-known + stale" display pattern. Use for weather fetch failures.
- `kvStore` SQLite table — Key-value store already in schema. No migration needed; just new keys (`weather.lat`, `weather.lon`, `weather.current`, `weather.zip`).
- `NowPlayingBanner` marquee pattern — Reference for CSS scroll animation on long titles in DOWNLOADS.
- Framer Motion — Already installed; entrance animations partially in place. Tighten stagger timing in polish pass.

### Established Patterns
- Backend adapters live in `packages/backend/src/adapters/` — create `weather.ts` following the same shape
- Settings route `VALID_SERVICES` array — add `'weather'` to expose a settings endpoint
- Webhook log format: currently `console.log(JSON.stringify(...))` — upgrade to structured pino call with `[WEBHOOK]` prefix per D-13
- `kvStore` read/write: already used in settings routes — same pattern for weather cache

### Integration Points
- AppHeader receives props from `App.tsx` — add `weatherData` prop (temp + wmo_code + stale flag)
- `useDashboardSSE.ts` hook — weather updates pushed via SSE `dashboard-update` event or a new `weather-update` named event
- SettingsPage tabs — currently flat array; refactor to grouped structure with side rail

</code_context>

<specifics>
## Specific Details from Discussion

- **Disconnect dot must be obviously red** — user said "can we make the disconnect red as well, and bigger? easier to see when it's needed." Current amber dot is ambiguous at distance.
- **Weather text should be prominent** — "the weather should also be big." Larger than body text, reads from kiosk distance.
- **Header text/icons slightly bigger overall** — "slightly tighter to the existing boundaries so that the text up there is slightly bigger than the rest of the app." Header asserts visual hierarchy.
- **Downloads height parity** — "max out the dropdown to match the network container" — height alignment between left and right columns of the grid.
- **Long titles scroll** — "rolls through title every few seconds if it's too large." CSS marquee, not truncation.
- **Speed numbers colorful + large** — "enough space to match text size of pihole stats." Blue for download, amber for upload.
- **Webhook logs legible** — "can we make sure we can see easily in logs when we get webhooks and we capture the event legibly."
- **Settings side rail** — "a siderail for each tile, and then within each side rail 'section' like media, we have the existing sliding tab structure. just thins things out a bit there."
- **Living/breathing goal** — user explicitly wants the dashboard to feel alive. Weather SVG animations, metric count-ups, LED over-pulse on state change, and entrance stagger all serve this.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-local-weather-ui-polish*
*Context gathered: 2026-04-06*
