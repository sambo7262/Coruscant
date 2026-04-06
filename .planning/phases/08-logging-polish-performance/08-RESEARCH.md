# Phase 8: Logging, Polish + Performance — Research

**Researched:** 2026-04-06
**Domain:** Pino structured logging, SSE change-detection, CSS kiosk polish, SQLite schema extension, React log viewer
**Confidence:** HIGH — all findings are grounded in the actual codebase + established project stack

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Performance: Poll Intervals (D-01/D-02)**
| Service | Interval | Mechanism |
|---------|----------|-----------|
| NAS | 1s | DSM API (local) |
| Unifi | 3s | Local UniFi controller |
| Plex | webhook + 5s fallback | Tautulli triggers immediate re-poll + SSE push |
| SABnzbd | 10s / 1s burst | Phase 7 burst — no change |
| arr services | 5s | Heartbeat only |
| Pi-hole | 60s | FTL design limit |
| Image update | 12h | Unchanged |

All interval constants must be exported named constants — no magic numbers (D-02).

**Performance: SSE Change Detection (D-03/D-04/D-05)**
- Hash `services[]`, `nas`, and `streams[]` — exclude `timestamp`
- Skip write if hash matches last sent; 5s interval still ticks as heartbeat

**Performance: Plex Real-Time (D-06/D-07/D-08)**
- Extend `/api/webhooks/tautulli` to handle `PlaybackStart`, `PlaybackStop`, `PlaybackPause`
- Immediately re-poll PMS `/status/sessions` and call `pollManager.broadcastSnapshot()` on those events
- Keep 5s Plex poll as fallback
- Target: banner update latency < 1s

**Layout: Drop Download Bar (D-09/D-10/D-11/D-12/D-13)**
- Remove dedicated SABnzbd DOWNLOADS section from dashboard layout
- Inline progress in SABnzbd tile: `[filename truncated... XX%]` left, `[speed]` right; one line max
- Freed space redistributed to remaining tiles via CSS grid `fr` units / `flex: 1`
- NAS header elements must fill ~95% of tile container height
- 800×480 no-scroll constraint remains (Phase 5 D-01)

**10ft Readability (D-14/D-14b/D-15/D-16/D-17/D-18)**
- Text sizes scaled up for 10ft kiosk distance (Display 24px, Heading 18px, Body 15px, Label 12px)
- Metric audit pass required after text scaling — D-14b checkpoint
- Background swap to deep navy (`#001133` or `#0A0E17`) — replaces `#080C14` (D-15)
- Panel depth: `box-shadow: inset 0 0 20px rgba(0,0,0,0.5)` on `.chamfer-card` (D-16)
- Glow on key numerics: `text-shadow: 0 0 6px currentColor` (D-17)
- JetBrains Mono confirmed sufficient — no font swap needed (D-18)

**CSS Theme: Preview-First (D-34/D-35/D-36/D-37)**
- Build static `theme-preview.html` with 3 variants before any background CSS commit
  - Variant A: `#001133` deep navy
  - Variant B: `#0D0906` warm dark charcoal
  - Variant C: `#000D1A` tactical near-black navy
- CRT scan-line sweep: `.crt-sweep` fixed div, 4px bar, 10s loop (D-37)
  - `body::after` already used for scanline grid — use separate `<div class="crt-sweep">`

**UniFi Max Scaling (D-38)**
- Rolling high-water mark for RX/TX max (replace periodic reset timer)
- Store `unifi.network.rx_max` / `unifi.network.tx_max` in `kv_store` SQLite table
- Read on server start; update immediately when current > stored max; no auto-decay

**UniFi Client Count Bar (D-39)**
- Replace numeric client count with horizontal green bar gauge
- Fixed `#4ADE80`; rolling high-water mark; key `unifi.clients_max` in `kv_store`
- No raw number displayed

**Color + Indicator Polish (D-19/D-20/D-21/D-22)**
- NAS CPU/RAM bar thresholds: green <60%, amber 60–85%, red >85%
- UniFi arrows: blue=RX (↓/↓↓/↓↓↓), red=TX (↑/↑↑/↑↑↑) by speed tier
- NAS becomes standalone instrument tile with amber ribbon header (D-21)
- Plex stats: CPU=green, RAM=blue, download=white (D-22)

**Logging: Capture (D-23/D-24/D-25/D-26/D-27)**
- New `app_logs` SQLite table via Drizzle schema + migration
- Pino transport writes all log entries to `app_logs` automatically
- Capture levels: `info`, `warn`, `error` (exclude debug/trace)
- Nightly auto-prune at 3am via `node-cron`; default 7-day retention
- User-configurable retention via Settings "LOGS" tab

**Logging: Log Viewer UI (D-28/D-29/D-30/D-31/D-32/D-33)**
- Replace LogsPage.tsx stub with live cockpit-aesthetic log viewer
- Columns: TIME | LEVEL chip | SERVICE tag | MESSAGE
- New entries push in from top via SSE `log-entry` named event
- Default filter: WARN+ (hides info noise)
- 500-entry display cap; "LOAD MORE" for pagination
- EXPORT LOGS button (JSON/CSV, no confirm)
- PURGE LOGS button with confirmation modal

### Claude's Discretion

- Text sizes (D-14): exact px TBD by planner based on available vertical space after download bar removal
- Retention API endpoint path: `/api/settings/logs-retention` (suggested in UI-SPEC)
- Log export format: JSON or CSV — planner may choose one or offer both
- Hash algorithm for SSE change detection: any fast content hash (e.g., JSON.stringify deterministic comparison or djb2 hash) — no external dependency needed

### Deferred Ideas (OUT OF SCOPE)

- Radar sweep / concentric circles for Pi-hole DNS chart
- Sepia/aged texture on panels
- Threshold configuration UI for notification triggers
- Per-service log retention settings
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOG-01 | App maintains internal structured logs covering poll events, errors, service state changes, and alert dispatches | Pino already installed (v10.3.1); pino-sqlite transport or custom transport to write to `app_logs` table |
| LOG-02 | User can view logs in a dedicated log viewer page within the dashboard | LogsPage.tsx stub exists; replace with live table component; SSE `log-entry` event feeds live tail |
| LOG-03 | User can purge all logs or logs older than a selectable age from the UI | POST `/api/logs/purge` endpoint; retention stored in `app_logs_config` or settings table; nightly node-cron prune |
| LOG-04 | User can export logs as a downloadable file from the UI | GET `/api/logs/export` returns Content-Disposition attachment; JSON or CSV format |
| PERF-01 | Plex stream state updates feel immediate (≤3s lag) | Tautulli webhook re-poll + broadcastSnapshot already wired; tune to trigger on PlaybackStart/Stop/Pause events; 5s fallback poll already in place |
| PERF-02 | No visible polling artifacts (flicker, stale-data flash) at kiosk distance | SSE change-detection hash in sse.ts; skip write when state unchanged; frontend: React key stability (services array sorted by id) |
</phase_requirements>

---

## Summary

Phase 8 delivers three parallel tracks — performance tuning, visual polish, and logging — against a codebase that already has the right architectural foundations in place. The research findings are HIGH confidence because they are grounded in the actual source files read, not assumptions.

**Performance track** is almost entirely wiring work. Pino is installed. The SSE route, PollManager, and Tautulli webhook exist and only need targeted edits. The two concrete interval changes are NAS (3s → 1s) and UniFi (30s → 3s). SSE change detection requires a hash of the meaningful payload fields before every write, with a simple in-memory "last hash sent" variable per connection.

**Logging track** requires: (1) a new `app_logs` Drizzle table + `kv_store` table (for UniFi high-water marks), (2) a pino transport that inserts into `app_logs`, (3) a log API (GET list, POST purge, GET export), (4) a log SSE event from the server, and (5) a full replacement of `LogsPage.tsx`. Node-cron is already installed and used nowhere yet — it is available for the nightly prune job.

**Polish track** is entirely CSS and React component edits. The theme preview page (D-34) must gate all background color changes. The CSS token `--space-deep` in `globals.css` is the single change point for the background. The `.chamfer-card` class is the single change point for the inset shadow. The `.text-display/.text-heading/.text-body` classes in `globals.css` cover all text scale-up. The `body::after` pseudo-element is already claimed by the scanline grid — the sweep bar must be a separate `<div class="crt-sweep">` in App.tsx or the root component.

**Primary recommendation:** Execute in the priority order locked in CONTEXT.md: (1) interval tuning + Plex webhook, (2) download bar removal + layout rescale, (3) log viewer, (4) color/indicator polish. Theme preview gates track (2).

---

## Standard Stack

### Core (all already installed — no new packages required)

| Library | Installed Version | Purpose | Phase 8 Use |
|---------|------------------|---------|-------------|
| pino | 10.3.1 | Structured JSON logger | Custom transport to write to SQLite `app_logs` |
| node-cron | 4.2.1 | Cron scheduler | Nightly 3am log prune job |
| better-sqlite3 | 12.8.0 | SQLite driver | `app_logs` + `kv_store` tables |
| drizzle-orm | 0.45.2 | ORM + migrations | Schema extension for `app_logs`, `kv_store` |
| fastify | 5.8.4 | HTTP server | New log API routes |
| react | 19.2.4 | Frontend | LogsPage replacement |
| framer-motion | 12.38.0 | Animations | Available for log entry entrance if desired |

**No new npm packages needed for Phase 8.** All required tools are installed.

**Installation:** none required.

### Version verification note

Versions read directly from `packages/backend/package.json` and `packages/frontend/package.json` — these are exact installed versions, not training-data guesses.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
packages/backend/src/
├── schema.ts                    # ADD: appLogs table, kvStore table
├── db.ts                        # ADD: initDb() CREATE TABLE IF NOT EXISTS for new tables
├── log-transport.ts             # NEW: pino destination that inserts into app_logs
├── routes/
│   └── logs.ts                  # NEW: GET /api/logs, POST /api/logs/purge, GET /api/logs/export
├── routes/sse.ts                # EDIT: add log-entry event + hash-based change detection
├── routes/tautulli-webhook.ts   # EDIT: extend for PlaybackStart/Stop/Pause re-poll
├── routes/settings.ts           # EDIT: add GET/POST /api/settings/logs-retention
├── adapters/unifi.ts            # EDIT: replace module-level peak vars with kv_store reads
├── poll-manager.ts              # EDIT: NAS=1s, Unifi=3s; add log listener registration
└── index.ts                     # EDIT: register log routes, wire pino transport, start cron

packages/frontend/src/
├── styles/globals.css           # EDIT: text scale, --space-deep token, .chamfer-card shadow, .text-glow, crtSweep keyframe
├── pages/LogsPage.tsx           # REPLACE: full log viewer implementation
├── pages/SettingsPage.tsx       # EDIT: add LOGS tab
├── components/cards/CardGrid.tsx # EDIT: remove download row, redistribute grid
├── components/cards/ServiceCard.tsx # EDIT: inline SABnzbd progress, NAS tile restructure
├── components/layout/AppHeader.tsx  # EDIT: NAS refocus to temps/fans
├── App.tsx                      # EDIT: add .crt-sweep div
└── hooks/useDashboardSSE.ts     # EDIT: add log-entry event listener

theme-preview.html               # NEW: static file at project root (not in src/)
```

### Pattern 1: Pino Custom Transport (log-transport.ts)

**What:** A pino destination stream that captures all log entries at info/warn/error level and inserts them into the `app_logs` SQLite table.

**When to use:** Wire at server startup in `index.ts`. The Fastify instance already uses pino as its logger (`Fastify({ logger: true })`), so all `fastify.log.*()` calls and any `logger.child()` instances automatically flow through this transport.

**Key constraint:** pino's `build()` function creates a writable stream destination. The transport receives serialized log lines as newline-delimited JSON. Parse each line, extract `level`/`msg`/`service` fields, and insert into SQLite. Use `pino-abstract-transport` (NOT a separate npm package — it is bundled with pino 8+) or implement a simple writable stream.

**Simpler alternative (no extra package):** Use pino's `multistream` with a custom writable stream. Write a class extending `stream.Writable` that parses each line and inserts to SQLite synchronously (better-sqlite3 is synchronous — no async needed in the `_write` method).

```typescript
// Source: pino docs — multistream + custom destination
import { createWriteStream } from 'node:stream'
import build from 'pino-abstract-transport'

export function createSqliteTransport(db: AppDb) {
  return build(async function (source) {
    for await (const obj of source) {
      // obj is already parsed (pino-abstract-transport parses JSON lines)
      const level = obj.level  // pino numeric: 30=info, 40=warn, 50=error
      if (level < 30) continue  // skip debug/trace
      const levelStr = level === 30 ? 'info' : level === 40 ? 'warn' : 'error'
      const service = typeof obj.service === 'string' ? obj.service : 'system'
      db.insert(appLogsTable).values({
        timestamp: new Date().toISOString(),
        level: levelStr,
        service,
        message: obj.msg ?? '',
        payload: JSON.stringify(obj),
      }).run()
    }
  })
}
```

**Important:** `pino-abstract-transport` is shipped with pino 8+ and does NOT need a separate install. Verify: `ls node_modules/pino-abstract-transport` — it will be present.

### Pattern 2: SSE Change Detection Hash

**What:** Compute a fast content hash of the meaningful snapshot fields before each SSE write. Skip the write if the hash matches the last-sent hash for that connection.

**Implementation:** JSON.stringify with sorted keys is reliable but ~10ms on large payloads. A better approach: compare a cheap fingerprint derived from the fields that actually change.

```typescript
// In sse.ts — per-connection state
function snapshotFingerprint(snapshot: DashboardSnapshot): string {
  // Exclude timestamp — it always changes even when nothing else does
  return JSON.stringify({
    services: snapshot.services.map(s => ({ id: s.id, status: s.status, lastPollAt: s.lastPollAt })),
    nas: { cpu: snapshot.nas.cpu, ram: snapshot.nas.ram },
    streams: snapshot.streams.map(s => ({ user: s.user, title: s.title, progressPercent: s.progressPercent })),
  })
}

// In the SSE route, per connection:
let lastFingerprint = ''

const send = () => {
  const snapshot = pollManager.getSnapshot()
  const fp = snapshotFingerprint(snapshot)
  if (fp === lastFingerprint) return  // skip — nothing meaningful changed
  lastFingerprint = fp
  reply.raw.write(`event: dashboard-update\ndata: ${JSON.stringify(snapshot)}\n\n`)
}
```

**Confidence:** HIGH — pure TypeScript, no library, aligns with D-03/D-04/D-05.

### Pattern 3: kv_store Table for UniFi High-Water Marks

**What:** A simple key/value SQLite table for persisting rolling maxima across server restarts.

```typescript
// schema.ts addition
export const kvStore = sqliteTable('kv_store', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

**Keys used in Phase 8:**
- `unifi.network.rx_max` — peak RX Mbps observed
- `unifi.network.tx_max` — peak TX Mbps observed
- `unifi.clients_max` — peak client count observed
- `logs.retention_days` — user-configured log retention (or store in service_config with key 'logs')

**Reading on startup:** Load all kv_store rows at `initDb()` time and cache in module-level maps in the unifi adapter. Update immediately when current > stored max.

**Replacing the existing peak reset timer:** The `unifi.ts` adapter currently uses module-level `peakTxMbps`/`peakRxMbps` variables with a `schedulePeakReset()` timeout. Phase 8 replaces this with reads from `kv_store`. The `resetUnifiCache()` function should clear the in-memory cache but NOT delete the kv_store entries (the max should persist across config resets).

### Pattern 4: node-cron for Nightly Log Prune

**What:** Schedule the log purge at 3am local time. node-cron 4.2.1 is already installed.

```typescript
// In index.ts after server starts
import { schedule } from 'node-cron'

schedule('0 3 * * *', () => {
  const retentionDays = getRetentionDays()  // read from kv_store
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  getDb().delete(appLogsTable).where(lt(appLogsTable.timestamp, cutoff)).run()
  fastify.log.info({ service: 'system', msg: 'log_prune_complete', cutoff })
})
```

**Confidence:** HIGH — node-cron API is stable; 5-field cron syntax `'0 3 * * *'` = 3am daily.

### Pattern 5: Log API Routes (logs.ts)

Three endpoints:

```
GET  /api/logs?limit=500&offset=0&level=warn&service=all
     → { entries: LogEntry[], total: number }

POST /api/logs/purge
     body: { olderThanDays: number }
     → { deleted: number }

GET  /api/logs/export?level=all&service=all&format=json
     → Content-Disposition: attachment; filename="coruscant-logs-YYYY-MM-DD.json"
     → JSON array of matching entries
```

**Filtering:** All filtering is done in SQLite with WHERE clauses, not in JavaScript.

### Pattern 6: SSE log-entry Event

**What:** When the pino transport inserts a log entry, emit a `log-entry` SSE event to all connected clients. This avoids polling the log API for the live-tail feature.

**Implementation:** Add a `logEventListeners` array to PollManager (same pattern as `broadcastListeners` and `arrEventListeners`). The pino transport calls `pollManager.emitLogEntry(entry)` after each insert. The SSE route subscribes and writes:

```
event: log-entry
data: {"id":123,"timestamp":"...","level":"warn","service":"nas","message":"..."}
```

**Alternative (simpler):** If not adding to PollManager, emit via a separate EventEmitter singleton (`logEvents`) imported by both the transport and the SSE route. This avoids coupling log transport to PollManager.

**Recommendation:** Use a separate `logEvents` EventEmitter. PollManager is already complex enough.

```typescript
// log-events.ts — singleton EventEmitter
import { EventEmitter } from 'node:events'
export const logEvents = new EventEmitter()
logEvents.setMaxListeners(50)  // many SSE connections
```

### Pattern 7: Theme Preview Page

**What:** Static HTML file at project root (or served by Vite dev server at `/theme-preview.html`). Three side-by-side column divs, no React, no build step.

**Key constraint:** The `body::after` pseudo-element is already occupied by the scanline grid CSS. When implementing the sweep in the main app, it must be a real DOM element. In `App.tsx`, add a `<div className="crt-sweep" aria-hidden="true" />` as the first child of the root fragment.

### Anti-Patterns to Avoid

- **Calling `JSON.stringify(snapshot)` for the full snapshot fingerprint** — the `timestamp` field always differs, defeating the change-detection purpose. Only hash the meaningful fields.
- **Writing pino transport as a synchronous blocking loop inside the pino `write()` method** — better-sqlite3 is synchronous so direct `.run()` calls are fine, but don't use async `await` inside a sync writable `_write` — use the callback pattern.
- **Storing log retention in `service_config`** — `service_config` uses `serviceName` as primary key and has service-specific columns. Use `kv_store` with key `logs.retention_days` instead.
- **Relying on UniFi module-level peak variables across server restarts** — they reset to 0 on every container restart, causing the bar to start full then expand unpredictably. The `kv_store` persistence fixes this.
- **Using `innerHTML` or `dangerouslySetInnerHTML` in LogsPage for log messages** — log messages may contain user-controlled strings from arr titles etc. Use text content only.
- **Auto-scrolling the log viewer to top on every new entry when user has scrolled down** — check scroll position before auto-scrolling; if `scrollTop > threshold`, add silently.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pino → SQLite routing | Custom log interceptor monkey-patching fastify | pino-abstract-transport (bundled with pino) | Proper lifecycle, error handling, async iteration |
| Cron scheduling | Custom setInterval with date math | node-cron (already installed) | Already handles timezone, DST, process restart edge cases |
| SSE change detection | SHA-256 hash library | JSON.stringify of meaningful fields (pure JS) | No dependency needed; fingerprint is fast enough at 1-3s intervals |
| Log table pagination | In-memory log array | SQLite LIMIT/OFFSET queries | Only loads needed rows; bounded memory |
| Log export file generation | Client-side Blob construction from full log history | Server-side GET endpoint streaming filtered rows | Server controls what is exported; no memory spike from loading all 7 days into browser |

---

## Common Pitfalls

### Pitfall 1: NAS 1s interval flooding the SSE connection

**What goes wrong:** NAS polls at 1s. Each poll calls `broadcastSnapshot()`. Without change detection, this sends 1 SSE message per second to every connected client. On a dashboard with 1 client this is fine. On multiple tabs it multiplies. More importantly, the frontend re-renders on every message even if NAS CPU/RAM didn't meaningfully change.

**Why it happens:** `broadcastSnapshot()` in PollManager is called inside the NAS poll handler (`this.broadcastSnapshot()` at line 338 of poll-manager.ts) unconditionally.

**How to avoid:** Implement D-03/D-04 SSE fingerprint check. The fingerprint check in `sse.ts`'s `send()` function gates the write. `broadcastSnapshot()` still fires — the SSE route's `send()` just does nothing if state hasn't changed. This is the correct layering.

**Warning signs:** If browser DevTools Network tab shows SSE messages arriving every 1 second even when dashboard is idle, change detection is not working.

### Pitfall 2: pino-abstract-transport module resolution

**What goes wrong:** `import build from 'pino-abstract-transport'` throws "Cannot find module 'pino-abstract-transport'" even though pino is installed.

**Why it happens:** pino-abstract-transport is a dependency of pino but Node.js ESM module resolution doesn't automatically expose sub-package dependencies. It may need to be explicitly referenced as `pino/lib/transport.js` or installed as a direct dependency.

**How to avoid:** Check with `ls node_modules/pino-abstract-transport` before assuming it's available as a named import. If not directly resolvable, use the simpler writable stream pattern instead (no pino-abstract-transport needed — implement a `stream.Writable` subclass that receives JSON-serialized log lines and parses/inserts them).

**Alternative pattern (no extra import):**
```typescript
import { Writable } from 'node:stream'
class SqliteLogStream extends Writable {
  _write(chunk: Buffer, _enc: string, cb: () => void) {
    try {
      const line = chunk.toString().trim()
      if (!line) { cb(); return }
      const obj = JSON.parse(line) as Record<string, unknown>
      // insert to app_logs...
    } catch { /* malformed line — skip */ }
    cb()
  }
}
// Usage: Fastify({ logger: { stream: new SqliteLogStream(db) } })
```

**Confidence:** HIGH — writable stream pattern is Node.js core, no extra dependencies.

### Pitfall 3: kv_store table bootstrap timing

**What goes wrong:** The UniFi adapter tries to read from `kv_store` at startup but the table hasn't been created yet (because `initDb()` only creates tables listed in its `CREATE TABLE IF NOT EXISTS` block).

**How to avoid:** Add `kv_store` and `app_logs` to the `initDb()` function in `db.ts` (same pattern as existing tables). The current `initDb()` uses raw SQL strings — add the new tables there. Also add them to `schema.ts` for Drizzle type generation.

**Warning signs:** `no such table: kv_store` errors on first container start.

### Pitfall 4: LogsPage SSE connection duplication

**What goes wrong:** LogsPage.tsx subscribes to a new EventSource for `log-entry` events while App.tsx already has an EventSource on `/api/sse`. If LogsPage opens its own `/api/sse` connection, the browser has two simultaneous SSE connections.

**How to avoid:** Extend the existing SSE connection in `useDashboardSSE.ts` to also listen for `log-entry` events. Return `lastLogEntry` from the hook. Pass it to LogsPage as a prop (same pattern as `snapshot` and `lastArrEvent`).

Alternatively: emit `log-entry` on the same `/api/sse` stream (it already multiplexes `dashboard-update` and `arr-event`). This is the correct approach — add `log-entry` as a third named event on the same stream.

### Pitfall 5: Download bar removal breaking the grid layout

**What goes wrong:** `CardGrid.tsx` currently renders a `gridColumn: '1 / -1'` full-width row for SABnzbd (lines 98-109). Removing it leaves a gap. If tiles aren't growing to fill the freed space, the dashboard looks half-empty.

**How to avoid:** After removing the dedicated DOWNLOADS row, ensure the grid rows redistribute. The grid currently uses `alignItems: 'start'` — change to `alignItems: 'stretch'` with explicit `gridAutoRows: '1fr'` or use a fixed height container for the dashboard and let inner tiles use `height: 100%`. The freed ~120px should go to the MEDIA tile and the Pi-hole/NETWORK tile.

**Warning signs:** At 800x480, if there is empty space below the tiles that wasn't there before, the height redistribution hasn't been applied.

### Pitfall 6: NAS tile restructure breaking the AppHeader

**What goes wrong:** D-21 requires NAS to become a standalone tile with an amber ribbon header. Currently NAS data is in `AppHeader` and the `NasInstrument` component renders inside the header. Moving NAS out of the header requires the header to no longer receive `nas` as a prop (or to receive a stripped version for temps/fans only).

**How to avoid:** Read AppHeader.tsx carefully (it's in `packages/frontend/src/components/cards/AppHeader.tsx`, not `layout/`). Plan the prop change explicitly. The AppHeader `nas` prop currently drives both the NAS gauge strip AND is used to derive `nasConfigured`. After D-21, the header shows only temps/fans; the NAS CPU/RAM gauges move to the new standalone tile. The `nasConfigured` derivation in `App.tsx` uses `snapshot.services.find(s => s.id === 'nas')?.configured !== false` — this is independent of the NAS prop and requires no change.

### Pitfall 7: Log entry flood during high-activity periods

**What goes wrong:** At 1s NAS polls + 3s UniFi polls + 5s arr polls, the pino transport could insert hundreds of entries per minute. At 7-day retention, this accumulates to thousands of rows and grows the SQLite file unboundedly within the retention window.

**How to avoid:** D-25 already limits capture to `info/warn/error` (no debug/trace). Additionally, poll success events should be logged at `debug` level so they are filtered. Only meaningful events (errors, state changes, webhook receipts) should log at `info` or above. The nightly prune handles the 7-day bound. Document the log level convention for adapters.

---

## Code Examples

### app_logs Drizzle Schema
```typescript
// Source: schema.ts extension, Drizzle docs pattern
export const appLogs = sqliteTable('app_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),   // ISO 8601
  level: text('level').notNull(),           // 'info' | 'warn' | 'error'
  service: text('service').notNull(),       // 'nas' | 'plex' | 'system' etc.
  message: text('message').notNull(),
  payload: text('payload'),                 // JSON string of full log object, nullable
})
```

### kv_store Drizzle Schema
```typescript
export const kvStore = sqliteTable('kv_store', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

### initDb() additions
```typescript
// In the raw SQL block in db.ts initDb()
_sqlite.exec(`
  CREATE TABLE IF NOT EXISTS app_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    service TEXT NOT NULL DEFAULT 'system',
    message TEXT NOT NULL,
    payload TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
  CREATE INDEX IF NOT EXISTS idx_app_logs_service ON app_logs(service);

  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)
```

**Indexes are important** for log queries — timestamp (range scans for purge/export), level (filter), service (filter).

### UniFi kv_store high-water mark update
```typescript
// In unifi adapter — replace module-level peakTxMbps/peakRxMbps pattern
function updateHighWaterMark(db: AppDb, key: string, current: number): number {
  const row = db.select().from(kvStore).where(eq(kvStore.key, key)).get()
  const stored = row ? parseFloat(row.value) : 0
  if (current > stored) {
    db.insert(kvStore).values({ key, value: String(current), updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: kvStore.key, set: { value: String(current), updatedAt: new Date().toISOString() } })
      .run()
    return current
  }
  return stored
}
```

### CSS .text-glow utility
```css
/* In globals.css */
.text-glow {
  text-shadow: 0 0 6px currentColor;
}
```

### CSS crtSweep keyframe + class
```css
/* In globals.css */
@keyframes crtSweep {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
```

```css
/* .crt-sweep is applied as a <div> in App.tsx — NOT body::after (already used) */
.crt-sweep {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(transparent, rgba(255,255,255,0.025), transparent);
  animation: crtSweep 10s linear infinite;
  pointer-events: none;
  z-index: 10000;
}
```

### Tautulli webhook Plex re-poll extension
```typescript
// In tautulli-webhook.ts — detect PlaybackStart/Stop/Pause and trigger immediate re-poll
// D-06: on these events, immediately re-poll PMS /status/sessions
const IMMEDIATE_REPOLL_EVENTS = new Set([
  'playback.start', 'play', 'on_play',
  'playback.stop', 'stop', 'on_stop', 'watched',
  'playback.pause', 'pause', 'on_pause',
])

if (IMMEDIATE_REPOLL_EVENTS.has(event.toLowerCase())) {
  // Trigger immediate Plex re-poll via PollManager
  pollManager.triggerPlexRepoll()
}
```

The `triggerPlexRepoll()` method fetches PMS sessions directly and calls `updatePlexState()` + `broadcastSnapshot()`.

### NAS bar color helper
```typescript
// In a shared utility or inline in ServiceCard.tsx
function getBarColor(percent: number): string {
  if (percent > 85) return '#FF3B3B'   // --cockpit-red
  if (percent > 60) return '#E8A020'   // --cockpit-amber
  return '#4ADE80'                      // --cockpit-green
}
```

### UniFi arrow tier
```typescript
function getArrowTier(mbps: number | null): string {
  if (mbps === null || mbps < 0.1) return ''
  if (mbps < 10) return '↓'
  if (mbps < 100) return '↓↓'
  return '↓↓↓'
}
// TX uses ↑/↑↑/↑↑↑ with same thresholds
```

---

## State of the Art

| Old Approach | Current Approach | Phase 8 Change | Impact |
|--------------|------------------|----------------|--------|
| `NAS_INTERVAL_MS = 3_000` | Keep as 3s | Change to **1_000ms** | NAS bars animate as live meters |
| `UNIFI_INTERVAL_MS = 30_000` | Keep as 30s | Change to **3_000ms** | UniFi bars feel like live meters |
| UniFi module-level peak vars (6h reset timer) | Reset timer on schedulePeakReset() | **kv_store rolling high-water mark** | Survives restarts; no jarring resets |
| LogsPage.tsx stub ("coming in Phase 7") | Stub | **Full live-tail viewer** | Satisfies LOG-01 through LOG-04 |
| SSE broadcasts every 5s unconditionally | 5s interval | **Hash-gated write** | Eliminates stale-data flash (PERF-02) |
| `console.log(JSON.stringify(...))` in handleArrEvent | Works but not structured | **Pino transport captures automatically** | Phase 7 D-03 fulfilled |

---

## Open Questions

1. **pino-abstract-transport availability**
   - What we know: `pino` 10.3.1 is installed; pino-abstract-transport is a pino dependency
   - What's unclear: Whether it is importable as `pino-abstract-transport` in the project's ESM context without adding it to package.json explicitly
   - Recommendation: Planner should include a task in Wave 0 to verify `import build from 'pino-abstract-transport'` resolves. If not, fall back to the `Writable` stream pattern (documented above) — this is a drop-in alternative that requires no new package.

2. **NAS tile restructure scope**
   - What we know: D-21 says NAS becomes a standalone tile with amber ribbon header; AppHeader refocuses on temps/fans
   - What's unclear: Whether the existing `NasInstrument` component (inside AppHeader) is cleanly separable from AppHeader, or whether it is tightly coupled
   - Recommendation: Executor reads `AppHeader.tsx` fully before starting D-21 work. The AppHeader.tsx file was not fully loaded in research (only 80 lines read). The planner should note this as a pre-task read.

3. **LogsPage prop threading**
   - What we know: `useDashboardSSE` hook in App.tsx feeds all sub-pages via props; LogsPage is currently in the Routes but receives no props
   - What's unclear: Whether to add `log-entry` SSE event to the existing `/api/sse` stream (recommended) or create a separate `/api/logs/stream` endpoint
   - Recommendation: Add `log-entry` as a third named event on `/api/sse`. Extend `useDashboardSSE` to return `lastLogEntry`. Pass it to `<LogsPage>`. This matches the established pattern for `arr-event`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is code/config-only changes within the existing Docker stack. No new external services, CLI tools, or runtimes are introduced. All dependencies are already installed packages.

---

## Validation Architecture

**Config:** `workflow.nyquist_validation: true` in `.planning/config.json` — validation section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (via root vitest.config.ts) |
| Config file | `/Users/Oreo/Projects/Coruscant/vitest.config.ts` |
| Quick run command | `npm test` (from project root — runs `vitest run`) |
| Full suite command | `npm test` |
| Test directory | `packages/backend/src/__tests__/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOG-01 | Pino transport inserts log entries to `app_logs` table | unit | `npm test -- --reporter=verbose` (log-transport.test.ts) | ❌ Wave 0 |
| LOG-02 | GET /api/logs returns paginated entries; log-entry SSE event fires | unit | `npm test` (logs.test.ts) | ❌ Wave 0 |
| LOG-03 | POST /api/logs/purge deletes entries older than N days | unit | `npm test` (logs.test.ts) | ❌ Wave 0 |
| LOG-04 | GET /api/logs/export returns JSON attachment with Content-Disposition | unit | `npm test` (logs.test.ts) | ❌ Wave 0 |
| PERF-01 | Tautulli webhook triggers immediate re-poll + broadcastSnapshot | unit | `npm test` (tautulli-webhook.test.ts — extend existing) | ✅ exists |
| PERF-02 | SSE sends no event when snapshot fingerprint unchanged | unit | `npm test` (sse.test.ts — extend existing) | ✅ exists |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/backend/src/__tests__/log-transport.test.ts` — covers LOG-01 (pino transport inserts to SQLite)
- [ ] `packages/backend/src/__tests__/logs.test.ts` — covers LOG-02, LOG-03, LOG-04 (log API routes)

*(Existing `sse.test.ts` and `tautulli-webhook.test.ts` cover PERF-01 and PERF-02 after extension — no new files needed for those.)*

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are binding on the planner:

| Directive | Impact on Phase 8 |
|-----------|-------------------|
| Must run in Docker Compose on Synology NAS (ARM64) | No new packages that break ARM64; all new packages are pure JS (no native binaries) |
| `node:22-slim` base image (NOT Alpine) | No change — existing Dockerfile unchanged in Phase 8 |
| All data stays local — no cloud telemetry | Log data stays in SQLite; export is user-initiated download; no external calls |
| GSD workflow enforcement — no direct repo edits outside GSD commands | Planning artifacts must be created before execution |
| Stack: Node.js 22 + TypeScript + Fastify + React + Vite + SQLite (better-sqlite3) + SSE | All Phase 8 work uses this exact stack; no deviations |
| Drizzle ORM for all DB access | `app_logs` and `kv_store` tables must have Drizzle schema definitions in `schema.ts` |
| Avoid Redux/Zustand for server state | Log entries flow via SSE + React state in useDashboardSSE hook — no state management library |
| No PM2 inside Docker | Not applicable to Phase 8 |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `packages/backend/src/poll-manager.ts` — current interval constants, broadcastSnapshot pattern
- Direct codebase read: `packages/backend/src/routes/sse.ts` — current SSE implementation, broadcast subscription
- Direct codebase read: `packages/backend/src/routes/tautulli-webhook.ts` — webhook pattern to extend
- Direct codebase read: `packages/backend/src/db.ts` — initDb pattern, WAL mode confirmed
- Direct codebase read: `packages/backend/src/schema.ts` — current Drizzle schema; tables to extend
- Direct codebase read: `packages/backend/package.json` — pino 10.3.1, node-cron 4.2.1 installed
- Direct codebase read: `packages/frontend/src/styles/globals.css` — `body::after` already used; text classes; `--space-deep` token
- Direct codebase read: `packages/frontend/src/pages/LogsPage.tsx` — stub confirmed; no existing implementation
- Direct codebase read: `packages/frontend/src/App.tsx` — SSE hook location, route structure
- Direct codebase read: `packages/frontend/src/pages/SettingsPage.tsx` — tab pattern (SERVICES / NOTIFICATIONS) to extend with LOGS
- Direct codebase read: `packages/frontend/src/hooks/useDashboardSSE.ts` — arr-event pattern to replicate for log-entry
- Direct codebase read: `packages/backend/src/adapters/unifi.ts` — existing peak vars + schedulePeakReset() to replace

### Secondary (MEDIUM confidence)
- pino-abstract-transport: bundled with pino 8+ — verified by pino's official documentation pattern; exact import path in this project's ESM context is flagged as an open question

### Tertiary (LOW confidence)
- None — all claims in this document are grounded in the actual codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from package.json files; no guessing
- Architecture: HIGH — patterns derived from existing codebase structure; no assumptions about unknown APIs
- Pitfalls: HIGH — derived from reading actual code (e.g., `body::after` already used, UniFi peak vars exist at module level, LogsPage has no SSE connection)
- CSS changes: HIGH — all tokens and classes read from globals.css; no guesswork

**Research date:** 2026-04-06
**Valid until:** Phase execution (codebase snapshot; valid as long as no other phase modifies poll-manager, sse.ts, or unifi adapter before Phase 8 executes)
