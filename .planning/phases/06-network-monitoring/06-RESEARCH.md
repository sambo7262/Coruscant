# Phase 6: Network Monitoring - Research

**Researched:** 2026-04-05
**Domain:** UniFi Network Integration API + adapter/UI wiring pattern
**Confidence:** MEDIUM-HIGH (API field names verified via community implementations; state enum confirmed via multiple sources; WAN endpoint confirmed via homepage discussion; exact uptime type confirmed as integer seconds)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** WAN throughput displays as mini horizontal bars — one for TX (upload), one for RX (download).
**D-02:** TX bar color: red (`#FF4444` — upload). RX bar color: blue (`#00c8ff` — download/cockpit blue).
**D-03:** Bars scale dynamically to the peak observed throughput, with a 6-hour rolling window reset. No user-configured max baseline needed.
**D-04:** Card body layout (right UBIQUITI section):
```
UBIQUITI
● ONLINE  42 clients
TX ████░░ 250M  (red bar)
RX █░░░░░  15M  (blue bar)
```
**D-05:** Health LED rollup — gateway-first logic: GREEN=all online, AMBER=AP/switch offline, RED=gateway offline.
**D-06:** Device type classification: UDM/UDMP/UDR = gateway, USW = switch, U6/UAP/UAL/UAE = access point. Unrecognized = non-critical (amber on failure).
**D-07:** Settings tab has 2 fields only: UniFi Controller URL + API Token (masked, eye-toggle).
**D-08:** Default site only — no site selector. Backend always queries `default` site. Auth header: `X-API-KEY: <token>`.
**D-09:** TEST CONNECTION calls `GET /proxy/network/integration/v1/sites`. Success returns site name; failure shows error.
**D-10:** Devices grouped by type: GATEWAYS, SWITCHES, ACCESS POINTS. Section headers use amber mono label style.
**D-11:** Each device row: `● [model name]  up [uptime]  [N] clients`. Offline: `✕` instead of `●`, omit client count.
**D-12:** No IP address, no firmware version in list — just model, uptime, client count.
**D-13:** Detail view is scrollable.
**D-14:** Poll interval: 30 seconds.
**D-15:** Auth: `X-API-KEY` header. Base path: `/proxy/network/integration/v1/`.
**D-16:** Three endpoints:
  1. `GET /sites` — on startup only, resolve default site ID
  2. `GET /sites/{siteId}/devices` — every 30s
  3. `GET /sites/{siteId}/clients` — every 30s, use `totalCount` for active client count
**D-17:** WAN throughput — researcher must distinguish Local Integration API vs. community stat/health endpoint. See findings below.
**D-18:** `state` field values confirmed as lowercase strings — see findings.
**D-19:** `uptime` field is integer seconds — confirmed.

### Claude's Discretion

- Exact bar width/height in pixels for TX/RX bars (keep consistent with existing compact card instruments)
- Peak throughput tracking: in-memory per adapter instance (not persisted to DB), reset every 6 hours via a `setTimeout`
- Uptime formatting: display as `14d 3h` format, drop minutes

### Deferred Ideas (OUT OF SCOPE)

None declared in CONTEXT.md.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NET-01 | UniFi card shows active client count, WAN throughput (rx/tx), and overall network health state | Clients from `/sites/{siteId}/clients` `totalCount`; WAN from `/proxy/network/api/s/default/stat/health` WAN subsystem `tx_bytes-r`/`rx_bytes-r`; health state from D-05 LED rollup logic |
| NET-02 | UniFi card shows per-device status (APs, switches, gateways) with online/offline state | Devices from `/sites/{siteId}/devices`; state field is lowercase string (online/offline); model prefix determines type classification per D-06 |
| NET-03 | UniFi detail view lists all monitored devices with uptime, model, and connected client count | Devices endpoint returns `model`, `uptime` (integer seconds), `features.access_point.num_sta` (AP client count); format uptime as Xd Yh |
| NET-04 | Backend authenticates via static API token — no session management or re-auth logic | X-API-KEY header; stateless; no session cache needed; simpler than pihole/nas adapters |
</phase_requirements>

---

## Summary

Phase 6 wires UniFi network equipment into the Coruscant dashboard. The backend work is structurally simpler than previous adapters (no session management — static token per D-08) but requires navigating two distinct UniFi API surfaces. The **Local Network Integration API** (`/proxy/network/integration/v1/`) handles devices and clients with the API key. The **community stat/health endpoint** (`/proxy/network/api/s/default/stat/health`) provides WAN rx/tx rates, and community evidence confirms it also accepts the X-API-KEY header (no cookie auth required on UniFi OS).

The frontend work is a clean replacement of the existing UBIQUITI "NOT CONFIGURED" placeholder in `NetworkInstrument()` with live data, plus a new UniFi detail view component in `ServiceDetailPage.tsx`. The settings tab adds `'unifi'` to the existing SERVICES array — two fields only (URL + token), no username.

**Primary recommendation:** Use the X-API-KEY header uniformly across all three UniFi endpoints. Research strongly suggests `/proxy/network/api/s/default/stat/health` accepts the same token. If the controller rejects this endpoint with 401/403, fall back to displaying WAN stats as `—` (dim placeholder, no bars) with a code comment explaining why, per D-17.

---

## Standard Stack

### Core (all established in Phases 1-5 — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| axios | 1.x | HTTP client for UniFi API polling | Already in use across all adapters; supports custom headers and timeout |
| TypeScript | 5.x/6.x | Adapter and shared type definitions | Project-wide; UniFi data shapes added to `@coruscant/shared` |
| React | 18.x | UBIQUITI card section and detail view | Frontend is React; NetworkInstrument and detail view are React components |
| Vitest | current | Adapter unit tests | Already configured at root `vitest.config.js` |

### No New Dependencies Required

This phase does not introduce any new npm packages. The entire implementation uses:
- `axios` — existing HTTP client
- `@coruscant/shared` — extend with UniFi types
- React inline styles — existing pattern for instrument components

**Installation:** None needed.

---

## Architecture Patterns

### Established Adapter Pattern (follow exactly)

All adapters export one poll function. The function:
1. Accepts `baseUrl` and `apiKey` (string parameters, not objects)
2. Returns `ServiceStatus` with `metrics` populated
3. Never throws — catches all errors and returns `status: 'offline'` with `metrics.error`
4. Uses `TIMEOUT_MS = 10_000` constant

UniFi adapter deviates from pihole/nas in one key way: **no session management**. The token is static. No `ensureSession()`, no session cache, no retry-on-401.

```typescript
// packages/backend/src/adapters/unifi.ts — structure
export async function pollUnifi(baseUrl: string, apiKey: string): Promise<ServiceStatus>
```

### Startup Site-ID Resolution

The adapter needs the site ID (e.g., `'hqjafkuy'`) to build the `/sites/{siteId}/devices` URL. The site-resolution call (`GET /sites`) must happen once at startup before the 30s polling loop begins.

Pattern to follow: the NAS adapter's `checkNasImageUpdates` — a one-time async call that runs immediately, then a separate 12h repeating timer. Apply the same structure: resolve site ID on first poll, cache it in module-level variable, reuse on every subsequent poll.

```typescript
// Module-level cache — survives across poll invocations
let cachedSiteId: string | null = null

async function resolveSiteId(baseUrl: string, apiKey: string): Promise<string> {
  if (cachedSiteId) return cachedSiteId
  const res = await axios.get(`${baseUrl}/proxy/network/integration/v1/sites`, {
    headers: { 'X-API-KEY': apiKey },
    timeout: TIMEOUT_MS,
  })
  // API returns { data: [{ siteId: '...', internalId: '...', ... }] }
  const sites: Array<{ siteId: string; name: string }> = res.data?.data ?? []
  const defaultSite = sites.find((s) => s.name.toLowerCase() === 'default') ?? sites[0]
  if (!defaultSite) throw new Error('No UniFi sites found')
  cachedSiteId = defaultSite.siteId
  return cachedSiteId
}
```

### PollManager Integration

New entries required in `poll-manager.ts`:

```typescript
// Add to ALL_SERVICE_IDS:
const ALL_SERVICE_IDS = [
  'radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd',
  'pihole', 'plex', 'nas', 'unifi',  // <-- add 'unifi'
]

// Add to idToName():
unifi: 'UniFi',

// Add to idToTier():
if (id === 'unifi') return 'rich'

// Add to reload() doPoll — after pihole, before ARR_SERVICES:
} else if (serviceId === 'unifi') {
  result = await pollUnifi(baseUrl, apiKey)
}

// Interval: 30s (D-14)
const UNIFI_INTERVAL_MS = 30_000
```

### Settings Route Integration

Three files need `'unifi'` added to their `VALID_SERVICES` array:
- `packages/backend/src/routes/settings.ts`
- `packages/backend/src/routes/test-connection.ts`

The `serviceConfig` SQLite table already supports arbitrary `serviceName` values — no schema migration needed. UniFi uses only `baseUrl` + `encryptedApiKey` (no username field, since D-08 is token-only).

### Frontend Settings Tab

SettingsPage.tsx `SERVICES` array gains one entry:
```typescript
{ id: 'unifi', label: 'UBIQUITI' }
```

The `getCredentialLabel()` function gains one branch:
```typescript
if (serviceId === 'unifi') return 'API Token'
```

No new state variables needed — the existing `url`/`apiKey`/`showKey` pattern covers the 2-field UniFi tab. No username field (unlike NAS). No webhook section (unlike Plex).

### NetworkInstrument Component Replacement

`ServiceCard.tsx` `NetworkInstrument()` currently renders an unconditional two-column layout. After Phase 6, it must conditionally display UniFi data or the "NOT CONFIGURED" placeholder based on whether UniFi is configured in the snapshot.

The component receives `metrics` from the Pi-hole `ServiceStatus`. UniFi data arrives as a separate service in `snapshot.services`. The `NetworkInstrument` function needs access to the UniFi `ServiceStatus` — pass it as a second prop:

```typescript
// New signature:
function NetworkInstrument({
  metrics,
  unifiService,
}: {
  metrics: Record<string, unknown>
  unifiService?: ServiceStatus
})
```

### UniFi Detail View

New component `UnifiDetailView` in `ServiceDetailPage.tsx`. Added as a new branch in the detail page router (parallel to `PiholeDetailView`, `SabnzbdDetailView`, etc.).

The detail view receives the UniFi `ServiceStatus` from `snapshot.services`. Device list comes from `metrics.devices` array.

### Recommended Project Structure (additions only)

```
packages/
├── backend/src/
│   ├── adapters/
│   │   └── unifi.ts          # NEW — pollUnifi() export
│   └── routes/
│       ├── settings.ts       # EDIT — add 'unifi' to VALID_SERVICES
│       └── test-connection.ts # EDIT — add 'unifi' case
├── shared/src/
│   └── types.ts              # EDIT — add UnifiDevice, UnifiMetrics types
└── frontend/src/
    ├── components/cards/
    │   └── ServiceCard.tsx   # EDIT — replace UBIQUITI placeholder
    └── pages/
        └── ServiceDetailPage.tsx # EDIT — add UnifiDetailView
```

---

## UniFi API: Verified Field Names and Endpoint Details

### Authentication (HIGH confidence — confirmed from official help docs + community)

- Header: `X-API-KEY: <token>`
- Token generated in UniFi Network: Settings > Control Plane > Integrations (or similar per version)
- Local API prefix for UniFi OS: `/proxy/network/integration/v1/`
- No session lifecycle needed — token is stateless

### Endpoint 1: Sites Listing (MEDIUM confidence)

```
GET {baseUrl}/proxy/network/integration/v1/sites
Headers: X-API-KEY: <token>
```

Response shape:
```json
{
  "data": [
    {
      "siteId": "hqjafkuy",
      "internalId": "default",
      "name": "Default",
      "meta": { ... }
    }
  ]
}
```

**D-09 TEST CONNECTION:** This is the verification endpoint. On success, extract `data[0].name` and return "Connected — Default" (or the site name).

### Endpoint 2: Devices (MEDIUM confidence — field names from unifi-network-mcp source + HA integration)

```
GET {baseUrl}/proxy/network/integration/v1/sites/{siteId}/devices
Headers: X-API-KEY: <token>
```

Confirmed device fields:
| Field | Type | Notes |
|-------|------|-------|
| `macAddress` | string | Unique device identifier |
| `model` | string | e.g. `"U6-Pro"`, `"USW-24-PoE"`, `"UDR"` |
| `name` | string | User-assigned friendly name |
| `ipAddress` | string | Current IP |
| `firmwareVersion` | string | Not displayed (D-12) |
| `state` | string | See state values below |
| `uptime` | number | **Integer seconds** (e.g. `1209600` = 14 days) |
| `features` | object | Contains `access_point.num_sta` (client count per AP) |

**State field values (MEDIUM confidence — from HA integration source + community):**

The state field returns lowercase strings from the Integration API (note: older community-api returns integer codes; Integration API uses strings):

| State value | Meaning | LED |
|-------------|---------|-----|
| `"online"` | Device online | Green |
| `"offline"` | Device unreachable | Red |
| `"pendingAdoption"` | Not yet adopted | Amber |
| `"updating"` | Firmware updating | Amber |
| `"gettingReady"` | Booting | Amber |
| `"adopting"` | Being adopted | Amber |
| `"connectionInterrupted"` | Intermittent | Red |
| `"isolated"` | Isolated | Red |

For display: `"online"` → green LED dot; anything else → red X.

**Client count per device:** The `features` object shape is `{ "access_point": { "num_sta": 12 } }` for APs. Switches and gateways may not have this field. Use `features?.access_point?.num_sta ?? 0` for the per-device client count displayed in detail view.

### Endpoint 3: Clients (MEDIUM confidence)

```
GET {baseUrl}/proxy/network/integration/v1/sites/{siteId}/clients
Headers: X-API-KEY: <token>
```

Response shape:
```json
{
  "totalCount": 42,
  "data": [ ... ]
}
```

Use `totalCount` for the aggregate active client count shown in the card body. Do not iterate the `data` array — only the count is needed (D-04).

### WAN Throughput: Community stat/health Endpoint (MEDIUM confidence)

**Key finding:** The Local Integration API (`/proxy/network/integration/v1/`) does NOT expose real-time WAN rx/tx rates. The community-documented `stat/health` endpoint does.

```
GET {baseUrl}/proxy/network/api/s/default/stat/health
Headers: X-API-KEY: <token>
```

This endpoint returns a `health` array. The WAN subsystem entry contains:

```json
{
  "subsystem": "wan",
  "tx_bytes-r": 12500000,
  "rx_bytes-r": 87000000,
  "status": "ok",
  "num_gw": 1,
  "num_adopted": 1
}
```

**Field interpretation:**
- `tx_bytes-r` — WAN TX bytes per second (bytes/s, not Mbps — must divide by 125000 for Mbps)
- `rx_bytes-r` — WAN RX bytes per second
- Both are **real-time** rates (not cumulative), derived from controller polling

**Source:** Homepage integration discussion (github.com/gethomepage/homepage/discussions/4753) confirmed this endpoint returns `tx_bytes-r`/`rx_bytes-r` in the WAN subsystem and works with X-API-KEY on UDR-7 (UniFi OS 4.x / Network App 10.x). Controller version for this project is OS 5.x — same API surface expected.

**Conversion for display:**
```typescript
const txMbps = (wanSubsystem['tx_bytes-r'] ?? 0) / 125_000  // bytes/s → Mbps
const rxMbps = (wanSubsystem['rx_bytes-r'] ?? 0) / 125_000
```

**Note on field name:** The field name uses a literal hyphen: `tx_bytes-r`. In TypeScript, access as `data['tx_bytes-r']` not `data.tx_bytes-r`.

**If endpoint returns 401/403:** Fall back to `wanTxMbps: null` / `wanRxMbps: null` in adapter. Frontend shows `—` dim placeholder with no bars (per D-17 fallback). Add comment: `// stat/health requires session auth on some controllers — API key auth may not work.`

---

## Shared Types to Add

Add to `packages/shared/src/types.ts`:

```typescript
export interface UnifiDevice {
  macAddress: string
  model: string
  name: string
  state: string          // 'online' | 'offline' | 'pendingAdoption' | ...
  uptime: number         // seconds (integer)
  clientCount: number    // from features.access_point.num_sta or 0
}

export interface UnifiMetrics {
  clientCount: number         // from /clients totalCount
  wanTxMbps: number | null    // null if stat/health unavailable
  wanRxMbps: number | null
  peakTxMbps: number          // rolling 6h peak for bar scaling
  peakRxMbps: number
  devices: UnifiDevice[]
  healthStatus: 'online' | 'warning' | 'offline'  // derived from D-05 rollup
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UniFi session management | Cookie auth, re-login logic | X-API-KEY header (static) | Token is stateless; no session needed per D-08 |
| Peak throughput persistence | SQLite storage of peak values | In-memory module variable + setTimeout reset | Data is ephemeral; resets on container restart is acceptable; DB adds complexity with no benefit |
| Uptime formatting | External date library | Simple arithmetic function | `Math.floor(seconds/86400)` → days, remainder → hours; no library needed |
| Per-device client count aggregation | Separate API call | `features.access_point.num_sta` from devices response | Already in the device payload |
| Bar width calculation | Canvas/SVG rendering | Inline CSS `width: ${(value/peak)*100}%` | Matches existing compact instrument style; no new rendering primitive needed |

**Key insight:** UniFi's static token auth eliminates the most complex part of other adapters. The adapter is the simplest in the codebase — no session cache, no retry-on-auth-failure.

---

## Common Pitfalls

### Pitfall 1: Confusing the Two UniFi API Surfaces

**What goes wrong:** Trying to get WAN throughput from `/proxy/network/integration/v1/` — it doesn't expose it. OR using session/cookie auth for the Integration API instead of X-API-KEY.
**Why it happens:** Ubiquiti has at least three API surfaces (Integration API, Site Manager API, community-reverse-engineered Network API). They have different auth models and different data.
**How to avoid:** Integration API = X-API-KEY + `/proxy/network/integration/v1/` for devices/clients. Community endpoint = same X-API-KEY + `/proxy/network/api/s/default/stat/health` for WAN rates. Site Manager API (developer.ui.com) = cloud, NOT for this project.
**Warning signs:** 401 from integration endpoints → wrong header. 404 from stat/health → wrong path (confirm `/proxy/network/api/s/default/stat/health`, not `/proxy/network/integration/v1/...`).

### Pitfall 2: Field Name with Literal Hyphen

**What goes wrong:** `device.tx_bytes-r` is parsed as `device.tx_bytes` minus `r` (JavaScript subtraction). Zero values appear in bars.
**Why it happens:** The API field is literally named `tx_bytes-r` with a hyphen, not an underscore.
**How to avoid:** Always access as `data['tx_bytes-r']` using bracket notation.
**Warning signs:** Bar values always show 0 despite network activity.

### Pitfall 3: Bytes vs. Mbps Confusion

**What goes wrong:** Displaying raw `tx_bytes-r` value (e.g., `12500000`) as Mbps — bars always appear at maximum, display reads `12500000M`.
**Why it happens:** The field is bytes per second, not megabits per second.
**How to avoid:** Divide by `125_000` (1 Mbit/s = 125,000 bytes/s).
**Warning signs:** Throughput values far exceed realistic WAN speeds.

### Pitfall 4: Peak Reset Leaking Across Hot-Reloads

**What goes wrong:** When the user saves new UniFi credentials, `reload()` is called — but the in-memory peak and `cachedSiteId` from the old config persist, causing the new connection to use stale site IDs.
**Why it happens:** Module-level variables survive across adapter function calls.
**How to avoid:** The adapter module should export a `resetUnifiCache()` function. Call it from `PollManager.reload()` when `serviceId === 'unifi'` and config is not null (reconfiguration) or when config is null (removal). This ensures fresh site ID resolution after credential changes.
**Warning signs:** After saving new URL, adapter still polls old site ID's devices.

### Pitfall 5: Gateway-First Health LED — Order of Evaluation

**What goes wrong:** LED shows GREEN even when gateway is offline, because AP/switch check runs first and short-circuits to AMBER before checking gateway.
**Why it happens:** Incorrect condition order in health rollup.
**How to avoid:** Per D-05, evaluate gateway FIRST:
```typescript
const gateways = devices.filter(d => isGateway(d.model))
const nonGateways = devices.filter(d => !isGateway(d.model))
if (gateways.some(d => d.state !== 'online')) return 'offline'  // RED — check first
if (nonGateways.some(d => d.state !== 'online')) return 'warning' // AMBER — check second
return 'online'  // GREEN — all online
```

### Pitfall 6: `ServiceStatus` vs. `UnifiMetrics` Shape Mismatch

**What goes wrong:** `metrics.devices` arrives as `undefined` in the frontend because the adapter puts it under a different key, or the type assertion `as Record<string, unknown>` loses the nested array.
**Why it happens:** TypeScript doesn't enforce `metrics` shape at runtime — `Record<string, unknown>` accepts anything.
**How to avoid:** Define `UnifiMetrics` in `@coruscant/shared`, cast explicitly in adapter output: `metrics: { ...unifiMetrics } as unknown as Record<string, unknown>`. In frontend, reverse-cast: `const unifiMetrics = metrics as unknown as UnifiMetrics`.

---

## Code Examples

### Uptime Formatting

```typescript
// Source: standard arithmetic, no library
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}
// formatUptime(1209600) → '14d 0h'
// formatUptime(3600 * 5) → '5h'
```

### Model-to-Type Classification (D-06)

```typescript
// Source: decisions D-06
type DeviceType = 'gateway' | 'switch' | 'ap' | 'unknown'

function classifyModel(model: string): DeviceType {
  const m = model.toUpperCase()
  if (m.startsWith('UDM') || m.startsWith('UDMP') || m.startsWith('UDR')) return 'gateway'
  if (m.startsWith('USW')) return 'switch'
  if (m.startsWith('U6') || m.startsWith('UAP') || m.startsWith('UAL') || m.startsWith('UAE')) return 'ap'
  return 'unknown'
}
```

### Health LED Rollup (D-05)

```typescript
// Source: decisions D-05, D-06
function computeHealthStatus(devices: UnifiDevice[]): 'online' | 'warning' | 'offline' {
  const gateways = devices.filter(d => classifyModel(d.model) === 'gateway')
  const others = devices.filter(d => classifyModel(d.model) !== 'gateway')

  if (gateways.length === 0 || gateways.some(d => d.state !== 'online')) return 'offline'
  if (others.some(d => d.state !== 'online')) return 'warning'
  return 'online'
}
```

### WAN Throughput from stat/health

```typescript
// Source: gethomepage discussion #4753 (MEDIUM confidence)
const healthRes = await axios.get(`${baseUrl}/proxy/network/api/s/default/stat/health`, {
  headers: { 'X-API-KEY': apiKey },
  timeout: TIMEOUT_MS,
})
const healthData: Array<{ subsystem: string; 'tx_bytes-r'?: number; 'rx_bytes-r'?: number }> =
  healthRes.data?.data ?? []
const wan = healthData.find(s => s.subsystem === 'wan')
const txMbps = wan ? (wan['tx_bytes-r'] ?? 0) / 125_000 : null
const rxMbps = wan ? (wan['rx_bytes-r'] ?? 0) / 125_000 : null
```

### TX/RX Bar Rendering (D-01, D-02, D-03)

```tsx
// Source: project decisions D-01 through D-04
// peak is stored in adapter, passed through metrics
function ThroughputBar({
  value,
  peak,
  color,
  label,
}: {
  value: number | null
  peak: number
  color: string
  label: string
}) {
  const pct = value !== null && peak > 0 ? Math.min((value / peak) * 100, 100) : 0
  const display = value !== null ? `${value >= 1 ? Math.round(value) : value.toFixed(1)}M` : '—'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '8px', color: 'var(--text-offwhite)', fontFamily: 'var(--font-mono)', width: '14px' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '4px', background: '#222', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '8px', color: 'var(--text-offwhite)', fontFamily: 'var(--font-mono)', width: '32px', textAlign: 'right' }}>
        {display}
      </span>
    </div>
  )
}
```

### Peak Reset Pattern (D-03)

```typescript
// In adapter module — in-memory, not persisted
let peakTxMbps = 0
let peakRxMbps = 0
const PEAK_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours

function schedulePeakReset() {
  setTimeout(() => {
    peakTxMbps = 0
    peakRxMbps = 0
    schedulePeakReset() // restart the 6h timer
  }, PEAK_WINDOW_MS)
}

// Call schedulePeakReset() once when module initializes.
// Export resetUnifiCache() to clear siteId + peaks on reconfiguration.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UniFi cookie/session auth | Static API token via X-API-KEY | UniFi OS 3.x (2023) | No session management needed; tokens generated in controller UI |
| `/api/` prefix (classic controller) | `/proxy/network/api/` prefix (UniFi OS) | UDM introduction (~2020) | Must always prefix with `/proxy/network/` on this controller |
| Username/password POST to `/api/login` | `X-API-KEY` header | UniFi OS 3.x+ | REQUIREMENTS.md NET-04 listed "cookie session lifecycle" — this is now OBSOLETE (per CONTEXT.md note) |

**Deprecated/outdated:**
- Cookie/session auth (NET-04 original description): superseded by static token on UniFi OS 5.x.
- `/api/` prefix without `/proxy/network/`: only valid on classic self-hosted UniFi controllers, not UDM/UDR/UDM-Pro running UniFi OS.

---

## Open Questions

1. **Does `/proxy/network/api/s/default/stat/health` accept X-API-KEY on UniFi OS 5.x?**
   - What we know: Confirmed working on UDR-7 + UniFi OS 4.x (homepage discussion); community reports no cookie auth required when token is used.
   - What's unclear: UniFi OS 5.x may have tightened access controls on community endpoints.
   - Recommendation: Add a `/debug/unifi-stats` endpoint (consistent with project's debug endpoint pattern) that returns the raw `stat/health` response. If it returns 401/403, apply D-17 fallback gracefully. The adapter should not hard-fail — return `wanTxMbps: null` and log a comment.

2. **Exact shape of `features` field per device type**
   - What we know: `features.access_point.num_sta` is the client count per AP (confirmed from HA integration). Switches and gateways likely lack this field.
   - What's unclear: Do gateways expose a connected client count? Do switches expose per-port client counts?
   - Recommendation: Use `features?.access_point?.num_sta ?? 0` for all devices. If 0 for a non-AP device, display nothing or 0 — do not try to aggregate from a different field.

3. **`/proxy/network/integration/v1/sites` response shape for default site**
   - What we know: Endpoint confirmed. Response shape extrapolated from the MCP source and help center article.
   - What's unclear: Whether the default site's identifier is `"name": "Default"` or `"internalId": "default"`.
   - Recommendation: Match on `internalId === 'default'` first, fall back to `name.toLowerCase() === 'default'`, fall back to `sites[0]`. Cache the resolved ID.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | Yes | v25.8.1 (dev machine) | — |
| UniFi Controller | All UniFi endpoints | External (LAN) | UniFi OS 5.x (per CONTEXT.md) | — |
| axios | HTTP polling | Yes (installed) | 1.x | — |
| vitest | Adapter unit tests | Yes (root config) | current | — |

**Missing dependencies with no fallback:** None.

**Notes:**
- UniFi controller is a network service on LAN, not an installable dependency. Adapter gracefully returns `status: 'offline'` if unreachable.
- The adapter test file will use `vi.mock('axios')` — no live controller needed for CI.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `/vitest.config.js` (root) — `include: ['packages/*/src/__tests__/**/*.test.ts']` |
| Quick run command | `npm test -- --testPathPattern unifi` (or `vitest run packages/backend/src/__tests__/unifi-adapter.test.ts`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NET-01 | pollUnifi returns clientCount, wanTxMbps, wanRxMbps, healthStatus in metrics | unit | `npm test -- --reporter=verbose` | ❌ Wave 0 |
| NET-01 | pollUnifi returns wanTxMbps=null when stat/health returns 401 | unit | same | ❌ Wave 0 |
| NET-02 | devices array includes model, state, uptime; classifyModel() routes correctly | unit | same | ❌ Wave 0 |
| NET-02 | computeHealthStatus() returns 'offline' when gateway is offline | unit | same | ❌ Wave 0 |
| NET-02 | computeHealthStatus() returns 'warning' when only AP is offline | unit | same | ❌ Wave 0 |
| NET-03 | formatUptime(1209600) returns '14d 0h'; formatUptime(3600) returns '1h' | unit | same | ❌ Wave 0 |
| NET-04 | pollUnifi uses X-API-KEY header (not cookie, not Basic auth) | unit | same | ❌ Wave 0 |
| NET-04 | pollUnifi returns status:'offline' on network error (no throw) | unit | same | ❌ Wave 0 |
| NET-04 | test-connection route: unifi case calls GET /sites, returns site name | unit | `npm test -- settings` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` (full suite — fast, ~5s total; no integration tests that hit live services)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/backend/src/__tests__/unifi-adapter.test.ts` — covers NET-01, NET-02, NET-03, NET-04
  - Mock `axios` (same pattern as `pihole-adapter.test.ts` and `plex-adapter.test.ts`)
  - Test cases: happy path, stat/health 401 fallback, offline gateway detection, AP offline detection, formatUptime, classifyModel, header assertion

*(No new framework or config needed — existing vitest.config.js covers new test files automatically)*

---

## Sources

### Primary (HIGH confidence)

- [unifi-network-mcp GitHub (ryanbehan)](https://github.com/ryanbehan/unifi-network-mcp) — confirmed device field names: `macAddress`, `model`, `name`, `ipAddress`, `firmwareVersion`, `state`, `uptime`, `features`; confirmed endpoints and X-API-KEY auth
- Existing codebase: `packages/backend/src/adapters/pihole.ts`, `nas.ts` — adapter structure pattern
- Existing codebase: `packages/backend/src/poll-manager.ts` — PollManager integration pattern
- Existing codebase: `packages/frontend/src/pages/SettingsPage.tsx` — settings tab pattern
- Existing codebase: `packages/frontend/src/components/cards/ServiceCard.tsx` — NetworkInstrument placeholder location

### Secondary (MEDIUM confidence)

- [Homepage discussion #4753](https://github.com/gethomepage/homepage/discussions/4753) — confirmed `stat/health` endpoint returns WAN subsystem with `tx_bytes-r`/`rx_bytes-r`; confirmed X-API-KEY works with this endpoint on UniFi OS
- [ha-unifi-network GitHub](https://github.com/wittypluck/ha-unifi-network) — confirmed "Uplink RX Rate (bps)" and "Uplink TX Rate (bps)" available; device state enumeration: online/offline/pendingAdoption/updating/gettingReady/adopting/connectionInterrupted/isolated
- [UniFi Community Wiki API](https://www.ubntwiki.com/products/software/unifi-controller/api) — confirmed `/proxy/network/api/s/default/stat/health` endpoint path on UniFi OS
- [Ubiquiti Help Center — Getting Started with Official UniFi API](https://help.ui.com/hc/en-us/articles/30076656117655-Getting-Started-with-the-Official-UniFi-API) — confirmed X-API-KEY auth; confirmed API key is read-only; confirmed Integration API scope

### Tertiary (LOW confidence — flag for validation)

- Uptime field as integer seconds: extrapolated from HA integration "timestamp showing when device started" plus community reports of "uptime: 12088" in JSON examples. Needs empirical verification against actual controller.
- `features.access_point.num_sta` for per-device client count: extrapolated from HA integration description. Field path may differ.
- `stat/health` working on UniFi OS 5.x specifically: confirmed on OS 4.x; may have changed in OS 5.x.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; established patterns followed
- API authentication: HIGH — multiple official sources confirm X-API-KEY
- Device field names: MEDIUM — confirmed from MCP source but not from live controller response
- State field values: MEDIUM — confirmed from HA integration but capitalization may differ
- WAN throughput endpoint: MEDIUM — confirmed working on OS 4.x; OS 5.x unverified
- Uptime field type: MEDIUM — integer seconds confirmed from community JSON examples
- Architecture patterns: HIGH — mirrors established adapter/PollManager/Settings patterns exactly

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (UniFi API stable but controller software updates frequently — re-verify if OS 5.x adds breaking changes)
