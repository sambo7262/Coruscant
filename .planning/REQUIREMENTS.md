# Requirements: Coruscant v1.3 — Bug Fixes & Data Updates

**Focus:** Fix known bugs, improve data accuracy, and enhance logging/weather/NAS diagnostics.

## Bug Fixes

- [ ] **DL-01**: SABnzbd download progress bar initializes at 0% (not ~30%) and accurately reflects the real download percentage from the SABnzbd API
- [ ] **DL-02**: SABnzbd time remaining displays the real-time `timeleft` value from the SABnzbd API response, updating each poll cycle
- [ ] **PLEX-01**: Plex transcode detection correctly distinguishes direct play from transcoding by reading the authoritative transcode field from the Tautulli/Plex payload — direct play streams show no transcode glow

## Weather

- [ ] **WX-01**: User can tap the weather area in the AppHeader to open a 5-day forecast view showing daily high/low temperatures, conditions, and weather icons
- [ ] **WX-02**: 5-day forecast data is fetched from Open-Meteo (no API key) and cached with the same polling pattern as current weather

## Docker Updates

- [ ] **DOCKER-01**: Tapping "update available" in the NAS header reveals which Docker image(s) have pending updates, showing image name, running tag, and available registry tag

## Activity Timeline

- [ ] **TIMELINE-01**: A dedicated timeline page displays infrastructure health metrics (CPU, RAM, temps) as sparklines or heatmaps over a selectable time window, defaulting to last 24 hours with up to 7 days (or max available data)
- [ ] **TIMELINE-02**: Media stack events (grabs, plays, completions) and service state changes (up/down) appear as discrete event markers on the timeline, distinguishable by type
- [ ] **TIMELINE-03**: Time window selector allows switching between preset ranges (24h, 3d, 7d) and the view updates without page reload

## Performance Optimization

- [ ] **PERF-01**: SQLite metric writes are batched — poll callbacks buffer to memory and flush in a single transaction every 5-10 seconds, reducing write syscalls by ~80%
- [ ] **PERF-02**: The `/api/metrics/history` endpoint caches downsampled results for 30-60 seconds — repeated requests within the cache window return instantly without re-querying
- [ ] **PERF-03**: SparklineCard components are memoized with `React.memo` so that switching tabs, filters, or time windows only re-renders affected cards

## NAS Diagnostics

- [ ] **NAS-01**: When NAS CPU usage is elevated, user can tap the CPU metric to open a dropdown panel showing top processes by CPU usage with human-readable labels (e.g., ffmpeg → "Plex transcoding") and usage bars
- [ ] **NAS-02**: Process data comes from the DSM API on demand (no continuous polling, no external API calls, no LLM dependency); unknown processes show the raw process name as fallback


## Color Polish & Event Retention

- [ ] **COLOR-01**: Weather forecast panel shows temperature-scaled colors (blue for cold, red for hot) on both high and low temps, with matching font sizes
- [ ] **COLOR-02**: Dashboard header weather temperature is colored on the same blue-to-red temperature scale
- [ ] **COLOR-03**: NAS process monitor bars each use a distinct color (not uniform amber)
- [ ] **COLOR-04**: NAS ServiceCard disk metrics (d1-d6) use the same colors assigned in the timeline sparkline charts
- [ ] **EVENT-01**: Media event list on the timeline page fetches all events within the selected time window (not capped at 1000 entries), so events persist for the full 7-day retention period

## Future Requirements

*(Recognized but deferred beyond v2.0)*

- UniFi detail view with per-device uptime/model/clients (NET-03)
- Pushover threshold alerts (NOTIF-02 through NOTIF-06)
- Smart Home integrations (SMRTH-01 through SMRTH-04)
- Playwright visual regression automation
- PWA install manifest
- iPad responsive layout

## Out of Scope

- **New service integrations** — v1.3 improves existing services, does not add new ones
- **NAS process management** — process monitor is read-only, no kill/restart from dashboard
- **Weather alerts/notifications** — forecast is display-only
- **Log aggregation from external sources** — only Coruscant's own logs
- **External AI/LLM dependencies** — dropped in favor of static process label lookup (no API cost, no latency, works offline)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DL-01 | Phase 17 | Pending |
| DL-02 | Phase 17 | Pending |
| PLEX-01 | Phase 17 | Pending |
| DOCKER-01 | Phase 18 | Pending |
| TIMELINE-01 | Phase 19 | Pending |
| TIMELINE-02 | Phase 19 | Pending |
| TIMELINE-03 | Phase 19 | Pending |
| PERF-01 | Phase 20 | Pending |
| PERF-02 | Phase 20 | Pending |
| PERF-03 | Phase 20 | Pending |
| WX-01 | Phase 21 | Pending |
| WX-02 | Phase 21 | Pending |
| NAS-01 | Phase 22 | Pending |
| NAS-02 | Phase 22 | Pending |
| COLOR-01 | Phase 23 | Pending |
| COLOR-02 | Phase 23 | Pending |
| COLOR-03 | Phase 23 | Pending |
| COLOR-04 | Phase 23 | Pending |
| EVENT-01 | Phase 23 | Pending |

**Coverage:** 19/19 requirements mapped across 7 phases.

---
*Updated: 2026-05-04 — Added COLOR-01/02/03/04, EVENT-01; Phase 23 color polish + event retention fix; milestone renamed to v2.0*
