# Phase 9: Local Weather + UI Final Polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 09-local-weather-ui-polish
**Areas discussed:** Weather source, Header placement, Condition display format, UI polish scope

---

## Weather Source

| Option | Description | Selected |
|--------|-------------|----------|
| Open-Meteo | Free, no API key, sub-km grid accuracy, generous rate limits | ✓ |
| NWS API | US official NOAA, no key, nearest observation station (coarser accuracy) | |
| Local weather station | Fully local, requires existing hardware | |

**Follow-up:** User asked about reliability / 15-min refresh / zip accuracy trade-off.

| Option | Description | Selected |
|--------|-------------|----------|
| Open-Meteo + lat/lon | Best accuracy, simplest input | |
| Open-Meteo + zip support | Zip code input, backend geocodes via Open-Meteo geocoding API | ✓ |
| NWS API | Official NOAA, coarser station-based accuracy | |

**User's choice:** Open-Meteo with zip code input. Backend geocodes zip → lat/lon on first save, caches in kvStore.

---

## Header Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Right col, beside icons | `72° ⛅ ⚙ 📋` in right column, single row | ✓ |
| Center col replaces disconnect dot | Weather takes center; disconnect dot overlaps condition icon when lost | |
| Second header row | AppHeader grows to ~72px with a dedicated weather strip | |

**User's choice:** Right column beside icons.
**Notes:** User added — disconnect dot should be red (not amber) and bigger; weather text should be large; overall header text/icons bumped up to fill 44px boundaries.

---

## Condition Display Format

**User clarification:** Requested a large SVG icon for visual impact and kiosk readability.

| Option | Description | Selected |
|--------|-------------|----------|
| Animated custom SVGs | Hand-crafted inline SVGs with CSS animations (sun rotates, rain falls, etc.) | ✓ |
| Weather icon library (react-icons/wi) | 200+ static icons from react-icons/wi, no animation | |

**User's choice:** Animated custom SVGs, ~28–32px, amber/warm palette. Animations: sun rays rotate, rain drops fall in staggered loop, cloud drifts, snow flakes drift, storm bolt flickers, fog band fades.

---

## UI Polish Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Visual micro-issues only | Spacing, alignment, typography, animation timing | |
| Visual + open functional bugs | Also fold in debug file issues | |
| Visual + living/breathing enhancements | Micro-animations: LED pulse, tile stagger, metric count-up, ambient effects | ✓ |

**User's choice:** Living/breathing enhancements, plus specific user-identified fixes.

**User-specified fixes (free-text):**
1. DOWNLOADS expanded height too tall — cap to match NETWORK tile height
2. Long filenames in DOWNLOADS get cropped — add CSS marquee scroll for overflow titles
3. Download/upload speed numbers too small — scale up to match Pi-hole stat size, color them (blue download, amber upload)
4. Webhook events in logs not easily scannable — add `[WEBHOOK] SERVICE → event_type → "title"` format
5. Settings page too long to scroll — restructure with left side rail (MEDIA / NETWORK / SYSTEM / NOTIFICATIONS / LOGS sections), existing tab structure within each section

---

## Claude's Discretion

- WMO edge-case code → icon mapping
- Exact DOWNLOADS max-height value (match NETWORK tile at runtime)
- Marquee scroll speed
- Metric count-up duration and easing

## Deferred Ideas

None.
