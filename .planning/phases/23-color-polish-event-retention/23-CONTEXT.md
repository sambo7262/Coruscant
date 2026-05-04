# Phase 23: Color Polish & Event Retention Fix - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add color variety to dropdown panels and NAS metrics. Fix media event list fetch limit. No new features — visual polish + one bug fix.

</domain>

<decisions>
## Implementation Decisions

### Weather Temperature Colors (COLOR-01, COLOR-02)
- **D-01:** Both forecast panel temps AND dashboard header temp use a blue-to-red gradient based on temperature value. Cold temps (≤32°F) are blue, hot temps (≥100°F) are red, mid-range interpolates between.
- **D-02:** Forecast panel high and low temps should use the SAME font size (currently high is larger). Both should be prominent.

### NAS Process Bar Colors (COLOR-03)
- **D-03:** Each of the top 5 process bars in the NAS process monitor dropdown uses a distinct color. Claude chooses the palette — should feel alive but fit the cockpit aesthetic.

### NAS Disk Metric Colors (COLOR-04)
- **D-04:** NAS ServiceCard disk metrics (d1 through d6) use the same colors that the timeline sparkline charts assign to those disks. Currently the timeline uses `rgba(232,160,32,0.8)` for all disks via `NAS_DISK_CONFIG` — this needs per-disk colors, and the ServiceCard should match.

### Media Event Retention Fix (EVENT-01)
- **D-05:** The media event list in `MediaEventList.tsx` currently fetches `/api/logs?limit=1000` and filters client-side. This causes events beyond the 1000-entry cap to disappear even within the 7-day window. Fix: pass the time window to the backend query so only relevant events are returned, removing the arbitrary 1000-entry cap (or raising it significantly with server-side time filtering).

### Claude's Discretion
- **D-06:** Exact blue-to-red color scale function (linear interpolation, HSL hue rotation, or stepped thresholds)
- **D-07:** The 5 distinct colors for NAS process bars
- **D-08:** Per-disk color palette for d1-d6 (timeline charts + ServiceCard)
- **D-09:** Whether to add a `window` query param to the logs API or use `since` timestamp

</decisions>

<canonical_refs>
## Canonical References

### Weather (COLOR-01, COLOR-02)
- `packages/frontend/src/components/layout/WeatherForecastPanel.tsx` — forecast panel with DayColumn rendering high/low temps
- `packages/frontend/src/components/layout/AppHeader.tsx` — header weather temp display at line ~211

### NAS Process Monitor (COLOR-03)
- `packages/frontend/src/components/layout/NasProcessPanel.tsx` — `getProcBarColor()` currently returns amber/orange/red by load level
- `packages/frontend/src/styles/globals.css` — `.nas-process-panel__fill` bar styling

### NAS Disk Metrics (COLOR-04)
- `packages/frontend/src/pages/TimelinePage.tsx` — `NAS_DISK_CONFIG` at line ~31 uses uniform amber for all disks
- `packages/frontend/src/components/cards/ServiceCard.tsx` — NasTileInstrument renders disk metric rows

### Media Event List (EVENT-01)
- `packages/frontend/src/components/timeline/MediaEventList.tsx` — fetches `/api/logs?limit=1000` at line ~256
- `packages/backend/src/routes/logs.ts` — `/api/logs` endpoint with limit/offset/service/level params

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getBarColor()` in ServiceCard — existing color function for metric bars, could be extended
- `getProcBarColor()` in NasProcessPanel — load-level coloring, needs per-process replacement

### Integration Points
- TimelinePage `NAS_DISK_CONFIG` and ServiceCard `NasTileInstrument` disk rows must use the same color set
- `/api/logs` backend needs a `since` param to enable server-side time filtering

</code_context>

<specifics>
## Specific Ideas

- User wants the dashboard to "feel alive" — color variety is the goal
- Numbers should "directionally align" — the same disk should be the same color everywhere
- Backlog items (999.1, 999.2) are dropped — this is the final phase before v2.0 archive

</specifics>

<deferred>
## Deferred Ideas

None — this is the final phase

</deferred>

---

*Phase: 23-color-polish-event-retention*
*Context gathered: 2026-05-04*
