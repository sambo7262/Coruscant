# Phase 4: Rich Service Integrations — Research

**Researched:** 2026-04-04
**Domain:** Pi-hole v6 REST API, Plex Media Server API, Synology DSM WebAPI, React drawer patterns
**Confidence:** MEDIUM (API field shapes verified through multiple community sources; official Synology API docs sparse)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Pi-hole adapter targets v6 API only. No v5 support. Settings tab note: "Pi-hole v6 or higher required."
- **D-02:** Pi-hole v6 auth: POST to `/api/auth` with `{"password": "..."}` → returns session `sid`. Backend manages session lifecycle (re-auth on expiry).
- **D-03:** Settings tab fields: Pi-hole URL + Password (two fields). Password masked with eye-toggle.
- **D-04:** Pi-hole card shows: active/inactive blocking status, QPM, system load, memory usage %.
- **D-05:** Blocking active = green LED, blocking disabled = amber LED, offline = red LED.
- **D-06:** Pi-hole detail view shows: query type distribution, day totals (total/blocked today), any warning/error messages.
- **D-07:** Plex auth uses X-Plex-Token. Settings fields: Plex URL + Plex Token (not "API Key"). Masked.
- **D-08:** No Plex card in the grid. Plex lives entirely in the bottom rail (NowPlayingBanner).
- **D-09:** Rail collapsed: title, device name, transcode vs direct-play indicator per stream. Scrolling if multiple.
- **D-10:** Rail expanded: additionally shows Plex server stats (bandwidth Mbps, Plex CPU %, Plex RAM %).
- **D-11:** Rail tap to toggle expanded. "NO ACTIVE STREAMS" dim label when idle.
- **D-12:** NAS auth: DSM username + password → SYNO.API.Auth session sid. Backend manages lifecycle.
- **D-13:** Settings fields: NAS URL + DSM Username + DSM Password (3 fields). Password masked. Note: "Requires an admin-level DSM account."
- **D-14:** TEST button for NAS: real SYNO.API.Auth login.
- **D-15:** No NAS card in the grid. NAS lives entirely in the AppHeader as an expandable downward panel.
- **D-16:** Header strip (collapsed): CPU %, RAM %, network up/down Mbps, disk space %, CPU temp °C.
- **D-17:** Header panel (expanded): per-disk read/write speeds + temp (only if DSM returns data), Docker daemon stats (only if data), fan speeds (only if data), image update LED (amber if updates available, grey if current).
- **D-18:** Image update check polls SYNO.Docker.Image 2x per day. Cached in NAS expanded panel.
- **D-19:** Only show sections for data that exists. No N/A rows, no placeholder sections.
- **D-20:** Grid now contains: arr services + SABnzbd + Pi-hole. No Plex or NAS cards.
- **D-21:** "RICH DATA" tier label applies to Pi-hole only.
- **D-22:** Three new Settings tabs: PI-HOLE, PLEX, NAS.
- **D-23:** Pi-hole and Plex tabs: 2-field pattern. NAS tab: 3-field pattern. Cockpit instrument panel aesthetic.
- **D-24:** Pi-hole poll interval: 30–60 seconds.
- **D-25:** Plex: Tautulli webhooks (no polling). User has Plex Pass + Tautulli. Backend exposes POST /api/webhooks/tautulli.
- **D-26:** NAS: poll every 3 seconds. Image update check: 2x per day (separate timer).

### Claude's Discretion
- Exact DSM API endpoints for each metric category
- `NasStatus` type extension: add `networkMbpsUp`, `networkMbpsDown`, `cpuTempC`, per-disk entries, fan entries, Docker daemon stats, `imageUpdateAvailable` boolean
- `PlexServerStats` type shape (bandwidth, CPU %, RAM % from Plex API)
- Pi-hole v6 session management approach
- Exact poll interval values within spec ranges
- Whether Pi-hole session needs explicit logout or just re-auth on 401
- Plex API endpoint for server stats

### Deferred Ideas (OUT OF SCOPE)
None captured this session.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SVCRICH-01 | Pi-hole card shows total DNS queries today, block percentage, and blocklist size; handles v5 and v6 API differences | v6 only per D-01; `/api/stats/summary` fields documented below |
| SVCRICH-02 | Plex card shows active stream count, titles, playback state, transcode vs direct-play indicators | `/status/sessions` endpoint documented; TranscodeSession detection pattern established |
| SVCRICH-03 | NAS card shows CPU %, RAM %, per-volume storage usage bars | SYNO.Core.System.Utilization and SYNO.Core.System info APIs documented |
| SVCRICH-04 | NAS card shows per-disk temperatures and fan speed readings | SYNO.Core.System method info type storage for disk temps; SYNO.Core.Hardware.FanSpeed documented |
| SVCRICH-05 | Each rich-data service has a detail view with all available metrics expanded | Existing ServiceDetailPage pattern reused; Pi-hole gets new section; NAS detail accessed via header panel |
</phase_requirements>

---

## Summary

Phase 4 wires three live service integrations — Pi-hole, Plex, and Synology NAS — into the existing SSE pipeline. The codebase already has stub cases in `PollManager.doPoll()` (currently returning early for `pihole`, `plex`, `nas`), and `ALL_SERVICE_IDS` already includes them. The work is: write three new adapters, extend the shared types, update the settings routes to accept the new services, refactor the AppHeader from its current static-gauge stub into a live-data + expandable panel, and upgrade NowPlayingBanner to show real stream data plus Plex server stats in the expanded drawer.

Pi-hole v6 uses a session-based REST API (`POST /api/auth` → sid → `X-FTL-SID` header on subsequent calls). Session validity is 300 seconds by default, refreshed automatically on each call. The `/api/stats/summary` endpoint is the primary data source. `/api/dns/blocking` gives the active/inactive blocking state. `/api/info/system` gives CPU load and memory. Blocking status is distinct from up/down — this is the amber LED case.

Plex uses a static `X-Plex-Token` on every request. `/status/sessions` returns currently playing streams with user, title, progress, quality, and transcode decision. Server CPU/RAM are available via `/statistics/resources?timespan=6`. The API returns XML by default; request `Accept: application/json` to get JSON.

Synology DSM uses a form-based auth via `/webapi/entry.cgi` (or `/webapi/auth.cgi` on older DSM) with `SYNO.API.Auth`. The response provides a `sid` used as `_sid` query parameter on all subsequent calls. CPU/RAM/network come from `SYNO.Core.System.Utilization`. Disk temperatures come from `SYNO.Core.System` method `info` type `storage` (response: `hdd_info[].temp`). Fan speeds come from `SYNO.Core.Hardware.FanSpeed`. Docker image update status comes from `SYNO.Docker.Image`.

**Primary recommendation:** Build three adapters following the `arr.ts` adapter pattern, with session management (re-auth on 401) encapsulated inside each adapter class. Use the existing PollManager `setInterval` pattern — add interval constants and dispatch cases in `doPoll()`. Extend shared types before writing adapter code to avoid type thrash.

---

## Standard Stack

No new npm packages needed. All required capabilities are in the existing dependency set:

| Library | Already Installed | Purpose in Phase 4 |
|---------|-------------------|---------------------|
| `axios` | Yes (^1.14.0) | HTTP calls to Pi-hole, Plex, DSM APIs |
| `framer-motion` | Yes (frontend) | Drawer animation for AppHeader panel (same pattern as NowPlayingBanner) |
| React Router | Yes (frontend) | No new routes needed; Pi-hole detail extends ServiceDetailPage |

**No new backend packages required.** All three adapters use `axios` for HTTP calls and TypeScript's built-in types.

**Version verification:** `better-sqlite3@12.8.0` is already installed (newer than the `9.x` in CLAUDE.md research — this is fine). Vitest `4.1.2` is the runtime version.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
packages/
├── backend/src/adapters/
│   ├── pihole.ts          # NEW — Pi-hole v6 adapter with session class
│   ├── plex.ts            # NEW — Plex adapter (token-based, stateless)
│   └── nas.ts             # NEW — DSM adapter with session class + image check timer
├── backend/src/routes/
│   └── settings.ts        # EXTEND — add pihole/plex/nas to VALID_SERVICES
├── backend/src/
│   └── poll-manager.ts    # EXTEND — add cases + intervals for pihole/plex/nas
├── shared/src/
│   └── types.ts           # EXTEND — NasStatus, PlexServerStats, PiholeMetrics
└── frontend/src/
    ├── components/layout/
    │   ├── AppHeader.tsx   # REFACTOR — live NAS strip + expand panel
    │   └── NowPlayingBanner.tsx  # EXTEND — real streams + server stats section
    └── pages/
        └── ServiceDetailPage.tsx  # EXTEND — Pi-hole detail view case
```

### Pattern 1: Session-Managed Adapter Class

Pi-hole and NAS both require session tokens that expire. The cleanest pattern is a lightweight class inside the adapter file that holds the session state. This avoids global mutable state in PollManager.

```typescript
// Source: pattern inferred from arr.ts + Pi-hole/DSM auth behavior
class PiholeSession {
  private sid: string | null = null
  private validUntil: number = 0

  async ensureSession(baseUrl: string, password: string): Promise<string> {
    if (this.sid && Date.now() < this.validUntil - 10_000) {
      return this.sid
    }
    const resp = await axios.post(`${baseUrl}/api/auth`, { password }, { timeout: 5_000 })
    this.sid = resp.data.session.sid
    this.validUntil = Date.now() + resp.data.session.validity * 1000
    return this.sid!
  }

  invalidate() {
    this.sid = null
    this.validUntil = 0
  }
}

// Module-level singleton — one per base URL
const piholeSessions = new Map<string, PiholeSession>()
```

**When to use:** Any service with session-based auth that expires (Pi-hole v6, Synology DSM). Plex uses a static token and does NOT need this.

### Pattern 2: PollManager Credential Shape Extension

The current `reload()` signature is `{ baseUrl: string; apiKey: string }`. NAS needs a username + password pair, Pi-hole needs a password (not an API key). The cleanest approach is to keep `apiKey` as the encrypted credential field in SQLite (it already exists) and store the semantic meaning in the adapter.

For NAS, encode `username:password` as the `apiKey` field, or add a `username` column to the `serviceConfig` table. The second approach is cleaner for the 3-field NAS settings form.

**Recommendation:** Add an optional `username` column to `serviceConfig`. Pi-hole and Plex don't use it (their credential is already a single string). NAS stores DSM username there.

**Alternative (simpler, no schema change):** Encode `username|||password` as the `apiKey` field, split in the NAS adapter. This avoids a schema migration but is brittle. Prefer the schema column approach.

### Pattern 3: NAS Header Panel (Downward Drawer)

The AppHeader currently renders a static stub gauge strip. The refactored version needs:
1. Clickable strip (same `onClick` / `role="button"` pattern as NowPlayingBanner)
2. Framer Motion `AnimatePresence` + `motion.div` with `height: 0 → auto` expanding **downward** (not upward like the banner)
3. `overflow: hidden` on the expanding div so content doesn't bleed during animation

```typescript
// Source: Framer Motion docs — height auto animation
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.3, ease: 'easeInOut' }}
  style={{ overflow: 'hidden' }}
>
  {/* NAS expanded panel content */}
</motion.div>
```

The panel drops below the header bar. The main content area already has `paddingTop` set for the fixed header — when the panel is open, the layout should push down (or use `overflow: hidden` on the panel container so it overlaps). Overlapping is simpler; dashboard cards scroll past it.

### Pattern 4: SSE Shape Extension

`DashboardSnapshot` currently has `nas: NasStatus` (stub stub data) and `streams: PlexStream[]`. Phase 4 extends this:
- `nas` becomes the extended `NasStatus` with new fields
- `streams` stays `PlexStream[]` (no shape change needed for collapsed rail)
- A new top-level field `plexServerStats?: PlexServerStats` carries bandwidth/CPU/RAM for the expanded rail
- A new `pihole` field on the relevant `ServiceStatus.metrics` carries Pi-hole-specific data

### Anti-Patterns to Avoid
- **Re-authenticating on every poll:** DSM sessions are valid for ~30 minutes. Re-authing every 10 seconds wastes resources and can trigger account lockout on failed-login thresholds. Always cache the sid.
- **XML parsing for Plex:** Plex returns XML by default. Send `Accept: application/json` and `X-Plex-Token` as a header (not query param) to get clean JSON.
- **Reading `Progress` from TranscodeSession for viewOffset:** Use `viewOffset / duration * 100` from the top-level Video element, not the TranscodeSession's `progress` (which is the transcode encode progress, not playback position).
- **Assuming DSM fan/docker data always exists:** Fanless models (like some DS line NAS units) return no fan data. The NAS panel must conditionally render these sections (D-19).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP retries | Custom retry loop | axios `timeout` + adapter try/catch (already pattern) | Consistent with arr.ts; home services don't need complex retry logic |
| Session refresh | Custom timer | Check `Date.now() < validUntil - 10_000` on each poll call | Simpler than a separate timer; Pi-hole calls every 30–60s anyway |
| XML → JSON conversion | xml2js or similar | `Accept: application/json` header on Plex requests | Plex natively returns JSON when requested |
| Framer Motion drawer | CSS `max-height` hack | `height: 0 → auto` Framer Motion pattern | Already used in NowPlayingBanner; consistent; avoids CSS animation timing bugs |

---

## API Reference

### Pi-hole v6 API

**Authentication:**
```
POST {baseUrl}/api/auth
Body: { "password": "..." }
Response: { "session": { "sid": "...", "validity": 300, "csrf": "...", "valid": true } }
```
- Use `X-FTL-SID: {sid}` header on all subsequent authenticated requests
- Session validity is 300 seconds (5 minutes) by default, refreshed on each request that uses the sid
- Requests that use the sid extend the timeout; no separate keepalive needed
- Re-auth on `401 Unauthorized` response (session expired)
- No explicit logout needed — let session expire naturally

**Stats Summary** (requires auth):
```
GET {baseUrl}/api/stats/summary
Headers: X-FTL-SID: {sid}
Response fields:
{
  "queries": {
    "total": 12345,
    "blocked": 234,
    "percent_blocked": 1.895,
    "unique_domains": 500,
    "forwarded": 11000,
    "cached": 111,
    "frequency": 14.2  // queries per minute (QPM)
  },
  "gravity": {
    "domains_being_blocked": 200000,
    "last_update": 1712345678
  },
  "clients": { "active": 8, "total": 12 }
}
```
Confidence: HIGH (verified from official Pi-hole discourse + glance issue tracker showing real response)

**Blocking Status** (requires auth):
```
GET {baseUrl}/api/dns/blocking
Headers: X-FTL-SID: {sid}
Response: { "blocking": "enabled" }   // or "disabled"
```
The `blocking` field is the distinct active/inactive state mapped to green/amber LED per D-05.

**System Info** (requires auth):
```
GET {baseUrl}/api/info/system
Headers: X-FTL-SID: {sid}
Response: {
  "system": {
    "cpu": { "load": [0.5, 0.3, 0.2] },  // 1min, 5min, 15min load average
    "memory": {
      "ram": { "total": 2097152, "used": 573440, "free": 1523712 },
      "swap": { "total": 0, "used": 0, "free": 0 }
    }
  }
}
```
Memory usage % = `(ram.used / ram.total) * 100`. Load average = `cpu.load[0]` (1-minute).
Confidence: MEDIUM (FTL source changelog mentions `/api/info/system` includes `%MEM` and `%CPU` of FTL process + system load averages loaded from /proc/loadavg — field names inferred from response pattern; verify against live instance)

**D-04 field mapping:**
| Card field | API source |
|-----------|------------|
| Blocking active/inactive | `GET /api/dns/blocking` → `blocking` field |
| QPM | `/api/stats/summary` → `queries.frequency` |
| System load | `/api/info/system` → `system.cpu.load[0]` |
| Memory usage % | `/api/info/system` → `(system.memory.ram.used / total) * 100` |

**D-06 detail view field mapping:**
| Detail field | API source |
|-------------|------------|
| Total queries today | `queries.total` |
| Blocked today | `queries.blocked` |
| Block percent | `queries.percent_blocked` |
| Blocklist size | `gravity.domains_being_blocked` |
| Query type distribution | `/api/stats/query_types` (separate endpoint, authenticated) |

### Plex Media Server API

**Authentication:** Static `X-Plex-Token` header on every request. No session management needed.

**Active Sessions:**
```
GET {baseUrl}/status/sessions
Headers:
  X-Plex-Token: {token}
  Accept: application/json
Response: {
  "MediaContainer": {
    "size": 2,
    "Metadata": [
      {
        "title": "Inception",
        "type": "movie",
        "grandparentTitle": "",       // For episodes: show name
        "parentIndex": null,           // For episodes: season number
        "index": null,                 // For episodes: episode number
        "duration": 8880000,           // milliseconds
        "viewOffset": 2400000,         // milliseconds (current position)
        "Media": [{
          "videoResolution": "1080",
          "Part": [{ "decision": "directplay" }]   // or "transcode"
        }],
        "TranscodeSession": {
          "videoDecision": "transcode",  // or "copy" or "directplay"
          "audioDecision": "directplay",
          "throttled": false,
          "progress": 27.1             // transcode encode progress, NOT playback
        },
        "User": { "title": "SamUser", "id": "1" },
        "Player": {
          "title": "Chrome",
          "platform": "Chrome",
          "state": "playing"           // "playing", "paused", "buffering"
        },
        "Session": {
          "id": "abc123",
          "bandwidth": 8000,           // kbps
          "location": "lan"
        }
      }
    ]
  }
}
```

**Transcode detection logic:**
- If `TranscodeSession` exists AND `videoDecision === "transcode"` → `transcode: true`
- If `Media[0].Part[0].decision === "directplay"` → `transcode: false`
- These can disagree (audio transcode, video direct). Use video decision for the indicator.

**Progress calculation:** `(viewOffset / duration) * 100` — NOT `TranscodeSession.progress`.

**Confidence:** HIGH for field names (verified from plexopedia + Dirrk gist + plexapi.dev)

**Server Stats** (for expanded rail — D-10):
```
GET {baseUrl}/statistics/resources?timespan=6
Headers: X-Plex-Token: {token}, Accept: application/json
Response: {
  "MediaContainer": {
    "StatisticsResources": [{
      "timespan": 6,
      "at": 1718384427,
      "hostCpuUtilization": 1.276,       // host system CPU %
      "processCpuUtilization": 0.025,    // Plex process CPU %
      "hostMemoryUtilization": 17.026,   // host system RAM %
      "processMemoryUtilization": 0.493  // Plex process RAM %
    }]
  }
}
```
`timespan=6` returns per-second data; use most recent entry. Display `processCpuUtilization` and `processMemoryUtilization` for Plex's own resource footprint (D-10).

**Bandwidth calculation for D-10:** Use `Session.bandwidth` (kbps) from each stream, sum them, convert to Mbps: `(sumBandwidth / 1000).toFixed(1)`.

**Confidence:** HIGH for field names (verified from gethomepage search result showing exact JSON example)

### Synology DSM API

**Authentication:**
```
GET {baseUrl}/webapi/entry.cgi?api=SYNO.API.Auth&version=6&method=login
  &account={username}&passwd={password}&format=sid
Response: { "success": true, "data": { "sid": "ABCDEF..." } }
```
- Use `_sid={sid}` query parameter on all subsequent requests
- Sessions are valid for ~30 minutes by default
- Re-auth on `{ "success": false, "error": { "code": 119 } }` (Invalid session)
- Logout: `GET /webapi/entry.cgi?api=SYNO.API.Auth&version=6&method=logout&_sid={sid}`

**System Utilization (CPU, RAM, Network):**
```
GET {baseUrl}/webapi/entry.cgi?api=SYNO.Core.System.Utilization&version=1&method=get
  &type=current&_sid={sid}
Response: {
  "success": true,
  "data": {
    "cpu": {
      "user_load": 12,
      "system_load": 3,
      "other_load": 1
    },
    "memory": {
      "real_usage": 45,      // percent RAM used
      "memory_size": 8388608  // total KB
    },
    "network": [
      { "device": "eth0", "rx": 2215, "tx": 518 }  // bytes/sec
    ]
  }
}
```
- CPU total % = `user_load + system_load + other_load`
- Network: `rx` and `tx` are bytes/sec; convert to Mbps: `(bytes * 8) / 1_000_000`
- Confidence: HIGH (confirmed from homebridge-synology docs + community gist response sample)

**Disk Temperatures and Volume Info:**
```
GET {baseUrl}/webapi/entry.cgi?api=SYNO.Core.System&version=1&method=info
  &type=storage&_sid={sid}
Response: {
  "success": true,
  "data": {
    "hdd_info": [
      { "id": "sata1", "name": "Disk 1", "temp": 38 }   // temp in Celsius
    ],
    "vol_info": [
      {
        "id": "volume1",
        "name": "volume1",
        "used_size": "500107862016",   // bytes as string
        "total_size": "1000204886016"
      }
    ],
    "temperature": 42   // system temperature (often same as hottest disk)
  }
}
```
- Volume usage % = `(parseInt(used_size) / parseInt(total_size)) * 100`
- Disk temp in Celsius — convert if needed: `tempF = tempC * 9/5 + 32`
- Confidence: MEDIUM (homebridge-synology docs show `hdd_info[].temp` field name; vol_info size fields as strings from community examples)

**Fan Speeds:**
```
GET {baseUrl}/webapi/entry.cgi?api=SYNO.Core.Hardware.FanSpeed&version=1&method=get
  &_sid={sid}
Response: {
  "success": true,
  "data": {
    "fan_speed": [
      { "id": "fan1", "rpm": 1200 }
    ]
  }
}
```
- Fanless NAS models will return empty `fan_speed` array or `success: false` — handle both gracefully per D-19
- Confidence: LOW (API name confirmed from Synology API index; field names `fan_speed` and `rpm` inferred from naming conventions — verify against live DSM instance)

**Docker Image Update Check:**
```
GET {baseUrl}/webapi/entry.cgi?api=SYNO.Docker.Image&version=1&method=list
  &_sid={sid}
Response: {
  "success": true,
  "data": {
    "images": [
      {
        "name": "sambo7262/coruscant:latest",
        "is_update_available": true   // or false
      }
    ]
  }
}
```
- Check `any(images[].is_update_available === true)` → amber blink LED
- Confidence: LOW (SYNO.Docker.Image exists per API index; `is_update_available` field name inferred from naming pattern — verify against live DSM instance with Container Manager installed)

---

## Type Extensions Required

These are "Claude's discretion" items from CONTEXT.md, resolved here.

### `NasStatus` extension

```typescript
// packages/shared/src/types.ts
export interface NasDisk {
  id: string
  name: string
  tempC: number
  readBytesPerSec?: number
  writeBytesPerSec?: number
}

export interface NasFan {
  id: string
  rpm: number
}

export interface NasDockerStats {
  cpuPercent: number
  ramPercent: number
  networkMbpsUp: number
  networkMbpsDown: number
}

export interface NasStatus {
  cpu: number             // percent (user + system + other)
  ram: number             // percent
  networkMbpsUp: number   // NEW
  networkMbpsDown: number // NEW
  cpuTempC?: number       // NEW (optional — from system temperature field)
  volumes: NasVolume[]
  disks?: NasDisk[]       // NEW (optional — only if DSM returns data)
  fans?: NasFan[]         // NEW (optional — only if DSM returns fan data)
  docker?: NasDockerStats // NEW (optional — only if DSM returns docker stats)
  imageUpdateAvailable?: boolean // NEW (optional — from 2x/day check)
}
```

### `PlexServerStats` (new type)

```typescript
// packages/shared/src/types.ts
export interface PlexServerStats {
  processCpuPercent: number
  processRamPercent: number
  bandwidthMbps: number    // sum of all active stream bandwidths
}
```

### `DashboardSnapshot` extension

```typescript
export interface DashboardSnapshot {
  services: ServiceStatus[]
  nas: NasStatus
  streams: PlexStream[]
  plexServerStats?: PlexServerStats  // NEW (optional — only when Plex configured + streaming)
  timestamp: string
}
```

### `PiholeMetrics` (for ServiceStatus.metrics)

```typescript
// Not a top-level export — embedded in ServiceStatus.metrics for pihole service
// {
//   blockingActive: boolean,
//   queriesPerMinute: number,
//   load1m: number,
//   memPercent: number,
//   // Detail view fields:
//   totalQueriesDay: number,
//   totalBlockedDay: number,
//   percentBlocked: number,
//   domainsBlocked: number,
// }
```

---

## Settings Route Extension

`settings.ts` currently hardcodes `VALID_SERVICES` to 7 services. Phase 4 adds `pihole`, `plex`, `nas`:

```typescript
const VALID_SERVICES = [
  'radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd',
  'pihole', 'plex', 'nas',  // Phase 4 additions
] as const
```

The NAS settings form requires 3 fields. The `serviceConfig` schema currently only has `baseUrl` and `encryptedApiKey`. For NAS's username, two options:

**Option A (schema change):** Add `username` column to `serviceConfig`. Clean separation. Requires a Drizzle migration (new column with `.default('')`).

**Option B (no schema change):** Pack username into baseUrl as a non-standard string, or store `username|||password` as apiKey. Messy.

**Recommendation:** Option A — add `username text('username').notNull().default('')` to `serviceConfig`. This requires a Drizzle migration file. The migration is a simple `ALTER TABLE service_config ADD COLUMN username TEXT NOT NULL DEFAULT ''`.

---

## PollManager Extension

```typescript
```typescript
// New interval constants
const PIHOLE_INTERVAL_MS = 60_000    // D-24: 60 seconds
const NAS_INTERVAL_MS = 3_000        // D-26: 3 seconds
// No PLEX_INTERVAL_MS — Plex uses Tautulli webhooks (D-25), not polling

// In doPoll():
} else if (serviceId === 'pihole') {
  result = await pollPihole(baseUrl, password)
} else if (serviceId === 'plex') {
  // Plex uses Tautulli webhooks — no polling. Skip entirely.
  return
} else if (serviceId === 'nas') {
  const nasData = await pollNas(baseUrl, username, password)
  this.nasData = nasData
  return  // NAS doesn't produce a ServiceStatus entry
}
```

Note: Plex stream state is updated exclusively via Tautulli webhooks (POST /api/webhooks/tautulli). The webhook handler calls `pollManager.updatePlexState(streams, serverStats)` to store data and trigger an SSE push. NAS doesn't produce a `ServiceStatus` entry — it stores `nasData` directly. `getSnapshot()` must return live `this.nasData` and `this.plexStreams` instead of `STUB_NAS` and `STUB_STREAMS`.

**Image update timer (D-18):**
```typescript
// Separate setInterval in the 'nas' branch of reload():
this.imageUpdateTimer = setInterval(() => {
  pollNasImageUpdates(baseUrl, username, password)
    .then(available => { this.imageUpdateAvailable = available })
    .catch(() => {})
}, 12 * 60 * 60 * 1000)  // 12 hours = 2x per day
```

---

## Common Pitfalls

### Pitfall 1: Plex Returns XML by Default
**What goes wrong:** Axios call to `/status/sessions` returns XML string, JSON.parse fails silently or throws.
**Why it happens:** Plex's default `Content-Type` response is `text/xml` unless `Accept: application/json` is sent.
**How to avoid:** Always send `Accept: application/json` header. Also set `X-Plex-Token` as a header, not a query param (cleaner and avoids token leaking into server logs).
**Warning signs:** `response.data` is a string starting with `<?xml`

### Pitfall 2: DSM Session Expiry Mid-Flight
**What goes wrong:** Adapter calls DSM API, gets `{ "success": false, "error": { "code": 119 } }`. Next poll cycle works because session auto-renewed. But the first failure creates a brief stale snapshot.
**Why it happens:** Default DSM session validity is ~30 minutes. If the NAS adapter hasn't polled in a while (app restart, etc.), the cached sid may be stale.
**How to avoid:** On any `success: false` response, check error code 119 (Invalid session), call re-auth, retry the original request once. Store `validUntil` and pro-actively re-auth when within 60 seconds of expiry.
**Warning signs:** `status: 'stale'` in NAS metrics after app restart

### Pitfall 3: Pi-hole Session Validity Extension
**What goes wrong:** Developer assumes 300-second session requires a separate keepalive timer. Adds complexity unnecessarily.
**Why it happens:** Documentation says `validity: 300` and some readers interpret this as a fixed timeout.
**How to avoid:** Pi-hole sessions are extended on each authenticated API call. Since we poll every 60 seconds, the session stays alive automatically. Only need to re-auth when a 401 response is received. No separate keepalive timer needed.

### Pitfall 4: NAS Fan/Docker Data Assumed Present
**What goes wrong:** Frontend renders fan speed section with "N/A" for fanless NAS models, or crashes accessing `fans[0]` when `fans` is undefined.
**Why it happens:** `NasStatus.fans` is optional per D-19, but code may assume it's always present.
**How to avoid:** Conditional rendering throughout: `{nas.fans && nas.fans.length > 0 && <FanSection fans={nas.fans} />}`. Backend adapter sets `fans: undefined` (not `fans: []`) when DSM returns no fan data, so the frontend can use a simple truthiness check.

### Pitfall 5: settings.ts VALID_SERVICES Not Updated
**What goes wrong:** Saving Pi-hole/Plex/NAS config via the new Settings tabs returns HTTP 400 "Unknown service".
**Why it happens:** `isValidService()` check in settings.ts blocks unknown service IDs.
**How to avoid:** Update `VALID_SERVICES` constant and add test-connection handlers for all three new services before wiring the frontend tabs.

### Pitfall 6: TranscodeSession.progress vs viewOffset
**What goes wrong:** Progress bar in StreamRow shows wrong value (e.g., 100% transcode encode vs 30% playback).
**Why it happens:** `TranscodeSession.progress` is the encoder's progress through the file, not the viewer's playback position.
**How to avoid:** Always use `(session.viewOffset / session.duration) * 100` for playback progress.

---

## Frontend Patterns

### AppHeader NAS Panel Layout

The AppHeader currently shows a static 3-column gauge strip. Phase 4 refactors it to:
1. Make the center gauge strip clickable (`role="button"`, `cursor: pointer`)
2. Show the collapsed D-16 metrics: CPU%, RAM%, net up/down Mbps, disk %, CPU temp
3. On click, expand a panel below the header bar using Framer Motion (same `height: auto` pattern as NowPlayingBanner, but dropping down instead of up)
4. Expanded panel shows D-17 content: per-disk rows, Docker row, fan rows, image update LED

The panel should overlap the dashboard content (no layout shift) — use `position: absolute` with `top: 44px` (header height) and appropriate `z-index` (same layer as NowPlayingBanner expanded state ≈ 30).

### NowPlayingBanner Server Stats Section

The expanded drawer currently only shows `StreamRow` per stream. Phase 4 adds a "PLEX SERVER" section below the stream list when `plexServerStats` is provided:

```tsx
{plexServerStats && (
  <div style={{ borderTop: '1px solid rgba(232,160,32,0.2)', paddingTop: '8px' }}>
    <DotLeaderRow label="CPU" value={`${plexServerStats.processCpuPercent.toFixed(1)}%`} />
    <DotLeaderRow label="RAM" value={`${plexServerStats.processRamPercent.toFixed(1)}%`} />
    <DotLeaderRow label="BANDWIDTH" value={`${plexServerStats.bandwidthMbps.toFixed(1)} Mbps`} />
  </div>
)}
```

### Pi-hole Detail View

`ServiceDetailPage.tsx` dispatches on `serviceId`. Add a `PiholeDetailView` component similar to `ArrDetailView`. Uses the existing `DotLeaderRow` pattern.

### "NO ACTIVE STREAMS" State (D-11)

Currently NowPlayingBanner returns `null` when `streams.length === 0`. Phase 4 changes this: when Plex is configured but no streams active, render the collapsed rail with `"NO ACTIVE STREAMS"` in dim text (not null). Only `return null` when Plex is not configured at all.

---

## Runtime State Inventory

This phase adds new credentials to the SQLite database. There is no existing runtime state to rename or migrate. The `serviceConfig` table will receive new rows for `pihole`, `plex`, and `nas` when the user saves settings.

If a `username` column is added to `serviceConfig` (recommended), a Drizzle migration must run on startup. Drizzle Kit handles this via `drizzle-kit migrate` — this is a `ADD COLUMN ... DEFAULT ''` which is non-destructive and safe on the existing rows.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `serviceConfig` table — existing rows for arr/sabnzbd unaffected | No migration needed for existing rows; new `username` column added with default `''` |
| Live service config | None — Pi-hole/Plex/NAS not yet configured in app | None |
| OS-registered state | None | None |
| Secrets/env vars | `ENCRYPTION_KEY_SEED` already present — used for encrypting new passwords | None — same key used |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|---------|
| Node.js | Backend runtime | Yes | v25.8.1 | — |
| npm | Package manager | Yes | 11.11.0 | — |
| Vitest | Test runner | Yes | 4.1.2 | — |
| Pi-hole v6 instance | Pi-hole adapter testing | Unknown | — | Mock adapter tests with nocked responses |
| Plex Media Server instance | Plex adapter testing | Unknown | — | Mock adapter tests with nocked responses |
| Synology DSM 7.x | NAS adapter testing | Unknown | — | Mock adapter tests with nocked responses |

**Note on live service availability:** All three adapters can be fully unit-tested with mocked axios responses (same pattern as `arr-adapter.test.ts`). Live service availability is only needed for end-to-end manual verification, which is part of the phase success criteria check.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `/Users/Oreo/Projects/Coruscant/vitest.config.ts` |
| Quick run command | `npx vitest run packages/backend` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SVCRICH-01 | Pi-hole adapter returns correct metrics from `/api/stats/summary` + `/api/dns/blocking` | unit | `npx vitest run packages/backend/src/__tests__/pihole-adapter.test.ts` | No — Wave 0 |
| SVCRICH-01 | Pi-hole adapter returns `status: 'offline'` on network error | unit | same file | No — Wave 0 |
| SVCRICH-01 | Pi-hole adapter returns amber (`status: 'warning'`) when blocking disabled | unit | same file | No — Wave 0 |
| SVCRICH-01 | Pi-hole re-authenticates when 401 received | unit | same file | No — Wave 0 |
| SVCRICH-02 | Tautulli webhook maps payload to `PlexStream[]` correctly | unit | `npx vitest run packages/backend/src/__tests__/tautulli-webhook.test.ts` | No — Wave 0 |
| SVCRICH-02 | Tautulli webhook detects transcode vs direct-play correctly | unit | same file | No — Wave 0 |
| SVCRICH-02 | Tautulli webhook extracts progress from payload | unit | same file | No — Wave 0 |
| SVCRICH-03 | NAS adapter parses CPU/RAM/network from SYNO.Core.System.Utilization | unit | `npx vitest run packages/backend/src/__tests__/nas-adapter.test.ts` | No — Wave 0 |
| SVCRICH-04 | NAS adapter includes disk temps from SYNO.Core.System info | unit | same file | No — Wave 0 |
| SVCRICH-04 | NAS adapter omits `fans` field when fan response is empty | unit | same file | No — Wave 0 |
| SVCRICH-04 | NAS adapter re-auths on DSM error code 119 | unit | same file | No — Wave 0 |
| SVCRICH-05 | ServiceDetailPage renders Pi-hole detail view when serviceId is 'pihole' | smoke/manual | Visual verify on dev server | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/backend`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/backend/src/__tests__/pihole-adapter.test.ts` — covers SVCRICH-01 (4 cases)
- [ ] `packages/backend/src/__tests__/tautulli-webhook.test.ts` — covers SVCRICH-02 (4 cases)
- [ ] `packages/backend/src/__tests__/nas-adapter.test.ts` — covers SVCRICH-03, SVCRICH-04 (4 cases)

---

## Open Questions

1. **SYNO.Docker.Image `is_update_available` field name**
   - What we know: `SYNO.Docker.Image` API exists; `method=list` lists images
   - What's unclear: Exact field name for update availability; may be `update_available`, `is_update_available`, or `has_update`
   - Recommendation: Implement with defensive check — if field is absent, `imageUpdateAvailable = false`. Verify field name against live DSM with Container Manager installed.

2. **SYNO.Core.Hardware.FanSpeed response structure**
   - What we know: API exists in DSM; `method=get` is standard
   - What's unclear: Whether `fan_speed[].rpm` is the actual field name; whether NAS models without fans return `success: false` or `success: true` with empty array
   - Recommendation: Wrap the fan API call in try/catch; set `fans: undefined` on any error or empty result.

3. **Pi-hole `/api/info/system` field names for load/memory**
   - What we know: Endpoint returns CPU load averages and memory usage; system load comes from `/proc/loadavg`
   - What's unclear: Exact nested field path — `system.cpu.load` vs `cpu.load_avg` vs something else
   - Recommendation: Log raw response in development; add a fallback to `0` for all numeric fields. This is low-risk because Pi-hole system stats are secondary to the core DNS stats.

4. **DSM re-auth on `success: false` error code**
   - What we know: DSM returns `{ "success": false, "error": { "code": 119 } }` for invalid session
   - What's unclear: Whether other error codes (e.g., 105: insufficient permissions) also warrant re-auth
   - Recommendation: Only re-auth on code 119. Other codes should surface as `status: 'offline'` with the error code in metrics.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 4 |
|-----------|------------------|
| Docker/NAS only — no exotic runtimes | All adapter code runs in Node.js; no native binaries added |
| Privacy — no cloud telemetry | All API calls go to LAN services only (Pi-hole, Plex, DSM) |
| `node:22-slim` (not Alpine) | No change — existing Docker base image |
| Framer Motion for animations | NAS header drawer uses Framer Motion (same as NowPlayingBanner) |
| SSE not WebSocket | No change — existing SSE pipeline extended |
| Drizzle ORM for DB | Schema migration (optional `username` column) uses Drizzle Kit |
| Vitest for testing | All new adapter tests use Vitest with vi.mock(axios) pattern |
| No Redux/Zustand | NAS expanded state: local `useState` in AppHeader |
| SQLite (better-sqlite3) | `serviceConfig` table extended; no new tables needed |

---

## Sources

### Primary (HIGH confidence)
- [Pi-hole API Auth Documentation](https://docs.pi-hole.net/api/auth/) — auth endpoint, session fields, validity, logout
- [Plex Sessions API — plexopedia](https://www.plexopedia.com/plex-media-server/api/server/sessions/) — session response XML/JSON field names
- [Plex Statistics Resources field names](https://plexapi.dev/api-reference/statistics/get-resources-statistics) — StatisticsResources JSON structure verified
- [gethomepage Pi-hole v6 discussion](https://github.com/gethomepage/homepage/discussions/4841) — confirms `/api/stats/summary` and `/api/dns/blocking` as working endpoints

### Secondary (MEDIUM confidence)
- [homebridge-synology API docs](https://npmdoc.github.io/node-npmdoc-homebridge-synology/build/apidoc.html) — SYNO.Core.System.Utilization cpu/memory/network field names with request format
- [Synology DSM 6 API query gist](https://gist.github.com/ivaniskandar/5c9d00d7577b49c43ce960a18971ab81) — API registry paths, confirms entry.cgi for all modern DSM APIs
- [Synology API Python docs](https://n4s4.github.io/synology-api/docs/apis) — API name registry including SYNO.Core.Hardware.FanSpeed, SYNO.Docker.Image
- [Plex status.js gist (Dirrk)](https://gist.github.com/Dirrk/608642bd820849736ad2) — Session XML field names including grandparentTitle, parentIndex, index, TranscodeSession
- [Pi-hole Userspace forum — stats via API](https://discourse.pi-hole.net/t/is-it-possible-to-get-system-stats-via-api/65251) — confirms /api/info/system endpoint history

### Tertiary (LOW confidence — flag for validation)
- SYNO.Core.Hardware.FanSpeed `fan_speed[].rpm` field names — inferred from naming convention, not directly documented
- SYNO.Docker.Image `is_update_available` field name — inferred from standard boolean naming
- Pi-hole `/api/info/system` `system.cpu.load[]` and `system.memory.ram.used` field path — inferred from changelog description

---

## Metadata

**Confidence breakdown:**
- Pi-hole v6 auth and stats endpoints: HIGH — verified from official docs and community implementations
- Plex sessions API: HIGH — multiple cross-referenced sources with actual field names
- Plex statistics/resources: HIGH — JSON example with exact field names found
- Synology CPU/RAM/network: MEDIUM — field names from homebridge-synology docs; request format from community gist
- Synology disk temperature: MEDIUM — `hdd_info[].temp` field confirmed from homebridge-synology
- Synology fan API: LOW — API name confirmed but field names inferred
- Synology Docker image update: LOW — API name confirmed but field names inferred
- Pi-hole /api/info/system fields: MEDIUM — endpoint confirmed from changelog, field path inferred

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (30 days for stable home services APIs; Pi-hole is the most actively changing)
