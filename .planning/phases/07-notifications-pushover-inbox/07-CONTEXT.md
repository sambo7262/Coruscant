# Phase 7: Notifications (Pushover Inbox) — Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire arr/service webhook events into Coruscant so they drive real-time UI feedback and backend polling optimizations — **not** an inbox or message catalog.

This phase delivers:
- Webhook receiver endpoints for each arr app (Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, Readarr, SABnzbd)
- Event-driven UI: colored flash on the arr card label + AppHeader text ticker when events fire
- Burst poll optimization: SABnzbd switches to 1s polling when a grab event arrives, returns to normal when download completes
- Notifications settings tab showing copy-able webhook URLs for manual arr configuration

**Important: Phase name is misleading.** The "Pushover Inbox" framing in the roadmap is superseded. This phase is an **event-driven signaling system** — messages are ephemeral triggers for action, not catalog entries. No Pushover API polling. No inbox view. No notification history UI.

Phase ends when:
1. All arr apps can POST webhook events to Coruscant endpoints
2. Card flash + header ticker fire correctly for each event type
3. SABnzbd burst poll activates on grab and returns to normal on import-complete
4. Settings tab shows copy-able webhook URLs

</domain>

<decisions>
## Implementation Decisions

### Architecture: Event-Driven, Not Inbox

- **D-01:** Phase 7 is a **webhook receiver** system, not a Pushover inbox. Coruscant receives events from arr apps directly — no Pushover API polling, no external dependencies.
- **D-02:** Messages are **ephemeral on the frontend** — flash state exists only in memory/SSE. Page refresh clears all flash states. "If you weren't watching, you missed it."
- **D-03:** Backend **logs each event** via the standard pino logger (structured log entry: service, event_type, title/payload). No new SQLite table. Phase 8 log viewer will surface these automatically.

### Ingestion: Arr Webhooks Direct to Coruscant

- **D-04:** Each arr app (Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, Readarr, SABnzbd) POSTs events to a dedicated Coruscant endpoint: `POST /api/webhooks/{service}` (e.g. `/api/webhooks/radarr`). Follows the existing Tautulli webhook pattern exactly.
- **D-05:** No authentication on webhook endpoints — LAN-only deployment (same policy as Tautulli webhook).
- **D-06:** Endpoints must tolerate empty bodies and unknown event types gracefully (return 200, log and ignore).

### Event Taxonomy

- **D-07:** Four event categories to handle:

| Event Type | Trigger | UI Flash Color | SSE Action |
|------------|---------|----------------|------------|
| `grab` | Radarr/Sonarr/Lidarr grabbed an item for download | Amber (`#ffaa00`) | Flash card label + header ticker + start SABnzbd burst poll |
| `download_complete` / `import` | File downloaded and imported to library | Purple (`#c084fc`) | Flash card label + header ticker + stop SABnzbd burst poll |
| `health_issue` | Arr health check failed; Prowlarr indexer down | Red (`#ff4444`) | Flash card label + header ticker |
| `update_available` | Arr app has a new version | Green (`#00ff88`) | Flash card label + header ticker |

- **D-08:** Prowlarr's "indexer down" maps to the `health_issue` event type — same red flash treatment as other health issues.
- **D-09:** Flash duration: **10 seconds visible, then fade out**. Header ticker uses the same 10s window.

### UI: Card Label Flash

- **D-10:** When an event fires, the relevant arr **card label box** gets a colored border/glow flash in the event color. The label box is the amber mono service name label (e.g. "RADARR") in the arr card header area.
- **D-11:** Flash is purely CSS animation driven by a transient SSE event pushed to the frontend — no persistent state on the frontend.

### UI: AppHeader Ticker

- **D-12:** The AppHeader ticker **overlays the existing header content** for 10 seconds, then snaps back to normal header. No extra layout row — preserves the 800x480 budget.
- **D-13:** Ticker text format: `SERVICE ▸ EVENT ▸ TITLE` in cockpit mono style. Examples:
  - `RADARR ▸ GRABBED ▸ The Dark Knight`
  - `PROWLARR ▸ INDEXER DOWN`
  - `SONARR ▸ IMPORTED ▸ Severance S02E08`
  - `RADARR ▸ UPDATE AVAILABLE`

### Poll Optimization: SABnzbd Burst Mode

- **D-14:** On `grab` event from any arr app → SABnzbd adapter switches to **1-second poll interval**.
- **D-15:** Burst mode ends when:
  1. A `download_complete` / `import` webhook fires from any arr app, OR
  2. SABnzbd queue is detected empty during polling (queue count = 0)
  Then normal poll interval resumes.
- **D-16:** No fixed timeout on burst poll — it runs until one of the two completion conditions above. If the import webhook is never received (e.g. user manually cancels in SABnzbd), the queue-empty detection provides the fallback.

### Settings: Webhook URL Display

- **D-17:** A **Notifications** settings tab lists each arr service with its Coruscant webhook URL and a **copy button**. User pastes the URL into the arr app's Connections settings (one-time setup per service).
- **D-18:** URL format shown: `http://{coruscant-ip}:1688/api/webhooks/{service}` — uses the configured Coruscant base URL from settings, or a placeholder if not set.
- **D-19:** No TEST CONNECTION button on the Notifications tab — webhook endpoints are passive receivers; "testing" is done by sending a test notification from the arr app itself.

### Claude's Discretion

- Exact CSS animation timing curve for the flash fade-out (ease-out recommended)
- Whether to debounce rapid successive events from the same service (e.g. 2 grabs in 1 second → show only one flash)
- Which arr webhook payload fields to use for the ticker `TITLE` portion (may vary per arr app's payload schema — researcher to confirm)
- How burst poll mode survives server restart (in-memory flag resets on restart; acceptable)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Webhook Pattern
- `packages/backend/src/routes/tautulli-webhook.ts` — The Tautulli webhook implementation. Phase 7 arr webhook endpoints follow this exact pattern: POST route, tolerates empty body, updates PollManager, triggers SSE push.

### Arr Webhook Payload Schemas
- Radarr webhook docs: researcher should verify payload shape at `{radarr-host}/api/v3/notification` and arr community docs. Key fields: `eventType`, `movie.title`, `release.quality`, etc.
- Sonarr/Lidarr/Readarr webhooks follow the same schema pattern as Radarr (v3 API).
- SABnzbd notification: researcher to confirm whether SABnzbd supports outbound webhooks or uses a script/notification URL pattern.
- Bazarr/Prowlarr: researcher to confirm webhook event types available.

### Existing Phase Context (patterns to follow)
- `.planning/phases/03-settings-first-service-adapters/03-CONTEXT.md` — Settings tab patterns, credential fields, TEST CONNECTION mechanics
- `.planning/phases/06-network-monitoring/06-CONTEXT.md` — Most recent settings tab implementation reference

### Codebase Integration Points
- `packages/backend/src/routes/tautulli-webhook.ts` — Model for new webhook route files
- `packages/backend/src/poll-manager.ts` — Must add burst poll mode: `setBurstPoll(serviceId, intervalMs)` and `clearBurstPoll(serviceId)` methods
- `packages/frontend/src/components/layout/AppHeader.tsx` — Add ticker overlay state
- `packages/frontend/src/components/cards/ServiceCard.tsx` — Add flash animation on arr card label boxes
- `packages/shared/src/types.ts` — Add `WebhookEvent` type and SSE event shape for frontend

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/routes/tautulli-webhook.ts` — Exact template for arr webhook receivers. Handles empty body, tolerated bad payloads, calls `pollManager.updatePlexState()`. Arr endpoints call equivalent `pollManager.handleArrEvent()`.
- `packages/backend/src/poll-manager.ts` — `updatePlexState()` shows how to update state + trigger SSE broadcast. Burst poll logic extends this.
- `packages/frontend/src/components/layout/AppHeader.tsx` — Add ticker overlay state driven by SSE event type `'arr_event'`.
- `packages/frontend/src/components/cards/ServiceCard.tsx` — Arr card label boxes already render in amber mono style. Flash is an additional CSS class toggled by SSE event.

### Established Patterns
- Webhook pattern: `fastify.post('/api/webhooks/{service}', ...)` registered via a plugin function exported from a route file
- LAN-only deployment: no auth on internal endpoints
- SSE mechanism: `pollManager.broadcastSnapshot()` pushes `DashboardSnapshot` to all connected clients. New approach: also broadcast ephemeral `WebhookEvent` payloads (not part of snapshot, separate SSE event type)
- Settings tab: tabbed layout in Settings page, each service gets its own tab. Notifications tab is read-only (URL display + copy) — no credentials to encrypt.

### Integration Points
- New route files: `packages/backend/src/routes/arr-webhooks.ts` (handles all arr services) or individual files per service
- PollManager: new method `handleArrEvent(event: ArrWebhookEvent)` that:
  1. Logs via pino
  2. Broadcasts SSE `arr_event` to frontend
  3. If event is `grab`: activates SABnzbd burst poll
  4. If event is `download_complete`: deactivates burst poll
- Frontend SSE hook: extend to handle `arr_event` SSE type alongside existing `dashboard` type

</code_context>

<specifics>
## Specific Ideas

- "Use Pushover almost like webhooks from the media stack" — the insight was right; arr apps have native webhook/Connection support, so Pushover is bypassed entirely. This phase establishes arr → Coruscant as the real-time event channel.
- "Once Radarr fetches, poll every second from SABnzbd so we get true real-time data in dashboard" — this is D-14 and D-15. Burst poll is the primary UX win from this phase.
- "Flash some UI treatment to show file was completed" — this is D-10 through D-13: purple card flash + `RADARR ▸ IMPORTED ▸ Title` ticker overlay.
- The kiosk context matters: 800x480, small screen, mostly watched not interacted with. Visual signals need to be noticeable at a glance but not disruptive. 10s duration is deliberate — long enough to notice, short enough to not linger.

</specifics>

<deferred>
## Deferred Ideas

- **Threshold alert sending (NOTIF-02 to NOTIF-06)** — Coruscant detecting threshold breaches (NAS > 85%, service down) and sending Pushover alerts. The REQUIREMENTS.md lists this but it's out of scope for Phase 7. Consider adding as Phase 7.5 or Phase 8 scope.
- **Arr poll pause on grab** — When a grab fires, pause polling the triggering arr app (redundant to poll what just told you). Deferred to Phase 8 (poll interval tuning phase).
- **Arr poll frequency increase on health events** — When a health-issue webhook fires, increase that service's poll to detect recovery faster. Deferred to Phase 8.
- **Auto-configure arr connections via arr API** — Coruscant calls each arr app's API to register itself as a webhook connection automatically. Deferred — too complex for this phase.
- **Pushover relay fallback** — Deferred entirely. Arr webhooks are sufficient and simpler.

</deferred>

---

*Phase: 07-notifications-pushover-inbox*
*Context gathered: 2026-04-05*
