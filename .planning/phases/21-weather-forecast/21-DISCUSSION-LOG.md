# Phase 21: Weather Forecast - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 21-weather-forecast
**Areas discussed:** Forecast panel layout, Interaction & dismissal, Weather icons, Data & polling

---

## Forecast Panel Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal row | 5 columns side by side — icon, day, high/low per column | ✓ |
| Vertical list | 5 rows stacked — icon + day + condition + high/low per row | |
| You decide | Claude picks based on viewport analysis | |

**User's choice:** Horizontal row
**Notes:** User wants to leverage existing full-width dropdown pattern (DockerUpdatePanel) and ensure animated SVG icons for "alive" feeling

---

## Interaction & Dismissal

| Option | Description | Selected |
|--------|-------------|----------|
| Same as DockerUpdatePanel | Tap weather toggles open/close — consistent pattern | ✓ |
| You decide | Claude picks best dismissal pattern | |

**User's choice:** Same as DockerUpdatePanel

---

## Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Slide down with Framer Motion | AnimatePresence + height transition, same as existing panels | ✓ |
| Instant show/hide | No animation | |
| You decide | Claude picks | |

**User's choice:** Slide down with Framer Motion

---

## Weather Icons

| Option | Description | Selected |
|--------|-------------|----------|
| Same 30px | Consistent with header | |
| Smaller 24px | Fits tighter viewports | |
| You decide | Claude picks based on viewport math | ✓ |

**User's choice:** You decide (Claude's discretion)

---

## Data & Polling

| Option | Description | Selected |
|--------|-------------|----------|
| Same poll cycle | Forecast fetched alongside current on 15-min cycle | ✓ |
| You decide | Claude picks caching strategy | |

**User's choice:** Same poll cycle

---

## Claude's Discretion

- Forecast icon size per day (based on viewport math)
- Portrait responsive approach (smaller icons, scroll, or compression)
- "Today" label vs day name for first day
- WMO code to condition label text mapping

## Deferred Ideas

None — discussion stayed within phase scope
