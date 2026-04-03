# Phase 3: Settings + First Service Adapters — Research

**Researched:** 2026-04-03
**Domain:** Service adapter polling, AES-256-GCM credential encryption, Drizzle ORM migrations, Fastify REST routes, React tabbed settings UI
**Confidence:** HIGH (core patterns), MEDIUM (external API response shapes)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Settings Page Layout**
- D-01: Tabbed layout — horizontal tab bar listing RADARR, SONARR, LIDARR, BAZARR, PROWLARR, READARR, SABNZBD
- D-02: Tab bar overflows horizontally with horizontal scroll; no wrapping or dropdown fallback
- D-03: Each tab shows a status LED (same cockpit LED design as dashboard cards) — green/red/amber/grey per service live state
- D-04: Each service panel: URL field, API key field (password-masked), eye icon toggle, TEST button, inline result line, SAVE button
- D-05: Save is per-tab — each service SAVE only saves that service's config
- D-06: After save, backend's next poll cycle picks up new credentials and pushes real data over SSE — no page refresh or restart
- D-07: LED intensity slider from Phase 2 stub is REMOVED

**API Key Field**
- D-08: API key inputs use `type="password"` — masked on screen
- D-09: Eye icon toggle switches between `type="password"` and `type="text"`
- D-10: API keys stored encrypted in SQLite using AES-256-GCM (node:crypto built-in). Encryption key seed lives in `.env`

**Test Connection**
- D-11: TEST button makes an immediate live request to `/api/v3/health` (arr) or equivalent (SABnzbd queue check)
- D-12: During in-flight request: TEST button disabled, shows `TESTING…` label
- D-13: Result inline below TEST button:
  - Success: `● CONNECTED  v3 · N warnings` (green LED dot)
  - Failure: `● FAILED: [error message]` (red LED dot — "timeout", "401 Unauthorized", "ECONNREFUSED")
- D-14: Inline result clears when user edits either field

**Color Semantics (locked for all Phase 3 service cards)**
- Green (`#4ADE80`) — service up and healthy; no action needed
- Red (`#FF3B3B`) — service down, offline, unreachable, timeout, or any connection failure including 401/403
- Amber (`#E8A020`) — service reachable but user action required (arr health warnings)
- Purple (`#9B59B6` or equivalent) — active downloading (SABnzbd only)
- Grey (`#666666`) — service not configured yet; no credentials saved
- Amber is STRICTLY for "user must do something" — never for connection failures

**Unconfigured Card State**
- D-15: No-credentials card renders as normal instrument panel card with static grey LED and dim `NOT CONFIGURED` label in instrument body
- D-16: Tapping a NOT CONFIGURED card deep-links to Settings with that service's tab pre-selected (e.g., `/settings?service=radarr`)

**SSE Data Pipeline Transition**
- D-17: `generateMockSnapshot` is RETIRED. SSE route switches to real poll data
- D-18: Unconfigured services use `status: 'stale'` with additional `configured: false` flag in ServiceStatus entry. No mock data bleeds through
- D-19: Configured services that fail to respond immediately show red/offline on next SSE push. No amber intermediate for connection failures
- D-20: Poll intervals: arr services 30–60s (SVCST-05); SABnzbd 5–15s (SVCACT-03). Exact values within those ranges are Claude's discretion

### Claude's Discretion
- Exact Drizzle schema shape for service configurations
- Encryption IV/tag storage approach within SQLite
- Exact poll interval values within spec ranges (30–60s arr, 5–15s SABnzbd)
- Shared base adapter pattern for arr services
- Exact `ServiceStatus.metrics` shape for SABnzbd
- Whether metrics shape is typed in `packages/shared` or stays `Record<string, unknown>`
- Backend API route(s) for saving service config and triggering test connection
- React Router URL strategy for Settings deep-link (`/settings?service=radarr` or `/settings/radarr`)

### Deferred Ideas (OUT OF SCOPE)
- **Arr UI Grouping:** All six arr services will eventually be collapsed into a grouped/sectioned display. Deferred to a future UI phase. Phase 3 adds them as individual cards.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFG-01 | Settings page lets user configure base URL and API key for each service | Settings page architecture, Fastify CRUD routes, Drizzle schema section |
| CFG-03 | All settings persisted to SQLite and survive app restarts and container restarts | Drizzle schema + migrations section, encryption-at-rest pattern |
| CFG-04 | Each service config has a "Test Connection" action that validates URL and credentials live | Test-connection route pattern, arr health endpoint and SABnzbd queue API sections |
| SVCST-01 | Radarr card shows up/down health state (green=online, red=unreachable, amber=health warnings) | Arr adapter pattern, /api/v3/health response shape |
| SVCST-02 | Sonarr card shows up/down health state | Same as SVCST-01 |
| SVCST-03 | Lidarr card shows up/down health state | Same as SVCST-01 |
| SVCST-04 | Bazarr card shows up/down health state | Bazarr API section — note: uses /api/webhooks pattern, not /api/v3/health |
| SVCST-05 | Status-tier services poll /api/v3/health every 30–60 seconds | Polling architecture, node-cron section |
| SVCACT-01 | SABnzbd card shows up/down status, current speed, active queue count, animated progress bars | SABnzbd API section, metrics shape |
| SVCACT-02 | SABnzbd card displays amber error state when queue items have failed status | SABnzbd slot.status field — check for "Failed" value |
| SVCACT-03 | SABnzbd polls at 5–15 second intervals | Polling architecture section |
</phase_requirements>

---

## Summary

Phase 3 has four interlocking concerns: (1) persisting encrypted service credentials to SQLite, (2) building the Settings UI that reads and writes those credentials, (3) replacing the mock SSE generator with real poll-based adapters for seven services, and (4) surfacing live state on dashboard cards and Settings tab LEDs. The work is predominantly backend — new Drizzle schema + migration, AES-256-GCM encryption helpers, a poll aggregator, Fastify REST routes — with a self-contained Settings page on the frontend.

The key architectural insight is the **poll manager**: a singleton that holds one interval per configured service. When credentials are saved via the Settings API, the poll manager hot-reloads that service's adapter without restarting the server or the SSE connection. The SSE route already exists and just needs to be wired to the poll manager's latest snapshot instead of the mock generator.

**One finding that needs a decision:** Readarr is officially retired as of late 2024. The CONTEXT.md includes it in Phase 3 scope. The software still runs and its API still works; "retired" means no future development or support. This research recommends treating Readarr identically to the other arr services — same adapter pattern, same `/api/v3/health` endpoint — and documenting its retired status as a user-facing note in the Settings tab label. The planner should not descope it; the user explicitly included it in D-01.

**Primary recommendation:** Implement a `PollManager` class (singleton) with `Map<serviceId, NodeJS.Timeout>` for intervals. Each service adapter is a pure function `(config: ServiceConfig) => Promise<ServiceStatus>`. The Settings SAVE endpoint upserts the DB row, decrypts to verify, then calls `pollManager.reload(serviceId)` which clears the old interval and starts a fresh one with the new credentials.

---

## Standard Stack

### Core (already installed — verify before adding)

| Library | Installed Version | Purpose | Notes |
|---------|------------------|---------|-------|
| `drizzle-orm` | 0.45.2 | SQLite schema + queries | Already in use; migrations infrastructure wired via `drizzle-kit` |
| `drizzle-kit` | 0.31.10 | Schema diffing and migration generation | Already devDependency; `drizzle.config.ts` points to `./drizzle` out dir |
| `better-sqlite3` | 12.8.0 | SQLite driver | Already installed; WAL mode + synchronous=normal already set in `createDb()` |
| `fastify` | 5.8.4 | API server | Already installed; note: **Fastify v5** is the installed version |
| `node:crypto` | built-in | AES-256-GCM encryption | No install needed; part of Node.js 22 stdlib |

### New Dependencies to Install

| Library | Current Version | Purpose | Why |
|---------|----------------|---------|-----|
| `axios` | 1.14.0 | HTTP client for service polling | Timeout config, interceptors for self-signed certs (Ubiquiti/NAS gear), already specified in CLAUDE.md |
| `node-cron` | 4.2.1 | Poll interval scheduler | Cron-style interval scheduling with `.stop()` / `.start()` lifecycle; clean API for hot-reload on config change |

**Installation:**
```bash
npm install axios node-cron --workspace=packages/backend
npm install @types/node-cron --workspace=packages/backend --save-dev
```

**Version verification (confirmed 2026-04-03):**
- `axios@1.14.0` — latest at time of research
- `node-cron@4.2.1` — latest at time of research

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node-cron` | `setInterval` directly | setInterval is simpler for fixed intervals and works fine here; node-cron adds cron-string syntax which isn't needed, but `.stop()/.start()` lifecycle is cleaner for the hot-reload pattern. Either works. |
| `axios` | built-in `fetch` | Node 22 has native fetch; axios adds timeout config via `httpsAgent` and self-signed cert bypass more ergonomically. Use axios per CLAUDE.md recommendation. |

---

## Architecture Patterns

### Recommended File Structure (new files only — existing structure unchanged)

```
packages/backend/src/
├── crypto.ts              # AES-256-GCM encrypt/decrypt helpers (uses node:crypto)
├── poll-manager.ts        # PollManager singleton — Map<serviceId, timer>
├── adapters/
│   ├── arr.ts             # Shared arr adapter (Radarr/Sonarr/Lidarr/Prowlarr/Readarr)
│   ├── bazarr.ts          # Bazarr adapter (different API shape)
│   └── sabnzbd.ts         # SABnzbd adapter
├── routes/
│   ├── settings.ts        # POST /api/settings/:serviceId, GET /api/settings/:serviceId
│   └── test-connection.ts # POST /api/test-connection/:serviceId
├── schema.ts              # Add serviceConfig table (Phase 3 migration)
└── routes/sse.ts          # Refactor: replace generateMockSnapshot() with pollManager.getSnapshot()

packages/frontend/src/
├── pages/SettingsPage.tsx # Full implementation (replaces stub)
└── components/cards/ServiceCard.tsx  # Add NOT_CONFIGURED render branch
```

### Pattern 1: AES-256-GCM Credential Encryption

**What:** Encrypt API key string before writing to SQLite; decrypt on read. IV is unique per write; IV + auth tag stored alongside ciphertext as a single delimited string in one TEXT column.

**When to use:** Every write to `serviceConfig.encryptedApiKey`. Every read that needs to call a service.

**Key derivation:** The `.env` `ENCRYPTION_KEY_SEED` is a hex string. Derive a 32-byte key with `crypto.createHash('sha256').update(seed).digest()` — deterministic, no extra state.

**Storage layout (single TEXT column):** `iv_hex:tag_hex:ciphertext_hex` — colon-delimited, all hex. Avoids separate columns; fully self-contained per row. IV is 12 bytes (96 bits) for GCM as required by NIST SP 800-38D.

```typescript
// Source: Node.js docs (nodejs.org/api/crypto.html) + NIST GCM IV guidance
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12  // 96 bits — NIST recommended for GCM

function deriveKey(seed: string): Buffer {
  return createHash('sha256').update(seed).digest()
}

export function encrypt(plaintext: string, seed: string): string {
  const key = deriveKey(seed)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()  // 16 bytes
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(stored: string, seed: string): string {
  const [ivHex, tagHex, ctHex] = stored.split(':')
  const key = deriveKey(seed)
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
```

### Pattern 2: Drizzle Schema — `serviceConfig` Table

**What:** One row per service. Columns: `serviceName` (PK), `baseUrl`, `encryptedApiKey`, `enabled`, `updatedAt`.

```typescript
// Add to packages/backend/src/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const serviceConfig = sqliteTable('service_config', {
  serviceName: text('service_name').primaryKey(),  // 'radarr', 'sonarr', etc.
  baseUrl: text('base_url').notNull().default(''),
  encryptedApiKey: text('encrypted_api_key').notNull().default(''),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
})
```

**Migration:** After adding the table to `schema.ts`, run `npx drizzle-kit generate` to produce a new SQL migration file in `./drizzle/`. The existing `initDb()` call at server startup runs `migrate()` which applies pending migrations automatically.

**Drizzle config (`drizzle.config.ts`)** is already correct — points to `./packages/backend/src/schema.ts` and `./drizzle` output.

### Pattern 3: Poll Manager (Hot-Reload on Config Save)

**What:** Singleton module that owns all poll intervals. The SSE route calls `pollManager.getSnapshot()` to build `DashboardSnapshot`.

**Key insight:** When SAVE is called, the manager clears the existing interval for that serviceId and starts a new one — no server restart needed (D-06).

```typescript
// packages/backend/src/poll-manager.ts (structural sketch)
export class PollManager {
  private timers = new Map<string, NodeJS.Timeout>()
  private state = new Map<string, ServiceStatus>()

  async reload(serviceId: string, config: ServiceConfig | null) {
    this.clearTimer(serviceId)
    if (!config?.baseUrl || !config?.apiKey) {
      this.state.set(serviceId, unconfiguredStatus(serviceId))
      return
    }
    // Immediate first poll, then interval
    await this.poll(serviceId, config)
    const intervalMs = POLL_INTERVALS[serviceId]
    this.timers.set(serviceId, setInterval(() => this.poll(serviceId, config), intervalMs))
  }

  getSnapshot(): DashboardSnapshot { ... }
}
```

**Poll intervals (recommendation within spec ranges):**
- Arr services (Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, Readarr): **45 seconds** (within 30–60s range)
- SABnzbd: **10 seconds** (within 5–15s range)

### Pattern 4: Arr Service Adapter

**Shared for:** Radarr, Sonarr, Lidarr, Prowlarr, Readarr all use the same `/api/v3/health` endpoint with `X-Api-Key` header. One shared adapter function parameterised by service config.

**API auth:** Pass API key as HTTP header `X-Api-Key: <key>`. Query param `apikey=<key>` also works but header is preferred.

**Health endpoint:** `GET {baseUrl}/api/v3/health`

**Response:** Array of `HealthResource` objects. If the array is empty → green (healthy). If any items exist → amber (user action required). Non-2xx or network error → red (offline).

```typescript
// HealthResource shape (from Radarr source: NzbDrone.Core/HealthCheck/HealthCheck.cs)
interface HealthResource {
  source: string      // name of the check that fired
  type: 'Ok' | 'Notice' | 'Warning' | 'Error'   // HealthCheckResult enum
  message: string     // human-readable description
  wikiUrl: string     // link to wiki article
}
```

**Status mapping:**
- HTTP error / timeout / ECONNREFUSED → `status: 'offline'` (red)
- HTTP 401/403 → `status: 'offline'` (red) — bad credentials counts as "connection failure" per D-19
- 200, empty array → `status: 'online'` (green)
- 200, array with `type: 'Warning'` or `type: 'Error'` items → `status: 'warning'` (amber)
- 200, array with only `type: 'Ok'` or `type: 'Notice'` items → `status: 'online'` (green)

**Readarr note:** Readarr is officially retired (confirmed 2026). Existing installations still run and the API is functional. Treat identically to other arr services — same adapter, same endpoint. The user explicitly included it in scope (D-01). Planner should add a visible `[RETIRED]` annotation to the Readarr tab label in the Settings UI.

### Pattern 5: Bazarr Adapter

**Different from arr:** Bazarr does NOT have `/api/v3/health`. Bazarr has its own API under `/api/` (no version prefix). The most reliable liveness check is `GET {baseUrl}/api/system/status` with API key as query param `?apikey=<key>`.

**Auth:** API key passed as query parameter `?apikey=<key>` (Bazarr convention, confirmed from GitHub issue research).

**Health check endpoint:** `GET {baseUrl}/api/system/status?apikey={key}`

**Status mapping:**
- 2xx response → `status: 'online'`
- 4xx/5xx/timeout → `status: 'offline'`
- Bazarr has no health-warning array equivalent — it is always green or red, never amber

### Pattern 6: SABnzbd Adapter

**API:** `GET {baseUrl}/api?mode=queue&output=json&apikey={key}`

**Auth:** API key passed as query parameter `?apikey=<key>`.

**Key response fields from `queue` object:**
- `status`: string — `"Downloading"`, `"Paused"`, `"Idle"`, etc.
- `speed`: string — e.g., `"1.2 MB"` (per-second, confusingly labelled)
- `kbpersec`: string — numeric KB/s as string — parse to number and divide by 1024 for MB/s
- `noofslots`: integer — total items in queue
- `slots`: array — individual job objects; each has `status` field

**Individual slot `status` values that indicate failure:** `"Failed"` — this triggers `status: 'warning'` (amber) per SVCACT-02.

**Purple state:** When `status === "Downloading"` and `noofslots > 0` → show purple (active download).

**SABnzbd metrics shape for `ServiceStatus.metrics`:**
```typescript
{
  speedMBs: number,          // kbpersec / 1024
  queueCount: number,        // noofslots
  progressPercent: number,   // derived from first active slot if present, else 0
  hasFailedItems: boolean,   // any slot.status === 'Failed'
  sabStatus: string,         // raw queue.status for debugging
}
```

### Pattern 7: Settings Page Tab Deep-Link

**URL strategy (recommendation):** Use query param `/settings?service=radarr` rather than path param `/settings/radarr`. The route stays `/settings` in `App.tsx`, and React Router's `useSearchParams` reads the active tab. This avoids adding a nested route and keeps the Settings route simple.

```typescript
// In SettingsPage.tsx
import { useSearchParams } from 'react-router-dom'

const [searchParams, setSearchParams] = useSearchParams()
const activeTab = searchParams.get('service') ?? 'radarr'

const selectTab = (id: string) => setSearchParams({ service: id })
```

**Deep-link from ServiceCard (NOT CONFIGURED):** `navigate('/settings?service=radarr')` — works with the existing `useNavigate` pattern already in `ServiceCard.tsx`.

### Pattern 8: Fastify v5 Route Registration

**Note:** The installed version is Fastify **v5** (5.8.4), not v4. Fastify v5 dropped some legacy APIs. Key difference relevant to this phase: v5 requires `@fastify/sensible` for HTTP error helpers if used, and the body-parsing for JSON POST bodies is built-in by default.

**Settings CRUD routes:**
```typescript
// POST /api/settings/:serviceId — upsert config
fastify.post<{ Params: { serviceId: string }; Body: { baseUrl: string; apiKey: string } }>(
  '/api/settings/:serviceId',
  async (request, reply) => { ... }
)

// GET /api/settings/:serviceId — read config (return baseUrl only, never return apiKey plaintext)
fastify.get<{ Params: { serviceId: string } }>(
  '/api/settings/:serviceId',
  async (request, reply) => { ... }
)

// POST /api/test-connection/:serviceId — immediate live test with body payload
fastify.post<{ Params: { serviceId: string }; Body: { baseUrl: string; apiKey: string } }>(
  '/api/test-connection/:serviceId',
  async (request, reply) => { ... }
)
```

**SECURITY NOTE:** The GET settings route MUST NOT return the decrypted API key. Return only `{ baseUrl, configured: true/false }`. The frontend has no need to read back the key — it was entered by the user.

### Anti-Patterns to Avoid

- **Decrypting API keys to send to the frontend:** Never return plaintext API keys over the API. The key is write-only from the frontend's perspective.
- **Storing IV+tag in separate SQLite columns:** Unnecessary complexity; single `iv:tag:ciphertext` column is self-contained and portable.
- **Re-using IV across encryptions:** Every `encrypt()` call generates a fresh IV with `randomBytes(12)`. Never reuse.
- **Running multiple overlapping intervals for the same service:** PollManager must call `clearInterval(this.timers.get(serviceId))` before setting a new one in `reload()`.
- **Calling the service API from the frontend directly:** All service API calls go through the backend. The frontend never touches Radarr/SABnzbd APIs.
- **Alpine Linux base image:** Already excluded — `node:22-slim` (Debian) is the established base. `better-sqlite3` native binaries fail on musl libc.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM encryption | Custom cipher or pure-JS crypto | `node:crypto` built-in | AEAD with authentication tag prevents ciphertext tampering; OpenSSL-backed; zero deps |
| HTTP client with timeouts/self-signed cert support | Raw `fetch` with AbortController | `axios` | Cleaner timeout config (`timeout: 5000`), `httpsAgent: new https.Agent({ rejectUnauthorized: false })` for self-signed certs on local services |
| SQLite schema + migrations | Manual `CREATE TABLE IF NOT EXISTS` | Drizzle ORM + drizzle-kit | Type-safe queries, auto-generated migrations, already in use in the project |
| Interval management | Ad-hoc `setInterval` calls scattered through modules | PollManager class | Centralises ownership, enables hot-reload on config save, prevents duplicate intervals |

**Key insight:** The encryption primitives and HTTP client are already available — the only new code is wiring them together in the right order (derive key → encrypt → store; load → decrypt → poll).

---

## Common Pitfalls

### Pitfall 1: Fastify v5 Body Parsing — Content-Type Required
**What goes wrong:** POST to `/api/settings/:serviceId` returns 400 with "body must be object" even though JSON is sent.
**Why it happens:** Fastify v5 requires the request to have `Content-Type: application/json` header. If the frontend fetch omits it, the body is not parsed.
**How to avoid:** Set `Content-Type: application/json` in every `fetch()` call from the frontend settings form.
**Warning signs:** 400 response with validation error on an otherwise correct payload.

### Pitfall 2: GCM Auth Tag Not Set Before Decryption
**What goes wrong:** `decipher.final()` throws `Error: Unsupported state or unable to authenticate data`.
**Why it happens:** `decipher.setAuthTag()` must be called BEFORE `decipher.update()` and `decipher.final()` in Node.js crypto.
**How to avoid:** Always call `setAuthTag()` immediately after `createDecipheriv()`, before any update.
**Warning signs:** Runtime error on first decrypt attempt.

### Pitfall 3: SSE Route Still Sends Mock Data After Transition
**What goes wrong:** Dashboard shows mock data even after real credentials are saved.
**Why it happens:** The `sseRoutes` module imports `generateMockSnapshot` at module load time and the interval closure captures the old reference.
**How to avoid:** Replace the `generateMockSnapshot()` call with `pollManager.getSnapshot()` directly. The PollManager reference is stable; calling `.getSnapshot()` always returns current state.
**Warning signs:** Cards show mock data (e.g., hardcoded "Succession" Plex stream) after Phase 3 deployment.

### Pitfall 4: Axios Timeout Not Set — Hung Polls Block SSE
**What goes wrong:** A service that is unreachable (no TCP RST, just silence) blocks a poll indefinitely. Node's event loop is not blocked, but the adapter Promise never resolves. On next SSE push, stale data is served.
**How to avoid:** Always set `axios({ timeout: 5000 })` on every service poll call. 5 seconds is sufficient for LAN services.
**Warning signs:** Status never goes red for a service that is powered off — stays stuck at last known state.

### Pitfall 5: `initDb()` Migrations Folder Path in Production Docker
**What goes wrong:** `migrate()` throws `ENOENT: no such file or directory, open '/app/drizzle/...'`.
**Why it happens:** The migrations folder (`./drizzle`) must be copied into the Docker image. Multi-stage Dockerfile builder stage must `COPY drizzle/ /app/drizzle/`.
**How to avoid:** Add `COPY drizzle/ /app/drizzle/` to the runner stage of the Dockerfile, after migration files are generated by `drizzle-kit generate` in CI.
**Warning signs:** Server starts then immediately crashes with ENOENT on first `initDb()` call.

### Pitfall 6: Drizzle Schema Change Without Migration File
**What goes wrong:** SQLite table `service_config` doesn't exist at runtime even though the schema is defined.
**Why it happens:** Changing `schema.ts` does NOT automatically create a migration. `drizzle-kit generate` must be run to produce the SQL file in `./drizzle/`, which `migrate()` then applies.
**How to avoid:** After adding `serviceConfig` table to `schema.ts`, run `npx drizzle-kit generate` and commit the generated migration file.
**Warning signs:** `SQLiteError: no such table: service_config` at first settings save.

### Pitfall 7: Bazarr Does NOT Use `/api/v3/health`
**What goes wrong:** Bazarr adapter returns 404 on health check despite valid credentials.
**Why it happens:** Bazarr is NOT an arr application — it has its own API without the `/api/v3/` prefix. The correct liveness endpoint is `/api/system/status`.
**How to avoid:** Bazarr gets its own adapter (`adapters/bazarr.ts`) — do NOT reuse the arr adapter for it.
**Warning signs:** 404 response when testing Bazarr connection using the arr adapter URL pattern.

### Pitfall 8: `ServiceStatus.status` Type Mismatch — `'configured'` vs existing type union
**What goes wrong:** TypeScript error — `'configured'` or similar new values are not assignable to `ServiceStatus['status']`.
**Why it happens:** The existing `status` union in `packages/shared/src/types.ts` is `'online' | 'offline' | 'warning' | 'stale'`. D-18 requires a `configured: false` flag for unconfigured services rather than a new status value.
**How to avoid:** Keep `status: 'stale'` for unconfigured services. Add `configured?: boolean` as an optional field to `ServiceStatus`. Do NOT add new status enum values — keep the union stable.
**Warning signs:** TypeScript compilation errors in shared types or frontend components.

---

## Code Examples

### AES-256-GCM Full Round-Trip

```typescript
// Source: Node.js crypto docs (nodejs.org/api/crypto.html)
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm' as const
const IV_BYTES = 12  // 96 bits per NIST SP 800-38D recommendation

function deriveKey(seed: string): Buffer {
  return createHash('sha256').update(Buffer.from(seed, 'hex')).digest()
}

export function encryptApiKey(plaintext: string, seed: string): string {
  const key = deriveKey(seed)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv_hex:tag_hex:ciphertext_hex
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptApiKey(stored: string, seed: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted key format')
  const [ivHex, tagHex, ctHex] = parts
  const key = deriveKey(seed)
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))  // MUST be before update/final
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
```

### Arr Adapter (Radarr/Sonarr/Lidarr/Prowlarr/Readarr)

```typescript
// packages/backend/src/adapters/arr.ts
import axios from 'axios'
import type { ServiceStatus } from '@coruscant/shared'

interface ArrConfig { id: string; name: string; baseUrl: string; apiKey: string }

export async function pollArrService(config: ArrConfig): Promise<ServiceStatus> {
  const now = new Date().toISOString()
  try {
    const res = await axios.get(`${config.baseUrl}/api/v3/health`, {
      headers: { 'X-Api-Key': config.apiKey },
      timeout: 5000,
    })
    const items: Array<{ type: string; message: string }> = res.data ?? []
    const hasWarning = items.some(i => i.type === 'Warning' || i.type === 'Error')
    return {
      id: config.id,
      name: config.name,
      tier: 'status',
      status: hasWarning ? 'warning' : 'online',
      lastPollAt: now,
      metrics: { healthItems: items },
    }
  } catch (err: unknown) {
    return { id: config.id, name: config.name, tier: 'status', status: 'offline', lastPollAt: now }
  }
}
```

### SABnzbd Adapter

```typescript
// packages/backend/src/adapters/sabnzbd.ts
import axios from 'axios'
import type { ServiceStatus } from '@coruscant/shared'

interface SabConfig { baseUrl: string; apiKey: string }

export async function pollSabnzbd(config: SabConfig): Promise<ServiceStatus> {
  const now = new Date().toISOString()
  try {
    const res = await axios.get(`${config.baseUrl}/api`, {
      params: { mode: 'queue', output: 'json', apikey: config.apiKey },
      timeout: 5000,
    })
    const q = res.data?.queue
    if (!q) throw new Error('No queue object in response')

    const kbpersec = parseFloat(q.kbpersec ?? '0')
    const slots: Array<{ status: string; percentage: string }> = q.slots ?? []
    const activeSlot = slots.find(s => s.status === 'Downloading')
    const hasFailedItems = slots.some(s => s.status === 'Failed')

    return {
      id: 'sabnzbd', name: 'SABnzbd', tier: 'activity',
      status: hasFailedItems ? 'warning' : 'online',
      lastPollAt: now,
      metrics: {
        speedMBs: kbpersec / 1024,
        queueCount: q.noofslots ?? 0,
        progressPercent: activeSlot ? parseFloat(activeSlot.percentage ?? '0') : 0,
        hasFailedItems,
        sabStatus: q.status,
      },
    }
  } catch {
    return { id: 'sabnzbd', name: 'SABnzbd', tier: 'activity', status: 'offline', lastPollAt: now }
  }
}
```

### NOT CONFIGURED Card Render Branch

```typescript
// Addition to renderInstrumentBody() in ServiceCard.tsx
// When service has configured: false (added to ServiceStatus in Phase 3)
if ((service as ServiceStatus & { configured?: boolean }).configured === false) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.4 }}>
      <span className="text-label" style={{ color: '#C8C8C8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        NOT CONFIGURED
      </span>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node.js `crypto.createCipher` (deprecated) | `createCipheriv` with explicit IV | Node.js v10+ | `createCipher` removed in Node.js 22; must use `createCipheriv` |
| Drizzle `push` for production deployments | `generate` + `migrate` for production | Drizzle v0.20+ | `push` is fine for dev iteration; production needs committed migration SQL files so rollback is possible |
| `node-cron` v3 cron string syntax | Direct `setInterval` for fixed-ms intervals | N/A | For ms-precision polling intervals (10s, 45s), `setInterval` is cleaner than cron strings; node-cron v4 supports both |
| Express.js ad-hoc polling | PollManager pattern (centralized interval ownership) | Industry pattern | Prevents interval leaks when config changes; enables clean server shutdown |

---

## Open Questions

1. **Readarr retirement — user awareness**
   - What we know: Readarr is officially retired. API still works; no future development.
   - What's unclear: Does the user know? They included Readarr explicitly in D-01.
   - Recommendation: Include Readarr in Phase 3 as planned (same adapter, same endpoint). Add `[RETIRED]` text to the Settings tab label. Do NOT block the phase on this.

2. **Bazarr `/api/system/status` vs alternative liveness endpoint**
   - What we know: Bazarr does not have `/api/v3/health`. `/api/system/status` is the documented system info endpoint.
   - What's unclear: Whether `/api/system/status` returns 200 even during startup/degraded state, and whether Bazarr exposes health-warning equivalents elsewhere.
   - Recommendation: Use `/api/system/status` as liveness. Bazarr maps to green-or-red only (no amber) unless a future phase adds deeper Bazarr integration.

3. **`ServiceStatus` type extension — `configured` flag**
   - What we know: D-18 requires `configured: false` on unconfigured service entries.
   - What's unclear: Whether to add `configured?: boolean` to the shared `ServiceStatus` interface now, or use a separate `UnconfiguredServiceStatus` type.
   - Recommendation: Add `configured?: boolean` to the existing `ServiceStatus` interface in `packages/shared/src/types.ts`. Optional field keeps backward compatibility with Phase 2 components that don't check it.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v25.8.1 | — |
| npm | Package install | Yes | 11.11.0 | — |
| `node:crypto` | AES-256-GCM encryption | Yes | built-in | — |
| `axios` | Service polling HTTP client | No (not yet installed) | — | Install: `npm install axios --workspace=packages/backend` |
| `node-cron` | Poll interval scheduling | No (not yet installed) | — | Install: `npm install node-cron --workspace=packages/backend` |
| SQLite / better-sqlite3 | Service config persistence | Yes (12.8.0) | 12.8.0 | — |
| drizzle-kit | Migration generation | Yes (0.31.10) | 0.31.10 | — |
| Drizzle `./drizzle` migrations dir | `initDb()` at server start | No (dir doesn't exist yet) | — | Must be created by `drizzle-kit generate` before Docker build |

**Missing dependencies with no fallback:**
- `./drizzle` migrations directory — must be generated by `npx drizzle-kit generate` after schema change. Without it, `initDb()` fails silently (caught by try/catch in index.ts currently, but serviceConfig table won't exist).

**Missing dependencies with fallback:**
- `axios` — installable; no blocker
- `node-cron` — installable; no blocker

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `/Users/Oreo/Projects/Coruscant/vitest.config.ts` |
| Quick run command | `npx vitest run packages/backend/src/__tests__` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CFG-01 | POST /api/settings/:serviceId saves config | unit | `npx vitest run packages/backend/src/__tests__/settings.test.ts` | ❌ Wave 0 |
| CFG-03 | Config survives in-memory DB round-trip (integration: container restart tested manually) | unit | `npx vitest run packages/backend/src/__tests__/settings.test.ts` | ❌ Wave 0 |
| CFG-04 | POST /api/test-connection returns pass/fail | unit | `npx vitest run packages/backend/src/__tests__/test-connection.test.ts` | ❌ Wave 0 |
| SVCST-01–04 | Arr adapter maps HTTP responses to correct ServiceStatus | unit | `npx vitest run packages/backend/src/__tests__/adapters.test.ts` | ❌ Wave 0 |
| SVCST-05 | Poll interval is configured (unit test for PollManager interval registration) | unit | `npx vitest run packages/backend/src/__tests__/poll-manager.test.ts` | ❌ Wave 0 |
| SVCACT-01 | SABnzbd adapter extracts speed, queue count, progress | unit | `npx vitest run packages/backend/src/__tests__/adapters.test.ts` | ❌ Wave 0 |
| SVCACT-02 | SABnzbd slot.status "Failed" sets hasFailedItems=true | unit | `npx vitest run packages/backend/src/__tests__/adapters.test.ts` | ❌ Wave 0 |
| SVCACT-03 | SABnzbd poll interval is ≤15s | unit | `npx vitest run packages/backend/src/__tests__/poll-manager.test.ts` | ❌ Wave 0 |
| CFG-01 (crypto) | encrypt/decrypt round-trip is correct | unit | `npx vitest run packages/backend/src/__tests__/crypto.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/backend/src/__tests__`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/backend/src/__tests__/crypto.test.ts` — covers encrypt/decrypt round-trip
- [ ] `packages/backend/src/__tests__/adapters.test.ts` — covers arr adapter, bazarr adapter, sabnzbd adapter with mocked axios responses
- [ ] `packages/backend/src/__tests__/poll-manager.test.ts` — covers PollManager.reload(), interval registration, getSnapshot()
- [ ] `packages/backend/src/__tests__/settings.test.ts` — covers POST/GET /api/settings/:serviceId via Fastify inject
- [ ] `packages/backend/src/__tests__/test-connection.test.ts` — covers POST /api/test-connection/:serviceId

---

## Sources

### Primary (HIGH confidence)
- Node.js v22 crypto documentation (`nodejs.org/api/crypto.html`) — AES-256-GCM API, `createCipheriv`/`createDecipheriv`, `setAuthTag` ordering requirement
- Radarr source code: `NzbDrone.Core/HealthCheck/HealthCheck.cs` (GitHub) — HealthResource fields (source, type, message, wikiUrl) and HealthCheckResult enum values (Ok/Notice/Warning/Error)
- Drizzle ORM docs (`orm.drizzle.team/docs/migrations`) — `generate` vs `push` pattern, migration folder approach
- React Router v7 docs (`reactrouter.com/api/hooks/useSearchParams`) — `useSearchParams` hook for tab deep-link via query params
- SABnzbd API wiki (`sabnzbd.org/wiki/configuration/4.5/api`) — `mode=queue` response fields: `kbpersec`, `noofslots`, `slots`, `status`
- Existing codebase: `packages/backend/src/schema.ts`, `db.ts`, `routes/sse.ts`, `index.ts`, `mock/generator.ts`, `packages/frontend/src/components/cards/ServiceCard.tsx` — direct inspection

### Secondary (MEDIUM confidence)
- Bazarr GitHub issue #2877 ("Why does health endpoint need authentication?") — confirms `/api/system/status` pattern and `?apikey=` query param auth
- Prowlarr devopsarr SDK docs — confirms `/api/v1/health` endpoint exists for Prowlarr (same HealthResource shape as Radarr/Sonarr)
- NIST SP 800-38D — 96-bit IV recommendation for GCM mode (referenced in Node.js crypto docs)

### Tertiary (LOW confidence)
- Readarr retirement confirmation: `readarr.com` homepage announcement — confirmed retired; API still functional
- Bazarr `/api/system/status` as liveness probe — inferred from community usage (Homepage widget source); not in official Bazarr API docs

---

## Project Constraints (from CLAUDE.md)

The following directives are active for Phase 3. Planner must verify all tasks comply:

| Directive | Impact on Phase 3 |
|-----------|-------------------|
| No cloud telemetry; all data stays local | Service adapters must call only user-configured local IPs — no external calls |
| Platform: Docker Compose on Synology NAS | Migration files must be COPY'd into Docker image; `node:22-slim` base maintained |
| Use `node:22-slim` (not Alpine) | No change needed — already established |
| Use `better-sqlite3` (not Prisma, not PostgreSQL) | Confirmed; all DB access through Drizzle + better-sqlite3 |
| Use Drizzle ORM (not Prisma) | `serviceConfig` table via Drizzle schema + drizzle-kit migration |
| Use `axios` for HTTP client | Service poll adapters use axios (with timeout + self-signed cert option) |
| Use `node-cron` for polling scheduler | PollManager uses node-cron or setInterval — see alternatives note above |
| No Redux/Zustand — use TanStack Query or React Context | Settings page state uses local `useState`; no global state store needed for settings form |
| JetBrains Mono throughout; cockpit aesthetic | Settings tab bar, form fields, TEST button result all use existing CSS vars and monospace fonts |
| Framer Motion for animations | Settings page tab transitions and TEST button state changes use Framer Motion |
| Do not use `PM2` inside Docker | N/A — poll timers managed by Node.js process, not PM2 |
| GSD workflow enforcement | All edits go through `/gsd:execute-phase` |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed or confirmed latest via `npm view`
- Architecture (adapter pattern, PollManager, encryption): HIGH — patterns are standard Node.js; verified against official docs
- External API shapes (arr health, SABnzbd queue): MEDIUM — Radarr health response shape confirmed from source code; SABnzbd confirmed from official API docs; Bazarr status endpoint inferred (LOW for Bazarr specifically)
- Settings UI patterns: HIGH — React Router v7 useSearchParams confirmed from official docs

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable ecosystem; SABnzbd and arr API shapes change infrequently)
