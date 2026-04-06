# Phase 9: Local Weather + UI Final Polish — Research

**Researched:** 2026-04-06
**Domain:** Open-Meteo weather API integration, animated SVG icons, AppHeader extension, Settings side-rail restructure, CSS/Framer Motion polish pass
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Weather: Source + Data**
- D-01: Weather source: Open-Meteo (`api.open-meteo.com`). Free, no API key. Returns temp + WMO weather code.
- D-02: Location input: zip code in Settings. Backend geocodes via `geocoding-api.open-meteo.com/v1/search?name={zip}`. Coordinates cached in `kvStore` under `weather.lat` / `weather.lon`. Re-geocodes only when zip changes.
- D-03: Poll interval: 15 minutes. On fetch failure: serve last-known value + stale timestamp; frontend shows `StaleIndicator` (already at `packages/frontend/src/components/ui/StaleIndicator.tsx`).
- D-04: Weather data stored in `kvStore` as JSON (`weather.current`): `{ temp_f, wmo_code, fetched_at }`. No new SQLite tables.

**Weather: Display in AppHeader**
- D-05: Placement: right column of AppHeader, left of Settings + Logs icons. 44px height maintained. Layout: `[temp + icon | ⚙ 📋]`.
- D-06: Condition display: animated custom SVG icons, ~28–32px, amber/warm palette. Animations are pure CSS `@keyframes` on `transform` / `opacity` only. Icon set:
  - Sun (WMO 0): rays rotate slowly (20s loop)
  - Partly cloudy (WMO 1–2): cloud drifts slightly left/right
  - Overcast (WMO 3): slow opacity breathe
  - Rain (WMO 51–67, 80–82): 3 drops fall in staggered loop
  - Snow (WMO 71–77, 85–86): flakes drift down slowly
  - Storm (WMO 95–99): bolt flicker/pulse
  - Fog (WMO 45–48): horizontal band fade in/out
- D-07: Temperature text prominent at kiosk distance (larger than current header element sizes).

**Header Resizing + Disconnect Dot**
- D-08: Disconnect dot: color changed to red (`#ff4444`), glow `box-shadow: 0 0 8px 3px rgba(255,68,68,0.7)`, size 6px → 10px.
- D-09: Header text and icon sizes bumped up — CORUSCANT title, nav icons, weather text all slightly larger.

**DOWNLOADS Tile: Layout + UX**
- D-10: DOWNLOADS tile max-height capped to match NETWORK tile height via CSS `max-height`.
- D-11: Long filenames: CSS `@keyframes translateX` marquee. Brief pause (~2s) before scroll, then loops. Pure CSS, no JS timer.
- D-12: Speed numbers scaled up to match Pi-hole stat text size. Download speed in `#00c8ff`; upload speed in `#E8A020`.

**Logging: Webhook Event Legibility**
- D-13: Webhook events logged with format: `[WEBHOOK] SERVICE → event_type → "title"`. Log level: `info`. Service tag is the arr/service name.

**Settings Page Restructure**
- D-14: Settings page: left side rail with section groupings as vertical nav items.
- D-15: Side rail sections:
  - MEDIA: Radarr · Sonarr · Lidarr · Bazarr · Prowlarr · Readarr · Plex · SABnzbd
  - NETWORK: Pi-hole · UniFi
  - SYSTEM: NAS · Weather (new)
  - NOTIFICATIONS: Pushover
  - LOGS: Retention · Purge
- D-16: Within each section, existing sliding tab component preserved. Side rail selects section; tabs select service.
- D-17: Side rail styling: amber vertical nav items, active item with amber left border + glow.

**Living/Breathing UI Enhancements**
- D-18: Claude enumerates visual micro-issues before planning (MANDATORY pre-plan audit step — see section below).
- D-19: Ambient micro-animations:
  - LED glow pulse on state change (over-pulse before settling)
  - Tile entrance stagger (verify and tighten Framer Motion timing)
  - Animated metric count-up (300–500ms, ease-out) for CPU%, client counts, throughput
  - Animated weather SVGs (per D-06)
  - DOWNLOADS title marquee (per D-11)
- D-20: Text sharpness pass — audit `backdropFilter: blur()`, `-webkit-font-smoothing`, and any `filter: blur()` on parent containers.

### Claude's Discretion

- WMO code → icon mapping for edge cases (freezing drizzle, blowing snow) — Claude picks closest of 7 defined icons
- Exact `max-height` value for DOWNLOADS tile — measure NETWORK tile height at runtime or match via CSS variable
- Marquee scroll speed — ~40px/s is a reasonable starting point
- Metric count-up duration and easing — 300–500ms, ease-out

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WTHR-01 | AppHeader top nav bar shows current temperature and a weather condition indicator (icon or abbreviated label); weather updates automatically on a configured interval without user interaction | Open-Meteo forecast API at `api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&current=temperature_2m,weather_code` returns both fields; 15-minute polling via `setInterval` in PollManager-style pattern; result stored in kvStore |
| WTHR-02 | User sets location (lat/lon) once in Settings; weather persists across restarts; if fetch fails, header shows last-known value with stale indicator | Open-Meteo geocoding API converts zip → lat/lon; kvStore already used for persistent key-value state; StaleIndicator component already exists |
</phase_requirements>

---

## Summary

Phase 9 has two parallel tracks. Track 1 is a new weather widget: a backend adapter polls Open-Meteo every 15 minutes, caches the result in the existing `kvStore`, and surfaces it via the existing SSE `dashboard-update` event by embedding weather data in `DashboardSnapshot`. The frontend renders a compact animated SVG icon + temperature in the right column of the existing 3-column AppHeader grid. Track 2 is a broad UI polish pass covering a mandatory micro-issue audit, Settings page restructure to a side-rail layout, DOWNLOADS tile height + marquee + speed color changes, webhook log formatting, disconnect dot color/size, and living/breathing animation enhancements.

All integration patterns are already established in the codebase. The weather adapter follows the exact same shape as `nas.ts`, `pihole.ts`, etc. The `kvStore` table (already in `schema.ts`) needs no migration — just new keys (`weather.zip`, `weather.lat`, `weather.lon`, `weather.current`). The SSE route and `DashboardSnapshot` type need a new `weather` field. The settings route needs `'weather'` added to `VALID_SERVICES`. The SettingsPage needs a structural refactor from flat-tab to side-rail, but the per-service form logic is unchanged.

**Primary recommendation:** Wire weather as a standalone background timer (not inside PollManager's service loop — weather is not a "service") that writes to `kvStore` and triggers a broadcast. Embed `WeatherData | null` in `DashboardSnapshot` so the existing SSE pipe delivers it to all clients without a new event type.

---

## Standard Stack

### Core (no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| axios | already installed | HTTP client for Open-Meteo calls | Same pattern as all other adapters |
| better-sqlite3 (via Drizzle) | already installed | kvStore read/write for weather cache | Already used for `logs.retention_days`, UniFi peaks |
| Framer Motion | already installed | Entrance stagger, LED over-pulse animations | Already in use throughout frontend |

### No New npm Packages Required

All weather integration and UI polish work is achievable with the existing installed stack. Open-Meteo is a free REST JSON API — no SDK needed, plain `axios.get()` is sufficient.

**Verification:** `npm view openmeteo version` → 1.x exists but is unnecessary given axios is already installed and the API is simple JSON.

---

## Open-Meteo API Reference (HIGH confidence — verified against official docs)

### Forecast Endpoint
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current=temperature_2m,weather_code
  &temperature_unit=fahrenheit
```

**Response shape:**
```json
{
  "current": {
    "time": "2026-04-06T14:00",
    "temperature_2m": 68.3,
    "weather_code": 2
  },
  "current_units": {
    "temperature_2m": "°F",
    "weather_code": "wmo code"
  }
}
```

### Geocoding Endpoint
```
GET https://geocoding-api.open-meteo.com/v1/search
  ?name={zip_or_city}
  &count=1
  &language=en
  &format=json
```

**Response shape:**
```json
{
  "results": [
    {
      "id": 5128581,
      "name": "New York City",
      "latitude": 40.71427,
      "longitude": -74.00597,
      "country_code": "US",
      "timezone": "America/New_York"
    }
  ]
}
```

**Key facts:**
- `name` parameter accepts postal codes directly (e.g. `"94102"`)
- `count=1` returns the single best match
- No API key required for non-commercial use
- Returns `{}` (no `results` key) when nothing matches — must guard against this
- CORS: API is callable from the backend only (no CORS headers for arbitrary origins)

### WMO Code → Icon Mapping (complete)
| WMO Codes | Condition | Icon |
|-----------|-----------|------|
| 0 | Clear sky | Sun |
| 1, 2 | Mainly clear, partly cloudy | Partly cloudy |
| 3 | Overcast | Overcast |
| 45, 48 | Fog, depositing rime fog | Fog |
| 51, 53, 55 | Drizzle (light/moderate/dense) | Rain |
| 56, 57 | Freezing drizzle | Rain (Claude's discretion) |
| 61, 63, 65 | Rain (slight/moderate/heavy) | Rain |
| 66, 67 | Freezing rain | Rain (Claude's discretion) |
| 71, 73, 75 | Snowfall | Snow |
| 77 | Snow grains | Snow |
| 80, 81, 82 | Rain showers | Rain |
| 85, 86 | Snow showers | Snow |
| 95 | Thunderstorm | Storm |
| 96, 99 | Thunderstorm with hail | Storm |

---

## Architecture Patterns

### Weather Backend: Standalone Timer (not in PollManager)

Weather is fundamentally different from service monitoring: it is not a "configured service" with an API key — it is a background timer that reads lat/lon from kvStore and writes results back. The recommended pattern is a standalone `weatherPoller.ts` module started in `index.ts`:

```typescript
// packages/backend/src/weather-poller.ts
import axios from 'axios'
import { getDb } from './db.js'
import { kvStore } from './schema.js'
import { eq } from 'drizzle-orm'
import { pollManager } from './poll-manager.js'

const WEATHER_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes (D-03)

export function startWeatherPoller(): () => void {
  const tick = async () => {
    const db = getDb()
    const latRow = db.select().from(kvStore).where(eq(kvStore.key, 'weather.lat')).get()
    const lonRow = db.select().from(kvStore).where(eq(kvStore.key, 'weather.lon')).get()
    if (!latRow || !lonRow) return // not configured yet

    try {
      const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: latRow.value,
          longitude: lonRow.value,
          current: 'temperature_2m,weather_code',
          temperature_unit: 'fahrenheit',
        },
        timeout: 10_000,
      })
      const current = res.data?.current
      const payload = JSON.stringify({
        temp_f: current.temperature_2m,
        wmo_code: current.weather_code,
        fetched_at: new Date().toISOString(),
      })
      db.insert(kvStore)
        .values({ key: 'weather.current', value: payload, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: kvStore.key, set: { value: payload, updatedAt: new Date().toISOString() } })
        .run()
      pollManager.broadcastSnapshot() // push immediately to SSE clients
    } catch (err) {
      // D-03: On failure, do NOT overwrite weather.current — keep last known value
      // Frontend will show StaleIndicator based on fetched_at age
    }
  }

  void tick() // immediate first poll
  const timer = setInterval(() => void tick(), WEATHER_INTERVAL_MS)
  return () => clearInterval(timer)
}
```

### Weather in DashboardSnapshot

Add `weather?: WeatherData | null` to the `DashboardSnapshot` interface in `packages/shared/src/types.ts`. PollManager's `getSnapshot()` reads from kvStore to populate this field on every snapshot build.

```typescript
// packages/shared/src/types.ts (addition)
export interface WeatherData {
  temp_f: number
  wmo_code: number
  fetched_at: string  // ISO 8601 — frontend uses this for stale detection
}
```

### Weather Settings Route

`'weather'` is NOT added to `VALID_SERVICES` in `settings.ts` (that array is for service adapters with API keys). Instead, create a dedicated `/api/settings/weather` route pair (GET + POST) that reads/writes `weather.zip`, `weather.lat`, `weather.lon` to `kvStore`. POST triggers geocoding, stores resolved coords, and fires the weather poller tick immediately.

### SSE: No New Event Type Needed

`DashboardSnapshot` already flows through the SSE pipe as `dashboard-update`. Adding `weather` to the snapshot shape means all connected clients receive weather updates automatically. The `snapshotFingerprint` in `sse.ts` must include `weather` to avoid spurious pushes:

```typescript
// Add to snapshotFingerprint() in sse.ts
weather: snapshot.weather,
```

### AppHeader Props Extension

`AppHeader` receives a new `weatherData?: WeatherData | null` prop passed from `App.tsx`. App reads it from `snapshot.weather`. When `weatherData` is null, the weather widget renders nothing (unconfigured state). When `fetched_at` age > 15 minutes + some grace period, render `StaleIndicator`.

### Settings Side-Rail Structure

The current `SettingsPage` is a flat tab bar with `overflowX: auto`. Replacing it with a two-column layout (side rail left, content right) requires:

1. Outer container: `display: flex, flexDirection: row, gap: '16px'`
2. Left rail: fixed width ~120px, vertical list of section nav items (MEDIA, NETWORK, SYSTEM, NOTIFICATIONS, LOGS)
3. Right content: flex: 1, existing tab + form panel (tabs within each section)
4. State: `activeSection` (replaces partial logic), `activeTab` within that section
5. URL param: `?section=media&service=radarr` (or preserve existing `?service=radarr` with section derived)

The existing `isNotificationsTab` / `isLogsTab` special-tab detection pattern extends to handle `activeSection` routing.

---

## Mandatory UI Micro-Issue Audit (D-18)

### Files Audited
- `packages/frontend/src/components/layout/AppHeader.tsx`
- `packages/frontend/src/pages/SettingsPage.tsx`
- `packages/frontend/src/pages/DashboardPage.tsx`
- `packages/frontend/src/components/cards/CardGrid.tsx`
- `packages/frontend/src/components/cards/ServiceCard.tsx` (full file)
- `packages/frontend/src/components/layout/NowPlayingBanner.tsx`
- `packages/frontend/src/styles/globals.css`
- `packages/frontend/src/App.tsx`

### Confirmed Micro-Issues (concrete, actionable)

**ISSUE-01: Disconnect dot is amber, 6px — D-08 requires red, 10px**
- Location: `AppHeader.tsx` line 150–158
- Current: `backgroundColor: 'var(--cockpit-amber)'`, `width: '6px', height: '6px'`, `boxShadow: '0 0 5px 2px rgba(232, 160, 32, 0.6)'`
- Required: `#ff4444`, 10px, `box-shadow: 0 0 8px 3px rgba(255,68,68,0.7)` per D-08

**ISSUE-02: AppHeader backdrop-filter blur bleeds into text rendering — D-20**
- Location: `AppHeader.tsx` line 63: `backdropFilter: 'blur(4px)'`
- Effect: blur on the header background container can cause sub-pixel text blur on child elements in WebKit/Blink
- Fix: Isolate the blur to a `::before` pseudo-element or a separate sibling div behind the text; or contain with `isolation: isolate` on text containers

**ISSUE-03: NowPlayingBanner backdrop-filter may blur Plex banner text — D-20**
- Location: `NowPlayingBanner.tsx` line 136: `backdropFilter: 'blur(8px)'`
- Same root cause as ISSUE-02 — `blur(8px)` is more aggressive

**ISSUE-04: globals.css `-webkit-font-smoothing: antialiased` — D-20**
- Location: `globals.css` line 46
- `antialiased` renders thinner strokes; `subpixel-antialiased` is crisper on non-Retina displays but `antialiased` is correct for Retina (kiosk is Retina-class). Keep `antialiased`, fix is at the `backdropFilter` layer instead.

**ISSUE-05: DOWNLOADS tile has no height constraint — D-10**
- Location: `CardGrid.tsx` — the Media tile div (lines 174–207) has no `maxHeight` applied
- When many downloads are active, tile can grow and misalign with the NETWORK tile
- Fix: apply `maxHeight` matching NETWORK tile height via CSS custom property or explicit measurement

**ISSUE-06: DOWNLOADS title uses `textOverflow: 'ellipsis'`, truncates — D-11**
- Location: `CardGrid.tsx` line 88: `overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'`
- Required: CSS marquee scroll when text overflows (not ellipsis truncation)

**ISSUE-07: Download/upload speed coloring — D-12**
- Location: `CardGrid.tsx` line 104: speed number is `color: 'var(--cockpit-amber)'`
- Required: download speed in `#00c8ff`, upload speed in `#E8A020`. Currently SABnzbd shows download speed only. No upload speed shown at all.
- Note: SABnzbd API does provide upload speed as `speedMBs` (download); upload is not currently polled. Verify if SABnzbd exposes upload speed in queue API response — if not, this only applies to download coloring.

**ISSUE-08: DOWNLOADS speed number font size appears correct (22px) but lacks color distinction — D-12**
- Location: `CardGrid.tsx` line 104 — `22px` is already present, color change needed only

**ISSUE-09: Tile entrance stagger animation — D-19**
- Location: `CardGrid.tsx` — the NAS ServiceCard and pihole ServiceCard use `index` prop for stagger, but the Media tile div (lines 174–207) is a raw `<div>` with no Framer Motion wrapper
- Fix: wrap Media tile in `<motion.div>` with stagger delay based on `globalIndex`

**ISSUE-10: ServiceCard.tsx uses motion wrappers but stagger may not be tightly synchronized — D-19**
- `motion` is imported from `framer-motion` in `ServiceCard.tsx` (line 3) — confirms Framer Motion is in use on cards
- Verify timing values at implementation time; research flags this as needing audit

**ISSUE-11: Webhook log format is currently console.log / unstructured — D-13**
- Location: `packages/backend/src/routes/arr-webhooks.ts` — webhook handler logs raw JSON without `[WEBHOOK]` prefix or structured format
- Fix: upgrade to `fastify.log.info({ service: serviceName }, '[WEBHOOK] SERVICE → event_type → "title"')` pattern

**ISSUE-12: Settings page horizontal tab bar overflows on narrow viewports — D-14**
- Location: `SettingsPage.tsx` lines 454–558: horizontal scrolling `overflowX: auto` tab bar with 13 tabs
- At 800px width this works but is cramped; at phone widths it requires horizontal scroll
- D-14 requires side-rail replacement; audit confirms this is the correct intervention

**ISSUE-13: Settings page lacks `'weather'` tab — new requirement**
- `SERVICES` constant (line 204) does not include `weather`
- Side-rail restructure must include Weather under SYSTEM section

**ISSUE-14: AppHeader text-display class at 24px — D-09 requires slightly larger**
- `CORUSCANT` title uses `.text-display` (24px per globals.css line 88)
- D-09 says header text should be slightly larger than dashboard body text to assert visual hierarchy
- Current body text is 15px (`.text-body`); 24px title is already larger, but may need fine-tuning
- Implementation: bump to 26–28px inline style or via new `.text-header-title` class

**ISSUE-15: No animated metric count-up for key numerics — D-19**
- NAS CPU%, Pi-hole client counts, throughput numbers update instantly on SSE push with no transition
- Fix: CSS counter-based or JS number tween (300–500ms ease-out) for values that change frequently

### Issues NOT Found (verified clean)
- `StaleIndicator.tsx` is correct and ready to reuse for weather stale display
- `kvStore` schema is correct — no migration needed for weather keys
- `useDashboardSSE.ts` handles SSE correctly; adding `weather` to `DashboardSnapshot` is the only required change
- LED animations (`ledBreathe`, `ledPulseWarn`, `ledFlashDown`) are correctly defined in globals.css
- `@keyframes marquee` already exists in globals.css and is used by NowPlayingBanner — reusable for DOWNLOADS marquee

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP fetch to Open-Meteo | Custom fetch() | axios (already installed) | Timeout, error handling, same pattern as all other adapters |
| Weather state management | New React state store | Extend existing `DashboardSnapshot` + SSE pipe | SSE already delivers all dashboard state; adding one field avoids a parallel data channel |
| Animated SVG icons | Canvas or Three.js | Inline SVG + CSS `@keyframes` on `transform`/`opacity` | ARM64-safe, GPU-composited, zero JS dependency |
| Marquee scroll | JS IntersectionObserver + scroll | CSS `@keyframes translateX` | `@keyframes marquee` already exists in globals.css; pure CSS is zero-runtime-cost |
| Settings section routing | New router | `useSearchParams` with `?section=media&service=radarr` | Existing URL-param tab pattern, already in SettingsPage |

---

## Common Pitfalls

### Pitfall 1: Geocoding ZIP vs. City Name Ambiguity
**What goes wrong:** Open-Meteo geocoding API's `name` param accepts both city names and ZIP codes, but a 5-digit ZIP like `94102` can match city names in non-US countries first.
**Why it happens:** No country-code scoping by default.
**How to avoid:** Append `&countryCode=US` to geocoding request when user enters a numeric-only zip.
**Warning signs:** Geocoding returns a non-US location for a known US zip.

### Pitfall 2: Open-Meteo Returns No Results
**What goes wrong:** `results` key is absent from geocoding response (not `results: []` — the key is missing entirely) when nothing matches.
**Why it happens:** API design choice, not a network error.
**How to avoid:** Guard: `if (!res.data?.results?.length) throw new Error('No location found for zip')`. Return 400 to frontend with "Location not found" message.

### Pitfall 3: Weather.current kvStore Value is Stale String JSON
**What goes wrong:** Frontend receives `fetched_at` from `weather.current` kvStore value parsed from JSON, but computes stale age wrong.
**Why it happens:** `StaleIndicator` currently checks against a 5-minute threshold (`fiveMinutes = 5 * 60 * 1000`). Weather is only polled every 15 minutes — showing "stale" after 5 minutes is premature.
**How to avoid:** Either pass a custom threshold to StaleIndicator (requires prop addition) or create a `WeatherStaleIndicator` variant that uses a 20-minute threshold (15 min poll + 5 min grace).

### Pitfall 4: AppHeader Right Column Overflow at 44px
**What goes wrong:** Adding weather widget to the right column of AppHeader (already contains 40px×40px Settings + Logs icons, 4px gap) can overflow the 44px height or push icons off screen.
**Why it happens:** Right column is `display: flex, gap: '4px', justifyContent: 'flex-end'`. Adding a weather block without size discipline causes overflow.
**How to avoid:** Weather widget must be strictly inline with 44px constraint: icon at 28–32px, temperature text at ≤20px line-height, all within a `height: '44px'` flex container. Use `flexShrink: 0` on icon buttons to prevent compression.

### Pitfall 5: backdropFilter Blur on Text Layers
**What goes wrong:** `backdropFilter: blur(4px)` on the header container causes text rendered within the same stacking context to appear slightly blurred in Chrome/Safari.
**Why it happens:** In some WebKit/Blink versions, the blur filter propagates to child text rasterization layers.
**How to avoid:** Move the blur to a `::before` pseudo-element positioned `inset: 0; z-index: -1` within the header, keeping text in a separate, unblurred stacking context. Alternatively, `isolation: isolate` on text wrappers can help.

### Pitfall 6: Settings Side-Rail Breaks Existing ?service= URL Routing
**What goes wrong:** External links or bookmarks using `?service=radarr` stop working when SettingsPage is restructured.
**Why it happens:** Adding `?section=` means the old `?service=` must still be parsed to determine the active section.
**How to avoid:** Keep backward compatibility: if `?service=radarr` is present without `?section=`, derive the section from the service ID and set it. Side-rail click updates both `section` and `service` params.

### Pitfall 7: Metric Count-Up Causes Flicker on Fast SSE Updates
**What goes wrong:** NAS polls at 1-second intervals. If a count-up animation runs 300–500ms and a new value arrives in 1 second, animations overlap and cause visual flicker.
**Why it happens:** New value arrives while previous animation is still running.
**How to avoid:** Use `useRef` to track previous value and only animate when the delta exceeds a threshold (e.g., > 1% change for CPU%). Snap to value immediately if the previous animation hasn't finished (cancel and snap).

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
packages/backend/src/
├── adapters/
│   └── weather.ts          # fetchWeatherData(lat, lon): Promise<WeatherData>
├── weather-poller.ts       # startWeatherPoller(): () => void
└── routes/
    └── weather-settings.ts # GET/POST /api/settings/weather (zip → geocode → kvStore)

packages/frontend/src/
├── components/
│   ├── layout/
│   │   └── AppHeader.tsx   # +weatherData prop, WeatherWidget sub-component
│   └── weather/
│       └── WeatherIcon.tsx  # Animated SVG icons by WMO code
└── pages/
    └── SettingsPage.tsx    # Restructured with SideRail + section groupings
```

### Pattern: Weather Adapter Shape
```typescript
// packages/backend/src/adapters/weather.ts
// Source: follows same axios + try/catch + typed return pattern as all other adapters
export interface WeatherFetchResult {
  temp_f: number
  wmo_code: number
  fetched_at: string
}

export async function fetchWeatherData(lat: string, lon: string): Promise<WeatherFetchResult> {
  const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: { latitude: lat, longitude: lon, current: 'temperature_2m,weather_code', temperature_unit: 'fahrenheit' },
    timeout: 10_000,
  })
  return {
    temp_f: res.data.current.temperature_2m,
    wmo_code: res.data.current.weather_code,
    fetched_at: new Date().toISOString(),
  }
}
```

### Pattern: CSS Marquee for DOWNLOADS Title
```css
/* Add to globals.css — reuses the marquee keyframes pattern from .crt-sweep */
@keyframes downloadsMarquee {
  0%      { transform: translateX(0); }
  10%     { transform: translateX(0); }    /* 2s pause at animation-delay + 10% hold */
  90%     { transform: translateX(-100%); }
  100%    { transform: translateX(-100%); }
}
```

```tsx
// In DownloadActivity — when title text is long, apply marquee
<div style={{ overflow: 'hidden', position: 'relative' }}>
  <span style={{
    display: 'inline-block',
    whiteSpace: 'nowrap',
    animation: titleIsLong ? 'downloadsMarquee 8s linear infinite' : 'none',
    animationDelay: '2s',
  }}>
    {activeTitle}
  </span>
</div>
```

### Pattern: Animated SVG Icon Component
```tsx
// packages/frontend/src/components/weather/WeatherIcon.tsx
// All animations are CSS @keyframes on transform/opacity only — ARM64 safe (D-06, DASH-08)
export function WeatherIcon({ wmoCode, size = 28 }: { wmoCode: number; size?: number }) {
  // Map WMO code to one of 7 icon types
  const iconType = wmoToIcon(wmoCode)
  // Return inline SVG with CSS animation class
  // ...
}
```

### Pattern: PollManager.getSnapshot() Weather Integration
```typescript
// In PollManager.getSnapshot() — read weather from kvStore
getSnapshot(): DashboardSnapshot {
  const db = getDb()
  const weatherRow = db.select().from(kvStore).where(eq(kvStore.key, 'weather.current')).get()
  const weather = weatherRow ? (JSON.parse(weatherRow.value) as WeatherData) : null
  return {
    services: [...this.state.values()],
    nas: this.nasData,
    streams: this.plexStreams,
    plexServerStats: this.plexServerStats,
    weather,
    timestamp: new Date().toISOString(),
  }
}
```

### Pattern: Settings Side-Rail
```tsx
// SettingsPage — new structure
const SECTIONS = [
  { id: 'media', label: 'MEDIA', services: ['radarr','sonarr','lidarr','bazarr','prowlarr','readarr','plex','sabnzbd'] },
  { id: 'network', label: 'NETWORK', services: ['pihole','unifi'] },
  { id: 'system', label: 'SYSTEM', services: ['nas','weather'] },
  { id: 'notifications', label: 'NOTIFICATIONS', services: ['notifications'] },
  { id: 'logs', label: 'LOGS', services: ['logs'] },
] as const

// Outer layout: flex row
// Left: side rail (amber vertical nav, ~120px wide, amber left-border on active)
// Right: existing tab bar (scoped to current section's services) + form panel
```

---

## Runtime State Inventory

This phase adds new kvStore keys but does not rename or migrate any existing state.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | New keys: `weather.zip`, `weather.lat`, `weather.lon`, `weather.current` — do not exist yet | No migration; kvStore upsert creates them on first weather save |
| Live service config | No existing weather config in serviceConfig table | None |
| OS-registered state | None | None — verified by examining index.ts startup |
| Secrets/env vars | No new env vars required; Open-Meteo is unauthenticated | None |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Open-Meteo API (`api.open-meteo.com`) | Weather data fetch | Internet-accessible | N/A (free, no key) | Serve last-known kvStore value (stale indicator) |
| Open-Meteo Geocoding (`geocoding-api.open-meteo.com`) | Zip-to-coords on Settings save | Internet-accessible | N/A (free, no key) | Return error to user; no fallback needed (one-time operation) |
| Node.js (backend) | Weather poller | ✓ | 22.x | — |
| axios | HTTP client | ✓ | Already installed | — |
| Framer Motion | Animation polish | ✓ | Already installed | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (root `package.json`) |
| Config file | Root-level vitest config (implicit — `vitest run` at workspace root) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WTHR-01 | Weather adapter fetches from Open-Meteo, returns temp_f + wmo_code | unit | `npm test -- --reporter=verbose packages/backend/src/__tests__/weather-adapter.test.ts` | ❌ Wave 0 |
| WTHR-01 | Weather poller writes result to kvStore | unit | `npm test -- --reporter=verbose packages/backend/src/__tests__/weather-poller.test.ts` | ❌ Wave 0 |
| WTHR-01 | DashboardSnapshot includes weather field via getSnapshot() | unit | existing sse.test.ts can be extended | ✅ (extend) |
| WTHR-02 | Weather settings route geocodes zip and stores lat/lon | unit | `npm test -- --reporter=verbose packages/backend/src/__tests__/weather-settings.test.ts` | ❌ Wave 0 |
| WTHR-02 | On geocoding 0 results, returns 400 with "Location not found" | unit | same file as above | ❌ Wave 0 |
| WTHR-02 | StaleIndicator renders when fetched_at > threshold | unit | manual visual / existing StaleIndicator.tsx has no test | manual |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/backend/src/__tests__/weather-adapter.test.ts` — covers WTHR-01 adapter logic, axios mock
- [ ] `packages/backend/src/__tests__/weather-poller.test.ts` — covers WTHR-01 kvStore write on success, no-op on failure
- [ ] `packages/backend/src/__tests__/weather-settings.test.ts` — covers WTHR-02 geocoding route, 400 on no results, 400 on invalid zip

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Open-Meteo `current_weather` param (legacy) | `current=temperature_2m,weather_code` (v1 API) | Mid-2023 | `current_weather` is deprecated; use `current` with explicit field names |
| WMO codes in `current_weather.weathercode` | `current.weather_code` | With above | Same codes, different key name in response |

---

## Open Questions

1. **SABnzbd upload speed availability**
   - What we know: SABnzbd `/api?mode=queue` response includes `kbpersec` (download). Upload speed from a downloading client is generally not measured by the NZB client itself.
   - What's unclear: Does SABnzbd API expose current upload throughput, or is this N/A?
   - Recommendation: D-12 says "download speed in blue, upload speed in amber." If SABnzbd doesn't expose upload, skip the upload column and just recolor download to blue. Verify at implementation time by inspecting SABnzbd API response.

2. **AppHeader `main` padding-top adjustment**
   - What we know: `App.tsx` sets `paddingTop: '52px'` on `<main>`. Header is 44px fixed. The 8px extra is intentional buffer.
   - What's unclear: Adding weather widget doesn't change header height (still 44px per D-05), so no adjustment needed.
   - Recommendation: No change to `paddingTop`.

3. **Settings page `?service=weather` URL routing**
   - What we know: VALID_SERVICES in settings.ts currently validates service IDs for the API key config routes. Weather uses its own dedicated route.
   - What's unclear: Should the weather settings form use the same GET/POST `/api/settings/weather` convention, or a different shape?
   - Recommendation: Create `/api/settings/weather` as a completely separate route (GET returns `{ zip, configured: bool }`; POST accepts `{ zip }`, geocodes, and saves). Does not touch `VALID_SERVICES` in settings.ts.

---

## Sources

### Primary (HIGH confidence)
- Open-Meteo official docs (`open-meteo.com/en/docs`) — forecast endpoint parameters, response shape, `current` field naming
- Open-Meteo Geocoding API docs (`open-meteo.com/en/docs/geocoding-api`) — endpoint URL, `name` param, postal code support, response structure
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/frontend/src/components/layout/AppHeader.tsx`
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/frontend/src/pages/SettingsPage.tsx`
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/frontend/src/components/cards/CardGrid.tsx`
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/frontend/src/styles/globals.css`
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/shared/src/types.ts`
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/backend/src/schema.ts`
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/backend/src/routes/settings.ts`
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/backend/src/routes/sse.ts`
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/backend/src/poll-manager.ts`
- Direct code audit of `/Users/Oreo/Projects/Coruscant/packages/backend/src/index.ts`

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-20 (project author decisions)
- `globals.css` — `-webkit-font-smoothing: antialiased` text rendering root cause (DASH-08 / D-20)

---

## Metadata

**Confidence breakdown:**
- Open-Meteo API shape: HIGH — verified against official docs
- Weather architecture pattern: HIGH — follows established project patterns (adapter → kvStore → SSE → snapshot)
- UI micro-issue list: HIGH — direct source code audit, specific line numbers cited
- Settings side-rail pattern: HIGH — follows existing SettingsPage structure
- Animation (CSS marquee, Framer Motion stagger): HIGH — globals.css has `@keyframes marquee` already, Framer Motion already installed
- WMO code mapping: HIGH — complete table from official WMO/Open-Meteo documentation

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (Open-Meteo is stable; WMO codes don't change)
