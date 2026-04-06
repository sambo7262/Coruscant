# Phase 7: Notifications (Webhook Event Signaling) — Research

**Researched:** 2026-04-06
**Domain:** Arr webhook payloads, SSE ephemeral event broadcast, SABnzbd burst poll, Settings tab extension
**Confidence:** HIGH (codebase patterns fully read; arr payload schemas verified from GitHub source; SABnzbd limitation confirmed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 7 is a **webhook receiver** system, not a Pushover inbox. No Pushover API polling, no external dependencies.
- **D-02:** Messages are **ephemeral on the frontend** — flash state exists only in memory/SSE. Page refresh clears all flash states.
- **D-03:** Backend **logs each event** via pino logger (structured: service, event_type, title/payload). No new SQLite table.
- **D-04:** Each arr app POSTs to `POST /api/webhooks/{service}`. Follows Tautulli webhook pattern exactly.
- **D-05:** No authentication on webhook endpoints — LAN-only deployment (same policy as Tautulli webhook).
- **D-06:** Endpoints must tolerate empty bodies and unknown event types gracefully (return 200, log and ignore).
- **D-07:** Four event categories: `grab` (Amber `#ffaa00`), `download_complete`/`import` (Purple `#c084fc`), `health_issue` (Red `#ff4444`), `update_available` (Green `#00ff88`).
- **D-08:** Prowlarr's "indexer down" maps to `health_issue`.
- **D-09:** Flash duration: 10 seconds visible, then fade out. Header ticker uses same 10s window.
- **D-10:** Card label box gets colored border/glow flash.
- **D-11:** Flash is purely CSS animation driven by a transient SSE event — no persistent frontend state.
- **D-12:** Ticker overlays center and right columns of AppHeader for 10 seconds, then snaps back.
- **D-13:** Ticker format: `SERVICE ▸ EVENT ▸ TITLE`. Examples: `RADARR ▸ GRABBED ▸ The Dark Knight`.
- **D-14:** On `grab` event → SABnzbd switches to 1-second poll interval.
- **D-15:** Burst mode ends on `download_complete`/`import` webhook OR SABnzbd queue empty detection.
- **D-16:** No fixed timeout on burst poll — queue-empty detection is the fallback.
- **D-17:** Notifications settings tab lists each arr service with copy-able webhook URL.
- **D-18:** URL format: `http://{coruscant-ip}:1688/api/webhooks/{service}`.
- **D-19:** No TEST CONNECTION button on Notifications tab.

### Claude's Discretion

- Exact CSS animation timing curve for the flash fade-out (ease-out recommended)
- Whether to debounce rapid successive events from same service (UI-SPEC says 500ms debounce → show only second flash)
- Which arr payload fields to use for ticker `TITLE` portion (researcher to confirm — confirmed below)
- How burst poll mode survives server restart (in-memory flag resets on restart; acceptable)

### Deferred Ideas (OUT OF SCOPE)

- Threshold alert sending (NOTIF-02 to NOTIF-06)
- Arr poll pause on grab
- Arr poll frequency increase on health events
- Auto-configure arr connections via arr API
- Pushover relay fallback
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-01 | User can configure Pushover application token and user key in settings | Reframed: Phase 7 delivers webhook URL display in a Notifications tab instead. The CONTEXT.md supersedes the REQUIREMENTS.md framing. Settings tab infrastructure already exists. |
| NOTIF-02 | System sends Pushover notification when any monitored service transitions to offline/critical state | Deferred per CONTEXT.md. Out of scope for Phase 7. |
| NOTIF-03 | User can configure per-service numeric thresholds | Deferred per CONTEXT.md. Out of scope for Phase 7. |
| CFG-02 | Settings page lets user configure per-service notification thresholds | Partially addressed: Phase 7 delivers the Notifications settings tab with webhook URL display. Threshold configuration is deferred. |
</phase_requirements>

---

## Summary

Phase 7 wires arr service webhook events into Coruscant as an ephemeral event-driven signaling system. When Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, or Readarr fires a webhook, Coruscant receives it, logs it via pino, broadcasts an SSE `arr_event` message to connected frontends, and the frontend flashes the relevant card label box with a color-coded glow animation for 10 seconds while the AppHeader ticker briefly displays the event text.

The three core deliverables are: (1) backend webhook receiver endpoints following the Tautulli pattern exactly, (2) SABnzbd burst poll mode activated on grab events and terminated on import or empty-queue detection, and (3) a Notifications settings tab showing copy-able webhook URLs for each arr service.

The codebase patterns are extremely well-established. The Tautulli webhook route (`packages/backend/src/routes/tautulli-webhook.ts`), PollManager broadcast infrastructure, SSE route, and `useDashboardSSE` hook are all in place and require direct extension — not reimplementation. The SSE mechanism must be extended to emit a second named event type (`arr_event`) alongside the existing `dashboard-update` type.

**Primary recommendation:** Implement `packages/backend/src/routes/arr-webhooks.ts` as a single plugin handling all arr services (Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, Readarr, SABnzbd), add `handleArrEvent()` to PollManager, extend the SSE route and `useDashboardSSE` hook for the new event type, add `ArrWebhookEvent` to `packages/shared/src/types.ts`, and render flash + ticker state from the new SSE event in AppHeader and MediaStackRow.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Already Present |
|---------|---------|---------|-----------------|
| Fastify | 5.x | Webhook receiver routes | Yes — `packages/backend` |
| pino | 10.x | Structured event logging per D-03 | Yes — `packages/backend/package.json` |
| vitest | 4.x | Route unit tests via Fastify inject() | Yes — root `package.json` |
| TypeScript | 6.x | Type-safe payload interfaces | Yes |
| React + Framer Motion | 18.x + 11.x | Card flash animation, ticker overlay | Yes |

No new npm packages required. Phase 7 is a pure extension of existing infrastructure.

### New Shared Type Required

```typescript
// packages/shared/src/types.ts — add this
export interface ArrWebhookEvent {
  service: string          // 'radarr' | 'sonarr' | 'lidarr' | 'bazarr' | 'prowlarr' | 'readarr' | 'sabnzbd'
  eventCategory: 'grab' | 'download_complete' | 'health_issue' | 'update_available' | 'unknown'
  title?: string           // content title for ticker display (movie/show/artist/book/album)
  rawEventType: string     // original eventType from arr payload, for logging
}
```

---

## Arr Webhook Payload Schemas

This is the central unknown the CONTEXT.md asked researcher to confirm. All findings below are HIGH confidence — verified from official GitHub source code (WebhookBase.cs files in each arr repository).

### Event Type Mapping: Arr `eventType` → Coruscant `eventCategory`

| Arr `eventType` (exact case) | Coruscant `eventCategory` | Services |
|------------------------------|--------------------------|---------|
| `Grab` | `grab` | Radarr, Sonarr, Lidarr, Readarr |
| `Download` | `download_complete` | Radarr, Sonarr, Lidarr, Readarr |
| `Health` | `health_issue` | Radarr, Sonarr, Lidarr, Prowlarr, Readarr |
| `HealthRestored` | `unknown` (log and ignore — health recovered) | All |
| `ApplicationUpdate` | `update_available` | Radarr, Sonarr, Lidarr, Prowlarr, Readarr |
| `Test` | `unknown` (log and ignore — return 200) | All |
| `MovieAdded`, `MovieFileDelete`, `MovieDelete`, `Rename` | `unknown` (log and ignore) | Radarr |
| `ManualInteractionRequired` | `unknown` (log and ignore) | Radarr |
| `DownloadFailure`, `ImportFailure`, `Retag`, `ArtistAdd`, `ArtistDelete`, `AlbumDelete` | `unknown` (log and ignore) | Lidarr |
| `BookDelete`, `BookFileDelete`, `AuthorAdded`, `AuthorDelete`, `Retag` | `unknown` (log and ignore) | Readarr |

**Note:** `eventType` is sent with capital first letter (`Grab`, not `grab`). The webhook handler must normalize case or compare case-insensitively.

### Title Field per Service

| Service | Event | Title Field Path | Notes |
|---------|-------|-----------------|-------|
| **Radarr** | `Grab` | `movie.title` | Top-level `movie` object |
| **Radarr** | `Download` | `movie.title` | Same |
| **Radarr** | `Health` | `message` | Health message text (no media title) |
| **Radarr** | `ApplicationUpdate` | none | Use `RADARR ▸ UPDATE AVAILABLE` (no title field) |
| **Sonarr** | `Grab` | `series.title` | Top-level `series` object; episodes array also present |
| **Sonarr** | `Download` | `series.title` | Same |
| **Sonarr** | `Health` | `message` | Health message text |
| **Sonarr** | `ApplicationUpdate` | none | No title field |
| **Lidarr** | `Grab` | `artist.name` | Artist name — `Artist` object; album in `albums[0].title` |
| **Lidarr** | `Download` | `artist.name` | Same |
| **Lidarr** | `Health` | `message` | Health message text |
| **Prowlarr** | `Health` | `message` | Health check message; `type` field names the source |
| **Prowlarr** | `ApplicationUpdate` | none | No title field |
| **Readarr** | `Grab` | `author.authorName` | `Author` object |
| **Readarr** | `Download` | `author.authorName` | `Book` object also has `title` field |

**Ticker title extraction strategy:** Extract the first non-null of these candidate fields, in order:
1. `movie.title` (Radarr)
2. `series.title` (Sonarr)
3. `artist.name` (Lidarr)
4. `author.authorName` (Readarr)
5. `album.title` (Lidarr grab — alternative)
6. `message` (Health events — becomes ticker suffix instead of title)
7. `undefined` (omit title portion from ticker)

This single extraction loop works across all services without service-specific branching.

### Radarr Grab Payload Example (HIGH confidence — from WebhookBase.cs)

```json
{
  "eventType": "Grab",
  "instanceName": "Radarr",
  "applicationUrl": "http://...",
  "movie": {
    "id": 1,
    "title": "The Dark Knight",
    "year": 2008,
    "releaseDate": "2008-07-18",
    "folderPath": "/movies/The Dark Knight (2008)",
    "tmdbId": 155,
    "imdbId": "tt0468569"
  },
  "remoteMovie": { "tmdbId": 155, "imdbId": "tt0468569", "title": "The Dark Knight", "year": 2008 },
  "release": {
    "quality": "Bluray-1080p",
    "qualityVersion": 1,
    "releaseGroup": "Group",
    "releaseTitle": "...",
    "indexer": "NZBGeek",
    "size": 10000000000
  },
  "downloadClient": "SABnzbd",
  "downloadClientType": "Sabnzbd",
  "downloadId": "SAB_123"
}
```

### Sonarr Download Payload Key Fields (HIGH confidence)

```json
{
  "eventType": "Download",
  "series": {
    "id": 1,
    "title": "Severance",
    "titleSlug": "severance",
    "path": "/tv/Severance",
    "tvdbId": 321239
  },
  "episodes": [
    {
      "id": 100,
      "episodeNumber": 8,
      "seasonNumber": 2,
      "title": "Ragman"
    }
  ],
  "episodeFile": { ... },
  "isUpgrade": false
}
```

For Sonarr ticker: prefer `series.title` — episode title available in `episodes[0].title` but adds complexity for marginal value.

### Prowlarr Health Payload (HIGH confidence — from WebhookBase.cs)

```json
{
  "eventType": "Health",
  "instanceName": "Prowlarr",
  "level": "error",
  "message": "Indexer NZBGeek is unavailable due to connection errors.",
  "type": "IndexerStatusCheck",
  "wikiUrl": "https://wiki.servarr.com/prowlarr/..."
}
```

**D-08 mapping:** `type: "IndexerStatusCheck"` → ticker shows `PROWLARR ▸ INDEXER DOWN`. Other health types use the generic `PROWLARR ▸ HEALTH ISSUE` format.

### Lidarr Grab Payload Key Fields (HIGH confidence)

```json
{
  "eventType": "Grab",
  "artist": { "id": 1, "name": "Radiohead", "path": "/music/Radiohead", "mbId": "..." },
  "albums": [{ "id": 10, "title": "OK Computer", "releaseDate": "1997-05-28" }],
  "release": { "quality": "FLAC", ... }
}
```

### Readarr Grab Payload Key Fields (HIGH confidence)

```json
{
  "eventType": "Grab",
  "author": { "id": 1, "authorName": "Andy Weir", "authorNameLastFirst": "Weir, Andy" },
  "books": [{ "id": 5, "title": "Project Hail Mary" }]
}
```

**Readarr note:** Readarr project has been retired (confirmed in search results). The endpoint should still be registered for users who have it running, but it is low-priority and may simply never fire.

---

## SABnzbd Webhook Constraint

**Finding:** SABnzbd does NOT support native outbound HTTP webhooks. (HIGH confidence — confirmed from GitHub issue #688, official wiki, and maintainer response.)

SABnzbd notification options:
- **Apprise integration** — sends to Apprise-compatible URL schemas (Discord, Slack, etc.), not arbitrary HTTP POST endpoints
- **Notification scripts** — executes a local script with args: `(notification_type, title, message)` — no HTTP POST capability built-in

**Implication for Phase 7:**

The CONTEXT.md design (D-14 through D-16) already accounts for this: SABnzbd does not send grab events to Coruscant. Instead:

1. **Burst poll trigger:** SABnzbd burst poll is activated by grab events from the ARR apps (Radarr, Sonarr, Lidarr, Readarr), not from SABnzbd itself.
2. **SABnzbd webhook endpoint:** The `POST /api/webhooks/sabnzbd` endpoint should still be registered (listed in Notifications tab for completeness and future compatibility), but in practice no payload will arrive from SABnzbd unless the user runs a custom notification script.
3. **Burst mode termination:** Queue-empty detection during polling is the primary mechanism (D-15, D-16). `download_complete`/`import` from arr apps is the webhook-triggered termination.
4. **SABnzbd endpoint in Notifications tab:** List it with a note that SABnzbd requires a custom notification script to POST to this URL (Apprise does not work with arbitrary endpoints). The webhook URL is still displayed — it informs power users who write their own notification scripts.

**Bazarr finding (LOW confidence — could not locate payload schema):**
Bazarr is primarily a webhook receiver (it receives Plex/Jellyfin events to trigger subtitle searches) rather than a webhook sender. Its outbound notification capability uses Apprise or other notification platforms. There is no official documentation found for Bazarr sending a structured `eventType` JSON webhook to arbitrary endpoints. The `POST /api/webhooks/bazarr` endpoint should be registered and return 200 for any payload, but no specific payload parsing is required for Phase 7. The Notifications tab lists it for completeness.

---

## Architecture Patterns

### Pattern 1: Arr Webhook Route (follows Tautulli exactly)

**File:** `packages/backend/src/routes/arr-webhooks.ts`

```typescript
// Source: Exact pattern from packages/backend/src/routes/tautulli-webhook.ts
export async function arrWebhookRoutes(fastify: FastifyInstance) {
  // Reuse same content-type parser pattern as Tautulli webhook
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const str = body as string
    if (!str || str.trim() === '') { done(null, {}); return }
    try { done(null, JSON.parse(str)) } catch (err) { done(err as Error, undefined) }
  })

  const ARR_SERVICES = ['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd']
  for (const service of ARR_SERVICES) {
    fastify.post(`/api/webhooks/${service}`, async (request, reply) => {
      const body = request.body as Record<string, unknown> | null | undefined
      if (!body || Object.keys(body).length === 0) {
        return reply.code(200).send({ success: true, note: 'empty payload' })
      }
      pollManager.handleArrEvent(service, body)
      return reply.code(200).send({ success: true })
    })
  }
}
```

**Registration in `index.ts`:**

```typescript
import { arrWebhookRoutes } from './routes/arr-webhooks.js'
// ...
await fastify.register(arrWebhookRoutes)
```

### Pattern 2: PollManager Extension

Add to `packages/backend/src/poll-manager.ts`:

```typescript
// New in-memory burst poll state
private sabnzbdBurstTimer: ReturnType<typeof setInterval> | null = null

// New listeners for arr_event SSE pushes (separate from broadcastListeners)
private arrEventListeners: Array<(event: ArrWebhookEvent) => void> = []

onArrEvent(listener: (event: ArrWebhookEvent) => void): () => void {
  this.arrEventListeners.push(listener)
  return () => { /* remove from array */ }
}

handleArrEvent(service: string, body: Record<string, unknown>): void {
  // 1. Classify event
  const rawEventType = typeof body.eventType === 'string' ? body.eventType : 'unknown'
  const eventCategory = classifyArrEvent(rawEventType)
  const title = extractArrTitle(body)

  // 2. Log via pino (D-03)
  fastify.log.info({ service, eventCategory, rawEventType, title }, 'arr_webhook_received')

  // 3. Broadcast SSE arr_event
  const event: ArrWebhookEvent = { service, eventCategory, title, rawEventType }
  for (const listener of this.arrEventListeners) { listener(event) }

  // 4. Burst poll logic (D-14, D-15)
  if (eventCategory === 'grab') {
    this.activateSabnzbdBurstPoll()
  } else if (eventCategory === 'download_complete') {
    this.deactivateSabnzbdBurstPoll()
  }
}

private activateSabnzbdBurstPoll(): void {
  // Stop existing SABnzbd timer, start 1s timer
  const existing = this.timers.get('sabnzbd')
  if (existing) { clearInterval(existing); this.timers.delete('sabnzbd') }
  // restart with 1s interval (burst)
  // ... (use stored sabnzbd config from module-level cache)
}

private deactivateSabnzbdBurstPoll(): void {
  // Stop burst timer, restart at SABNZBD_INTERVAL_MS (10s)
}
```

**Queue-empty detection** (D-15 fallback): Inside the SABnzbd adapter poll, if `queueCount === 0` and burst mode is active, call `pollManager.deactivateSabnzbdBurstPoll()`. This requires the poll function to have access to the PollManager or pass a callback.

**SABnzbd config caching:** To restart the SABnzbd poll at normal interval after burst, PollManager needs to cache the SABnzbd config (baseUrl + apiKey). Add `private sabnzbdConfig: { baseUrl: string; apiKey: string } | null = null` and set it in `reload('sabnzbd', ...)`.

### Pattern 3: SSE Route Extension

The existing SSE route (`packages/backend/src/routes/sse.ts`) only emits `dashboard-update` events. Extend it to also listen for `arr_event` broadcasts:

```typescript
// In sseRoutes, after registering the interval:
const unsubscribeArr = pollManager.onArrEvent((event) => {
  reply.raw.write(`event: arr-event\ndata: ${JSON.stringify(event)}\n\n`)
})

// In cleanup:
const cleanup = () => {
  clearInterval(interval)
  unsubscribeArr()
  resolve()
}
```

**Named SSE event:** Use `event: arr-event` (hyphenated, matches SSE spec convention). Frontend listens with `es.addEventListener('arr-event', ...)`.

### Pattern 4: Frontend SSE Hook Extension

Extend `packages/frontend/src/hooks/useDashboardSSE.ts`:

```typescript
export function useDashboardSSE() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastArrEvent, setLastArrEvent] = useState<ArrWebhookEvent | null>(null)

  useEffect(() => {
    // ...existing connect logic...
    es.addEventListener('dashboard-update', (e: MessageEvent) => {
      setSnapshot(JSON.parse(e.data) as DashboardSnapshot)
      setConnected(true)
    })

    es.addEventListener('arr-event', (e: MessageEvent) => {
      setLastArrEvent(JSON.parse(e.data) as ArrWebhookEvent)
    })
    // ...
  }, [])

  return { snapshot, connected, lastArrEvent }
}
```

`lastArrEvent` replaces itself on each new event — latest event wins, matching D-12 ticker behavior.

### Pattern 5: AppHeader Ticker

AppHeader currently accepts `nas`, `connected`, `showBack`, `nasConfigured` props. Add `lastArrEvent?: ArrWebhookEvent | null`:

```typescript
// In AppHeader, add ticker state:
const [ticker, setTicker] = useState<{ text: string; color: string } | null>(null)

useEffect(() => {
  if (!lastArrEvent || lastArrEvent.eventCategory === 'unknown') return
  const text = buildTickerText(lastArrEvent)
  const color = EVENT_COLORS[lastArrEvent.eventCategory]
  setTicker({ text, color })
  const timer = setTimeout(() => setTicker(null), 10_000)
  return () => clearTimeout(timer)
}, [lastArrEvent])
```

Ticker replaces the center+right columns of the `gridTemplateColumns: '1fr auto 1fr'` header grid. The left `CORUSCANT` label is always visible (D-12).

### Pattern 6: MediaStackRow Flash

Flash applies to `MediaStackRow` in `ServiceCard.tsx` (the arr rows in the media stack panel). Add `lastArrEvent?: ArrWebhookEvent | null` prop and detect matching service:

```typescript
const [flashColor, setFlashColor] = useState<string | null>(null)

useEffect(() => {
  if (!lastArrEvent || lastArrEvent.service !== service.id) return
  if (lastArrEvent.eventCategory === 'unknown') return
  const color = EVENT_COLORS[lastArrEvent.eventCategory]
  setFlashColor(color)
  const timer = setTimeout(() => setFlashColor(null), 10_000)
  return () => clearTimeout(timer)
}, [lastArrEvent, service.id])
```

When `flashColor` is set, the `motion.div` wrapper gets additional inline styles: `border: 1px solid {flashColor}`, `boxShadow: 0 0 8px 2px {flashColor}40`.

**Debounce (Claude's Discretion):** If a second event arrives for the same service within 500ms, reset the timer and show the new color. The `useEffect` on `lastArrEvent` naturally handles this — each new `lastArrEvent` object reference triggers the effect, clears the old timer, and sets a new one. No additional debounce logic needed.

### Pattern 7: Settings Notifications Tab

SettingsPage already has a tabbed layout. Add `NOTIFICATIONS` tab to the `SERVICES` constant and render a read-only webhook URL display component. The base URL comes from the stored `coruscant` service config (if present) or uses a placeholder. No API call needed — webhook URLs are static paths.

```typescript
// In SettingsPage.tsx — add tab
const TABS = ['SERVICE', 'NOTIFICATIONS']  // (existing services + new tab)
```

The Notifications tab content renders 7 rows (RADARR through SABNZBD) with service label + URL field + COPY URL button per the UI-SPEC.

### Recommended Project Structure

No new directories needed. New files:

```
packages/backend/src/
├── routes/
│   └── arr-webhooks.ts       [NEW] — all arr webhook endpoints
├── __tests__/
│   └── arr-webhooks.test.ts  [NEW] — vitest route tests

packages/shared/src/
└── types.ts                  [EXTEND] — add ArrWebhookEvent interface

packages/frontend/src/
├── hooks/
│   └── useDashboardSSE.ts    [EXTEND] — add lastArrEvent state
├── components/layout/
│   └── AppHeader.tsx          [EXTEND] — add ticker overlay
└── components/cards/
    └── ServiceCard.tsx        [EXTEND] — add flash to MediaStackRow
```

Plus:
- `packages/frontend/src/globals.css` — add `@keyframes arrFlash`
- `packages/backend/src/index.ts` — register `arrWebhookRoutes`
- `packages/backend/src/poll-manager.ts` — add `handleArrEvent`, burst poll methods

### Anti-Patterns to Avoid

- **Do not create a new SQLite table for events.** D-03 is explicit: pino log only. No persistence.
- **Do not modify `DashboardSnapshot`.** Arr events are ephemeral SSE pushes, not snapshot data. Adding them to `getSnapshot()` would cause events to re-trigger on every new SSE client connection.
- **Do not reuse `broadcastSnapshot()` for arr events.** `broadcastSnapshot()` pushes the full snapshot; arr events need their own SSE event type so frontends can distinguish them without re-parsing the snapshot.
- **Do not add a `contentTypeParser` conflict.** The tautulli-webhook.ts and arr-webhooks.ts both register a content-type parser. Fastify throws on duplicate parser registration within the same plugin scope. Solution: register both route files as separate plugins (Fastify's `register()` isolates plugin scope). The existing code already does this correctly — `tautulliWebhookRoutes` is registered as a plugin, and `arrWebhookRoutes` should be too. No conflict.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timer-based flash removal | `setInterval` tracker | `setTimeout` + `useEffect` cleanup | React cleanup pattern handles re-trigger correctly |
| Arr event fan-out to SSE clients | Custom pub/sub | `broadcastListeners` pattern already in PollManager | Established pattern, already works |
| SABnzbd config re-storage | New DB column | Module-level private field in PollManager | Config already passed via `reload()`; just cache it |

---

## Common Pitfalls

### Pitfall 1: Duplicate ContentTypeParser

**What goes wrong:** Registering two Fastify plugins that both call `fastify.addContentTypeParser('application/json', ...)` on the same `fastify` instance throws: `FST_ERR_CTP_ALREADY_PRESENT`.

**Why it happens:** Fastify's content-type parser registry is shared within a plugin scope. If `arrWebhookRoutes` and `tautulliWebhookRoutes` are registered on the same root instance without scoping, the second parser registration conflicts.

**How to avoid:** Both plugins are registered via `fastify.register(plugin)` in `index.ts`. Fastify `register()` creates a new child scope for each plugin, so parsers registered inside a plugin are scoped to that plugin's context. This is already the correct pattern — verify that `addContentTypeParser` is called inside the plugin function, not outside.

**Warning sign:** `FST_ERR_CTP_ALREADY_PRESENT` error at startup.

### Pitfall 2: SSE Named Events Not Received in `useDashboardSSE`

**What goes wrong:** Adding `event: arr-event\ndata: ...` in the SSE route but using `es.onmessage` on the frontend only receives unnamed events. Named events (those with `event:` line) require `addEventListener`.

**Why it happens:** The existing hook correctly uses `es.addEventListener('dashboard-update', ...)` — it does NOT use `es.onmessage`. Extending with `es.addEventListener('arr-event', ...)` follows the same correct pattern. Risk is a copy-paste error that uses `onmessage`.

**How to avoid:** Follow the existing `addEventListener` pattern exactly for the new event type.

**Warning sign:** `lastArrEvent` never updates despite backend logging webhook receipt.

### Pitfall 3: useEffect Stale Closure on SABnzbd Burst Interval

**What goes wrong:** When `activateSabnzbdBurstPoll()` creates a `setInterval` closure, if the SABnzbd config is read at interval-creation time from a variable that later gets updated, the closure captures the old reference.

**Why it happens:** JavaScript closures capture by reference for variables, but the `doPoll` closure in PollManager captures `baseUrl` and `apiKey` from the `reload()` call scope. These are stable — they don't change unless `reload()` is called again.

**How to avoid:** Store SABnzbd config in `private sabnzbdConfig` on PollManager at `reload('sabnzbd', ...)` time. Both normal and burst poll functions read from `this.sabnzbdConfig` — no stale closure risk.

**Warning sign:** Burst poll fires with 404s or auth errors after a SABnzbd reconfiguration.

### Pitfall 4: Missing `arr_event` on MockSocket (Test Isolation)

**What goes wrong:** Tests using Fastify's `inject()` get a `MockSocket`. The SSE route has a special path: `if (MockSocket) { reply.raw.end() }`. New arr-event SSE tests that expect the second named event type won't work with the existing SSE test infrastructure.

**Why it happens:** The MockSocket early-exit only delivers the first `dashboard-update` event.

**How to avoid:** Arr webhook tests should NOT test SSE delivery end-to-end. Instead, mock `pollManager.handleArrEvent` and verify it was called (same pattern as Tautulli tests mock `pollManager.updatePlexState`). SSE delivery is tested by the existing `sse.test.ts` pattern — verify the route registers; don't couple arr webhook tests to SSE output.

**Warning sign:** Arr webhook test hangs waiting for SSE response.

### Pitfall 5: SABnzbd Burst Poll Timer Leak on `stopAll()`

**What goes wrong:** `pollManager.stopAll()` clears `this.timers` but if the burst poll stores its timer separately (not in `this.timers`), the burst poll timer leaks in test teardown.

**How to avoid:** Store the burst poll timer in `this.timers` with a dedicated key like `'sabnzbd-burst'`, or simply always overwrite the `'sabnzbd'` key with the new timer when activating burst mode. The existing `stopAll()` loop clears all `this.timers` entries — as long as the burst timer is stored there, cleanup is automatic.

---

## Code Examples

### Event Classification Function

```typescript
// Source: Derived from GitHub Radarr/Sonarr/Lidarr/Prowlarr/Readarr WebhookBase.cs
type ArrEventCategory = 'grab' | 'download_complete' | 'health_issue' | 'update_available' | 'unknown'

function classifyArrEvent(rawEventType: string): ArrEventCategory {
  switch (rawEventType.toLowerCase()) {
    case 'grab':
      return 'grab'
    case 'download':
      return 'download_complete'
    case 'health':
      return 'health_issue'
    case 'applicationupdate':
      return 'update_available'
    default:
      return 'unknown'
  }
}
```

### Title Extraction Function

```typescript
// Source: Verified field names from Radarr/Sonarr/Lidarr/Readarr WebhookBase.cs
function extractArrTitle(body: Record<string, unknown>): string | undefined {
  const movie = body.movie as Record<string, unknown> | undefined
  const series = body.series as Record<string, unknown> | undefined
  const artist = body.artist as Record<string, unknown> | undefined
  const author = body.author as Record<string, unknown> | undefined

  return (
    (typeof movie?.title === 'string' ? movie.title : undefined) ??
    (typeof series?.title === 'string' ? series.title : undefined) ??
    (typeof artist?.name === 'string' ? artist.name : undefined) ??
    (typeof author?.authorName === 'string' ? author.authorName : undefined) ??
    undefined
  )
}
```

### Flash Color Map

```typescript
// Source: 07-CONTEXT.md D-07 and 07-UI-SPEC.md Color section
const EVENT_COLORS: Record<ArrEventCategory, string> = {
  grab: '#ffaa00',
  download_complete: '#c084fc',
  health_issue: '#ff4444',
  update_available: '#00ff88',
  unknown: 'transparent',
}
```

### CSS Flash Keyframe (add to globals.css)

```css
/* Source: 07-UI-SPEC.md Animation Spec */
@keyframes arrFlash {
  0%, 80%  { opacity: 1; }
  100%     { opacity: 0; }
}
```

Applied with: `animation: arrFlash 10s linear forwards` on the glow overlay element.

### Ticker Text Builder

```typescript
// Source: 07-CONTEXT.md D-13 and 07-UI-SPEC.md Copywriting Contract
function buildTickerText(event: ArrWebhookEvent): string {
  const svc = event.service.toUpperCase()  // 'RADARR'
  const verb = {
    grab: 'GRABBED',
    download_complete: 'IMPORTED',
    health_issue: event.rawEventType === 'Health' && event.title?.includes('ndexer') ? 'INDEXER DOWN' : 'HEALTH ISSUE',
    update_available: 'UPDATE AVAILABLE',
    unknown: '',
  }[event.eventCategory]

  if (event.title && event.eventCategory !== 'health_issue' && event.eventCategory !== 'update_available') {
    return `${svc} ▸ ${verb} ▸ ${event.title}`
  }
  return `${svc} ▸ ${verb}`
}
```

**Note on health_issue title:** Health events do not have a media title — `message` field describes the issue (e.g., "Indexer NZBGeek is unavailable"). The ticker shows `SERVICE ▸ INDEXER DOWN` or `SERVICE ▸ HEALTH ISSUE` without a title portion. The `message` field is logged by pino but not displayed in the ticker (too long).

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Polling arr health endpoints to detect state changes | Webhook push from arr apps direct to Coruscant | Eliminates polling latency; events are instant |
| SABnzbd polling at fixed interval | Burst poll on grab webhook | True real-time download progress during active grabs |
| Separate notification service (Pushover relay) | Direct arr → Coruscant webhook | No external dependency; LAN-only; simpler |

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — Phase 7 is code-only changes to existing services, all of which are already running).

The one environmental note: arr services must be configured in their UI to POST webhooks to Coruscant. This is a user configuration step documented in the Notifications tab, not an installation dependency for the code.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `/Users/Oreo/Projects/Coruscant/vitest.config.ts` |
| Test include pattern | `packages/*/src/__tests__/**/*.test.ts` |
| Quick run command | `npm test -- --reporter=verbose --run` (from project root) |
| Full suite command | `npm test` (from project root) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 (reframed) | `POST /api/webhooks/radarr` returns 200 for valid Grab payload | unit | `npm test -- --reporter=verbose --run` | ❌ Wave 0 |
| NOTIF-01 (reframed) | `POST /api/webhooks/sonarr` returns 200 for valid Download payload | unit | same | ❌ Wave 0 |
| NOTIF-01 (reframed) | All arr endpoints return 200 for empty body | unit | same | ❌ Wave 0 |
| NOTIF-01 (reframed) | All arr endpoints return 200 for unknown eventType | unit | same | ❌ Wave 0 |
| NOTIF-01 (reframed) | `handleArrEvent` classifies Grab → `grab`, Download → `download_complete`, Health → `health_issue`, ApplicationUpdate → `update_available` | unit | same | ❌ Wave 0 |
| NOTIF-01 (reframed) | `extractArrTitle` extracts `movie.title` for Radarr, `series.title` for Sonarr, `artist.name` for Lidarr | unit | same | ❌ Wave 0 |
| CFG-02 (Notifications tab) | Notifications tab renders 7 webhook URL rows | visual / manual | N/A — manual verification | N/A |
| D-14/D-15 (burst poll) | `handleArrEvent('radarr', grab)` activates burst poll (SABnzbd timer interval = 1000ms) | unit | same | ❌ Wave 0 |
| D-14/D-15 (burst poll) | `handleArrEvent('sonarr', download)` deactivates burst poll | unit | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` — full suite (13 existing + new tests, all fast)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/backend/src/__tests__/arr-webhooks.test.ts` — covers webhook route registration, payload classification, title extraction, burst poll activation/deactivation
- [ ] No new test infrastructure needed — existing Vitest config and Fastify `inject()` pattern from `tautulli-webhook.test.ts` is the template

---

## Open Questions

1. **Bazarr outbound webhook payload**
   - What we know: Bazarr uses Apprise for outbound notifications; no structured `eventType` JSON POST found
   - What's unclear: Whether any user-facing Bazarr setting produces an HTTP POST to an arbitrary endpoint with a parseable payload
   - Recommendation: Register `POST /api/webhooks/bazarr`, return 200 for any payload, log it. Do not implement payload parsing for Bazarr. If a user's Bazarr fires something, the raw log entry (D-03) will surface what it sends.

2. **Prowlarr health message for ticker**
   - What we know: Prowlarr health payload has `type: "IndexerStatusCheck"` for indexer issues, but also has other health types
   - What's unclear: Whether to detect "indexer" from `type` field or from `message` content
   - Recommendation: Check `type.toLowerCase().includes('indexer')` — if true, use `INDEXER DOWN` copy; otherwise use `HEALTH ISSUE`. This matches D-08 intent without brittle string matching on `message`.

3. **SABnzbd config availability for burst poll restart**
   - What we know: `reload('sabnzbd', config)` is called on startup and on settings save
   - What's unclear: Where to cache the config so `activateSabnzbdBurstPoll()` can restart the normal poll after burst ends
   - Recommendation: Add `private sabnzbdConfig: { baseUrl: string; apiKey: string } | null = null` to PollManager, set in `reload('sabnzbd', ...)`. Both burst activation and deactivation use this cached config.

---

## Sources

### Primary (HIGH confidence)

- `packages/backend/src/routes/tautulli-webhook.ts` — exact pattern for arr webhook route implementation
- `packages/backend/src/poll-manager.ts` — PollManager architecture, `broadcastSnapshot()`, `onBroadcast()`, timer management
- `packages/backend/src/routes/sse.ts` — SSE named event format (`event: dashboard-update\ndata: ...`)
- `packages/frontend/src/hooks/useDashboardSSE.ts` — `addEventListener` pattern for named SSE events
- `packages/shared/src/types.ts` — existing type definitions to extend
- [Radarr WebhookBase.cs on GitHub](https://github.com/Radarr/Radarr/blob/develop/src/NzbDrone.Core/Notifications/Webhook/WebhookBase.cs) — all Radarr event types and payload fields
- [Prowlarr WebhookBase.cs on GitHub](https://github.com/Prowlarr/Prowlarr/blob/develop/src/NzbDrone.Core/Notifications/Webhook/WebhookBase.cs) — Prowlarr event types and Health payload
- [Lidarr WebhookBase.cs on GitHub](https://github.com/Lidarr/Lidarr/blob/develop/src/NzbDrone.Core/Notifications/Webhook/WebhookBase.cs) — Lidarr event types, Artist.name and Album.title fields
- [Readarr WebhookBase.cs on GitHub](https://github.com/Readarr/Readarr/blob/develop/src/NzbDrone.Core/Notifications/Webhook/WebhookBase.cs) — Readarr event types, Author.authorName field
- [SABnzbd GitHub Issue #688](https://github.com/sabnzbd/sabnzbd/issues/688) — confirms no native webhook support; notification script workaround
- [SABnzbd Notifications Wiki](https://sabnzbd.org/wiki/configuration/4.5/notifications) — Apprise integration, no HTTP POST endpoint support

### Secondary (MEDIUM confidence)

- [Sonarr Webhook Schema Wiki](https://github.com/Sonarr/Sonarr/wiki/Webhook-Schema) — Sonarr event types and series/episode field names
- WebSearch: Radarr webhook eventType fields — corroborated `movie.title`, `release.quality` fields

### Tertiary (LOW confidence)

- Bazarr webhook payload — not found; recommendation is to accept-and-log only

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md apply to Phase 7 implementation:

| Constraint | Applicability |
|------------|--------------|
| Must run in Docker Compose on Synology NAS — no exotic runtime dependencies | No new npm dependencies in Phase 7; constraint satisfied |
| `node:22-slim` Docker base (NOT Alpine) | No change to Dockerfile needed in Phase 7 |
| All data stays local — no cloud telemetry, no external API calls except to user-owned services | Webhook endpoints are passive receivers; no outbound calls added |
| No Redux/Zustand — use TanStack Query + React Context for server state | `lastArrEvent` stored in `useDashboardSSE` hook state; no global store needed |
| No PM2 inside Docker | Not applicable |
| No Alpine Linux base | Not applicable |
| SQLite (better-sqlite3) for persistence | D-03: no new SQLite table; pino log only |
| GSD workflow before edits | Enforced by research/plan cycle |
| Use Vitest for tests | Confirmed — existing test infrastructure |
| Use `setInterval` (not node-cron) for service polling | Burst poll uses `setInterval`; consistent with existing PollManager pattern |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing
- Arr webhook payload schemas: HIGH — verified from official GitHub source files
- SABnzbd limitation: HIGH — confirmed from official wiki and GitHub issue
- Bazarr outbound webhook: LOW — no documented schema found; accept-and-log approach
- Architecture patterns: HIGH — directly mirrors Tautulli webhook pattern, fully read from codebase
- Pitfalls: HIGH — all derived from direct codebase reading

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (arr webhook schemas are stable; SABnzbd limitation unlikely to change)
