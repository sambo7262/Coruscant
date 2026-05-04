# Phase 21: Weather Forecast - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Tap the weather area in AppHeader to open a full-width dropdown panel showing a 5-day forecast — daily highs, lows, condition labels, and animated SVG weather icons. Panel is dismissible and works across kiosk, iPhone portrait, and iPhone landscape viewports. Forecast data comes from Open-Meteo on the same polling cadence as current conditions.

</domain>

<decisions>
## Implementation Decisions

### Forecast Panel Layout (WX-01)
- **D-01:** Full-width dropdown panel — same pattern as DockerUpdatePanel. Drops below the weather widget area in AppHeader.
- **D-02:** Horizontal row of 5 day columns. Each column shows: day name (Mon, Tue, etc.), animated SVG weather icon, high/low temperatures, condition label.
- **D-03:** On iPhone portrait, the 5 columns should adapt (smaller text/icons or horizontal scroll) to fit the narrower viewport — Claude's discretion on the exact responsive approach.

### Interaction & Dismissal (WX-01)
- **D-04:** Tap the weather widget in AppHeader to toggle the forecast panel open/closed — same interaction pattern as DockerUpdatePanel.
- **D-05:** Slide-down animation using Framer Motion AnimatePresence + height transition — consistent with PiHealthPanel and DockerUpdatePanel patterns.

### Weather Icons (WX-01)
- **D-06:** Reuse the existing `WeatherIcon` component for each forecast day. Same animated SVG icons (sun, partlyCloudy, overcast, fog, rain, snow, storm) that map from WMO codes.
- **D-07:** Icon size for forecast days — Claude's discretion based on viewport fit. Current header icon is 30px.

### Data & Polling (WX-02)
- **D-08:** Extend the existing Open-Meteo API call to also fetch `daily` forecast data (high/low temps, weather codes) for 5 days. One API call returns both current + forecast — no second request needed.
- **D-09:** Forecast cached alongside current conditions on the same 15-minute poll cycle. No new timers, no extra configuration.
- **D-10:** Extend `WeatherData` type in shared types to include forecast array. Each forecast day: `date`, `temp_max_f`, `temp_min_f`, `wmo_code`.

### Claude's Discretion
- **D-11:** Exact responsive breakpoint strategy for portrait viewport (smaller icons, horizontal scroll, or column compression)
- **D-12:** Whether to show "Today" label instead of day name for the first forecast day
- **D-13:** Condition label text mapping from WMO codes (e.g., 0 = "Clear", 1 = "Mostly Clear")

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Weather backend (adapter to extend)
- `packages/backend/src/adapters/weather.ts` — `fetchWeatherData()` currently fetches only `current` params; extend to include `daily` forecast params
- `packages/backend/src/weather-poller.ts` — Weather polling loop; forecast data flows through here
- `packages/shared/src/types.ts` — `WeatherData` interface at line 85; `DashboardSnapshot.weather` at line 121

### Weather frontend (existing components)
- `packages/frontend/src/components/weather/WeatherIcon.tsx` — Animated SVG icons mapping all WMO codes to 7 types; reuse for forecast day icons
- `packages/frontend/src/components/layout/AppHeader.tsx` — Weather widget at line ~208; tap target for opening forecast panel

### UI pattern analogs (tap-to-expand dropdown)
- `packages/frontend/src/components/layout/DockerUpdatePanel.tsx` — Full-width dropdown panel pattern; use same structure for forecast panel
- `packages/frontend/src/components/layout/PiHealthPanel.tsx` — Framer Motion AnimatePresence slide-down pattern

### Viewport responsiveness
- `packages/frontend/src/styles/viewport-iphone.css` — iPhone portrait/landscape CSS overrides; new forecast panel needs rules here
- `packages/frontend/src/styles/globals.css` — Weather animation keyframes already defined here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **WeatherIcon** — Complete animated SVG icon set for all WMO weather codes (7 types). Accepts `wmoCode` and `size` props.
- **DockerUpdatePanel** — Full-width dropdown with tap-to-toggle pattern. Direct structural analog for forecast panel.
- **PiHealthPanel** — Framer Motion AnimatePresence slide-down animation. Same animation approach.
- **Open-Meteo adapter** — Already calls `api.open-meteo.com/v1/forecast` with `current` params; extending to add `daily` params is a minimal change.
- **WeatherData type** — Exists in shared types; needs forecast array extension.

### Established Patterns
- **Tap-to-toggle panels** — AppHeader manages panel open state (`panelOpen` for Pi health, similar for Docker updates)
- **SSE data flow** — Weather data flows through `DashboardSnapshot.weather` via SSE to frontend
- **Viewport-scoped CSS** — iPhone overrides use `html[data-viewport^="iphone"]` selectors

### Integration Points
- AppHeader weather widget `onClick` — new tap handler to toggle forecast panel
- `DashboardSnapshot.weather` — extend to carry forecast array
- SSE route — already emits weather data; forecast piggybacks on same emission
- `viewport-iphone.css` — needs new rules for forecast panel responsive layout

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants the forecast to "feel alive" — animated SVG icons are essential, not optional
- Use the existing full-width dropdown pattern (DockerUpdatePanel) — no new UI patterns needed
- Horizontal row layout for the 5 days — cockpit instrument panel feel
- Same polling cadence as current weather — no new infrastructure

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-weather-forecast*
*Context gathered: 2026-05-03*
