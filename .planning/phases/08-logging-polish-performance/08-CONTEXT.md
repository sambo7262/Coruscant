# Phase 8: Logging, Polish + Performance — Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Three parallel tracks delivered together:

1. **Performance** — Poll interval tuning for real-time feel; Tautulli webhook→immediate Plex push; SSE change-detection to eliminate stale re-renders
2. **10ft readability** — Drop download bar (reclaim 25% screen height), scale text and elements up for kiosk-distance legibility, depth/glow effects for instrument-panel realism
3. **Log capability** — Pino→SQLite transport, structured log viewer in the existing LogsPage stub, purge/export controls

**Priority order (execute in this order if plans must be sequenced):**
1. Performance interval tuning + Plex webhook
2. Download bar removal + layout rescale
3. Log viewer (pino transport + UI)
4. Remaining color/indicator polish

Phase ends when:
- All poll intervals match the locked table below
- Plex stream banner updates in <1s via Tautulli trigger
- SSE only broadcasts when state actually changed
- Download bar removed; freed space redistributed — tiles fill viewport with larger, legible elements
- NAS header elements span ~95% of container height
- Log viewer live-tails structured logs with level+service filter
- Logs auto-purge after user-configured retention (default 7 days)
- Dashboard readable at 10+ ft kiosk distance

</domain>

<decisions>
## Implementation Decisions

### Performance: Poll Intervals

- **D-01:** Final locked interval table:

| Service | Interval | Mechanism |
|---------|----------|-----------|
| NAS | **1s** | DSM API (local) — CPU/RAM/network bars animate as live gauges |
| Unifi | **3s** | Local UniFi controller — network throughput bars feel like a live meter |
| Plex | **webhook + 5s fallback** | Tautulli PlaybackStart/Stop/Pause trigger immediate re-poll + SSE push; 5s poll as safety fallback |
| SABnzbd | **10s / 1s burst** | Phase 7 burst already handles active downloads — no change |
| arr services | **5s** | Connectivity heartbeat only; Phase 7 webhooks handle all meaningful events |
| Pi-hole | **60s** | FTL API updates stats once/minute by design — no benefit to tighter polling |
| Image update | **12h** | Unchanged |

- **D-02:** All interval constants must be exported (e.g., `NAS_INTERVAL_MS`, `UNIFI_INTERVAL_MS`) — no magic numbers.

### Performance: SSE Change Detection

- **D-03:** SSE route broadcasts `dashboard-update` only when the meaningful state has changed. Hash `services[]`, `nas`, and `streams[]` fields — exclude `timestamp` (always changes on every poll, not meaningful).
- **D-04:** If hash matches last sent: skip the write. The 5s interval still ticks as a heartbeat; it just writes nothing on unchanged state.
- **D-05:** This eliminates the "stale-data flash" (frontend re-renders with identical data) and is a prerequisite for the no-flicker success criterion.

### Performance: Plex Real-Time via Tautulli Webhook

- **D-06:** Extend the existing `/api/webhooks/tautulli` endpoint to handle `PlaybackStart`, `PlaybackStop`, and `PlaybackPause` events. On any of these: immediately re-poll PMS `/status/sessions` and call `pollManager.broadcastSnapshot()`.
- **D-07:** Keep the 5s Plex poll as a fallback — catches stream state if Tautulli webhook misfires or is misconfigured.
- **D-08:** Target: Plex stream banner update latency < 1s from actual stream start.

### Layout: Drop the Download Bar

- **D-09:** Remove the dedicated SABnzbd download section from the dashboard layout. This frees approximately 25% of the 800×480 viewport height.
- **D-10:** Show inline download progress beneath the SABnzbd tile label instead: `filename (truncated) + %` on the left, `speed` on the right. One line max.
- **D-11:** Freed vertical space is redistributed to all remaining tiles proportionally — tiles grow, padding between elements increases, text sizes scale up.
- **D-12:** NAS header elements must span ~95% of the container height after rescaling — no wasted dead space in the NAS tile.
- **D-13:** The 800×480 no-scroll constraint (Phase 5 D-01) remains. All layout changes must fit within that viewport.

### 10ft Readability

- **D-14:** Text sizes scaled up across the dashboard for 10+ ft kiosk viewing distance. Targets TBD by planner based on available vertical space after download bar removal — maximize without triggering scroll.
- **D-15:** Background swap: replace pure black (`#0a0a0f`) with deep navy (`#001133` or `#0A0E17`). Solves glare blending at kiosk distance; confirmed by cockpit reference imagery.
- **D-16:** Panel depth: `box-shadow: inset 0 0 20px rgba(0,0,0,0.5)` on tile cards — "recessed hardware panel" feel.
- **D-17:** Glow on key numeric values: `text-shadow: 0 0 6px currentColor` on status numbers (CPU%, temps, client counts, throughput). Makes readings pop from 10ft.
- **D-18:** OCR-A or existing monospace font for numeric readouts — verify current JetBrains Mono is sufficient or needs swap.

### Color + Indicator Polish

- **D-19:** NAS CPU and RAM bars colored as cockpit warning indicators:
  - Green (`#4ADE80`) below 60%
  - Yellow/amber (`#E8A020`) at 60–85%
  - Red (`#FF3B3B`) above 85%
  - Thresholds configurable if feasible; otherwise hardcoded at these values for Phase 8.

- **D-20:** Network speed arrows: blue (`#00c8ff`) = down/receive, red (`#ff4444`) = up/transmit. Arrow count scales with speed:
  - `↓` = low speed
  - `↓↓` = medium speed
  - `↓↓↓` = fast speed
  - Consistent with WAN TX=red / RX=blue from UniFi conventions.

- **D-21:** NAS layout restructure — NAS becomes its own instrument tile with an amber ribbon header (same pattern as all other tiles). Current header refocuses on temperature/fan data. Visual consistency with the rest of the dashboard.

- **D-22:** Plex stats coloring: CPU stat = green, RAM stat = blue, download speed = white (unchanged). Adds color differentiation to Plex section.

### Logging: Capture

- **D-23:** Add a new `app_logs` SQLite table (via Drizzle schema + migration). Fields: `id`, `timestamp`, `level`, `service`, `message`, `payload` (JSON).
- **D-24:** Capture mechanism: pino transport (catch-all). Wire pino to write all structured log entries to the `app_logs` table automatically. No manual `logToDb()` instrumentation — everything logged via `fastify.log` or the pino instance is captured.
- **D-25:** Log levels captured: `info`, `warn`, `error` (exclude `debug` and `trace` — too noisy for the viewer).
- **D-26:** Nightly auto-prune: `DELETE FROM app_logs WHERE timestamp < now - retention_days`. Runs via `node-cron` schedule (or equivalent) at 3am local time.
- **D-27:** Default retention: **7 days**. User-configurable via Settings page (new "Logs" tab alongside the existing "Notifications" tab).

### Logging: Log Viewer UI

- **D-28:** LogsPage.tsx stub replaced with a live log viewer. Layout: compact table matching the cockpit aesthetic.
  - Columns: `TIME` | `LEVEL` (colored chip) | `SERVICE` (amber tag) | `MESSAGE`
  - Time format: `HH:mm:ss` (no date — most logs will be recent)
  - Level chip colors: INFO=dim amber, WARN=yellow, ERROR=red

- **D-29:** New entries push in from the top via SSE (new `log-entry` named SSE event). No manual refresh needed — viewer live-tails automatically.
- **D-30:** Filter bar: level dropdown (ALL / WARN+ / ERROR only) + service dropdown (ALL / per service). Default filter: **WARN+ only** (shows warn and error, hides info noise during healthy operation).
- **D-31:** Entry cap: show last 500 entries in the viewer. Older entries are in SQLite but not loaded by default — "Load more" or pagination for historical access.
- **D-32:** Export: "EXPORT LOGS" button downloads a JSON or CSV file of the current filtered view. No confirmation required (non-destructive).
- **D-33:** Purge: "PURGE LOGS" button with confirmation modal. Shows: "Delete all logs older than {retention_days} days?" → confirm → executes prune immediately.

</decisions>

<specifics>
## User Specifics

- **"Feels alive"** — The NAS (1s) and Unifi (3s) intervals are explicitly chosen so bars animate as live meters. This is intentional UX, not just tech optimization.
- **Background is deep navy, not black** — `#001133` or `#0A0E17`. User reviewed cockpit reference images and confirmed this solves glare-blending at kiosk distance.
- **10ft reading distance is the target** — All text size decisions should be made with "readable from 10+ feet" as the first constraint, with the 800×480 no-scroll constraint as the second.
- **Download bar drops FIRST** — This is the prerequisite for all layout rescaling. Phase planner should sequence this as the earliest frontend plan.
- **Phase 7 D-03 fulfilled here** — Arr webhook events were logged via `console.log(JSON.stringify(...))` in Phase 7 with a note that "Phase 8 log viewer will surface these automatically." The pino transport in this phase captures those structured log entries.
</specifics>

<deferred>
## Deferred Ideas (out of Phase 8 scope)

- Radar sweep / concentric circles for Pi-hole DNS chart — noted as future direction from reference imagery
- Sepia/aged texture on panels — low priority, mentioned in notes
- Threshold configuration UI for notification triggers (Pushover alerts when CPU > 90%, etc.) — Phase 9 or later
- Per-service log retention settings — Phase 8 uses global retention; per-service is future work
</deferred>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 8 requirements: LOG-01, LOG-02, LOG-03, LOG-04, PERF-01, PERF-02
- `.planning/REQUIREMENTS.md` — Full requirement specs for LOG and PERF IDs
- `.planning/phases/05-ui-v2-instrument-panel-polish/05-CONTEXT.md` — Layout constraints (D-01 no-scroll 800×480, D-03 NAS header pattern)
- `.planning/phases/07-notifications-pushover-inbox/07-CONTEXT.md` — D-03 (pino logging intent), D-04 (arr webhook pattern for Tautulli extension)
- `.planning/notes/2026-04-05-phase-8-color-and-indicator-polish.md` — Detailed color thresholds, multi-arrow network indicator, background reference analysis
- `.planning/notes/2026-04-05-phase-8-drop-download-bar.md` — Download bar removal and layout redistribution spec
- `packages/backend/src/db.ts` — SQLite + Drizzle ORM setup, WAL mode already enabled
- `packages/backend/src/poll-manager.ts` — All current interval constants, polling architecture
- `packages/backend/src/routes/sse.ts` — SSE route for change-detection modification
- `packages/backend/src/routes/tautulli-webhook.ts` — Webhook pattern to extend for Plex real-time push
- `packages/frontend/src/pages/LogsPage.tsx` — Stub to replace with live viewer
</canonical_refs>
