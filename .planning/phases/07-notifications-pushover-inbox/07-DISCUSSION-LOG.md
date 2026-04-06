# Phase 7: Notifications (Pushover Inbox) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 07-notifications-pushover-inbox
**Areas discussed:** Scope, Ingestion, UI Events, Event Colors, Message Lifecycle, Burst Poll, Ticker Format, Webhook Setup, Poll Optimization

---

## Scope — Inbox vs. Full Alerting

| Option | Description | Selected |
|--------|-------------|----------|
| Receive + display only | Inbox panel showing arr/service alerts piped in via webhook. No threshold alerting. | |
| Both: inbox + threshold sending | Webhook inbox for arr alerts AND outbound threshold alerts (NAS > 85%, etc.) | |
| Threshold sending only | Coruscant sends Pushover alerts on threshold breaches. No inbox display. | |

**User's choice:** None of the above — significant pivot.
**Notes:** User clarified the kiosk context: 800x480 screen is too small for meaningful interaction. The intent is to use arr notifications as event signals that drive UI changes and backend actions. Key insight: "I don't want an inbox to catalog messages — I want messages to drive UI and backend changes." Example given: once Radarr fetches, poll SABnzbd every second; once file is imported, flash UI to show completion. Messages are ephemeral — no need to track history.

---

## Ingestion Approach

### Round 1 — Initial options

| Option | Description | Selected |
|--------|-------------|----------|
| Arr webhook direct to Coruscant | Add Coruscant webhook in each arr app — same as Tautulli | |
| Pushover Open Client API | Coruscant subscribes to Pushover's client API | |
| SABnzbd script/notification only | Narrower scope, download-events only | |

**User's choice:** Initial response was uncertainty — user didn't know arr apps had native webhook support.
**Notes:** User stated "arr stack doesn't have webhooks" and was thinking of Pushover as the webhook relay. Clarified that arr apps do have a "Connections" settings page supporting multiple notification targets including custom webhooks (same mechanism as Pushover).

### Round 2 — After arr webhook clarification

| Option | Description | Selected |
|--------|-------------|----------|
| Arr webhooks direct to Coruscant | Post to /api/webhooks/radarr etc. in addition to Pushover | ✓ |
| Pushover as relay | Arr → Pushover → Coruscant polls Pushover API | |
| Both — arr webhooks + Pushover fallback | Webhooks where supported, Pushover fallback otherwise | |

**User's choice:** Arr webhooks direct to Coruscant
**Notes:** Zero external dependencies. LAN-only. User confirmed this was the right approach once they understood arr native webhook support.

---

## UI Events

| Option | Description | Selected |
|--------|-------------|----------|
| Card flash + burst poll | Card flashes on event; backend kicks burst poll mode | |
| AppHeader event ticker | Brief message in AppHeader strip, fades after seconds | |
| Both — card flash + header ticker | Card flashes + header ticker | ✓ |

**User's choice:** Both — card flash + header ticker
**Notes:** User described the specific UI: "add an additional UI 'box' around the label of the arr container and just flash that 'box' a certain color when webhooks are received — we can also flash a notification banner to say in text so we get text and color flash." Card label box flash for visual + header ticker for text context.

---

## Event Colors

| Option | Description | Selected |
|--------|-------------|----------|
| Blue=complete, Amber=grab, Red=error | Matches existing cockpit color system | |
| Green=complete, Amber=grab, Red=error | Green as distinct success color | |
| You decide | Claude picks colors to fit palette | |

**User's choice:** Custom mapping (Other)
**Notes:** User specified: "purple when download completes — amber when user's attention is needed (like file import stuck), amber when indexer is down. Green when update available. Red on health issue." Purple aligns with the existing DOWNLOADS section color. Green adds a new success signal.

---

## Flash Duration

| Option | Description | Selected |
|--------|-------------|----------|
| 3 seconds fade-out | Visible, fades cleanly | |
| 5 seconds hold, then fade | Longer dwell for missed events | |
| Persistent until next event | Stays until new event or status change | |

**User's choice:** Other — "flash for 10 seconds then fadeout"
**Notes:** 10 seconds chosen because the kiosk may not be actively watched at moment of event. Long enough to catch glancing at the screen.

---

## Message Lifecycle / Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Truly ephemeral — no persistence | Fire-and-forget. No DB writes. | |
| Server-side short TTL (60s) | Events survive 60s refresh window in memory | |
| SQLite with 24-hour TTL | Persistent history with DB writes | |

**User's choice:** Other — "can we just log the event as having happened? No need for TTL — it's front end ephemeral, back end event is just logged"
**Notes:** Backend uses standard pino logger to record the event (structured log entry). No new SQLite events table. Phase 8 log viewer will surface these logs automatically. Frontend state is truly ephemeral (SSE event, no local storage).

---

## SABnzbd Burst Poll

| Option | Description | Selected |
|--------|-------------|----------|
| Until download completes | Burst stops on import-complete webhook or queue empty | ✓ |
| Fixed window: 5 minutes | Burst for 5 min regardless | |
| Both — completion or 5-min timeout | Completion or cap at 5 min | |

**User's choice:** Until download completes
**Notes:** SABnzbd burst poll (1s interval) activates on any arr `grab` event and deactivates when `import`/`download_complete` webhook fires OR when SABnzbd queue is detected empty during polling. No fixed timeout — queue-empty detection provides the safety net.

---

## Ticker Text Format

| Option | Description | Selected |
|--------|-------------|----------|
| SERVICE ▸ EVENT ▸ TITLE | e.g. 'RADARR ▸ GRABBED ▸ The Dark Knight' | ✓ |
| Free-form from payload | Whatever arr sends as message title | |
| You decide | Claude picks a format | |

**User's choice:** SERVICE ▸ EVENT ▸ TITLE

---

## Ticker Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Replace existing header content briefly | Overlays AppHeader for 10s, snaps back | ✓ |
| Second row below AppHeader | Thin banner row appears/collapses | |
| You decide | Claude picks least disruptive | |

**User's choice:** Replace existing header content briefly
**Notes:** Preserves 800x480 layout budget — no new layout rows.

---

## Arr Events to Handle

| Option | Description | Selected |
|--------|-------------|----------|
| On Grab | Radarr/Sonarr queued an item | ✓ |
| On Download/Import complete | File imported to library | ✓ |
| On Health Issue | Arr health check fails, indexer down | ✓ |
| On Update Available | New version available | ✓ |

**User's choice:** All four
**Notes:** User added: "for Prowlarr, this would also be an indexer is down." Mapped to `health_issue` event type with red flash.

---

## Event Log (Backend)

| Option | Description | Selected |
|--------|-------------|----------|
| Standard app log | pino log entry, picked up by Phase 8 log viewer | ✓ |
| Separate SQLite events table | New event_log table, queryable history | |

**User's choice:** Standard app log

---

## Webhook URL Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page — show copy-able URLs | Notifications tab with URL + copy button | ✓ |
| README / setup docs only | Document in setup guide | |
| Auto-configure via arr API | Coruscant self-registers via arr API | |

**User's choice:** Settings page — show copy-able URLs
**Notes:** One-time setup per arr app. User pastes URL into arr Connections settings.

---

## Poll Optimization Scope

| Option | Description | Selected |
|--------|-------------|----------|
| SABnzbd burst on grab only | Keep Phase 7 focused | ✓ |
| Arr polling increase on health events | Faster recovery detection | |
| All arr → pause polling on grab | Pause arr poll when it just told you | |

**User's choice:** SABnzbd burst on grab only
**Notes:** Other poll optimizations deferred to Phase 8 (dedicated polling tuning phase).

---

## Claude's Discretion

- CSS animation timing curve for flash fade-out
- Debouncing rapid successive events from same service
- Which arr payload fields to use for TITLE in ticker
- Burst poll survival across server restart (in-memory, resets — acceptable)

## Deferred Ideas

- Threshold alert sending (NOTIF-02 to NOTIF-06) — outbound Pushover alerts on threshold breaches
- Arr poll frequency increase on health events → Phase 8
- Arr poll pause on grab → Phase 8
- Auto-configure arr connections via arr API
- Pushover relay fallback — not needed given arr native webhooks
