# Phase 6: Network Monitoring — Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire UniFi network equipment into the dashboard. This phase delivers:
- A working UniFi backend adapter (poll via static API token, no session management)
- Real data in the NETWORK card's UBIQUITI section (replaces the "NOT CONFIGURED" placeholder from Phase 5)
- A UniFi settings tab (URL + API token + TEST CONNECTION)
- A UniFi device detail view (grouped by type, with per-device LED/model/uptime/client count)

**NET-04 note:** REQUIREMENTS.md says "cookie session lifecycle" — this is outdated. ROADMAP.md is authoritative: static API token only, no session management. The researcher and planner must use the token-based approach.

Phase ends when all four SUCCESS CRITERIA from ROADMAP.md are met (NET-01 through NET-04 requirements fulfilled).

</domain>

<decisions>
## Implementation Decisions

### UBIQUITI Card Body (right half of NETWORK card)

- **D-01:** WAN throughput displays as **mini horizontal bars** — one for TX (upload), one for RX (download).
- **D-02:** TX bar color: **red** (`#FF4444` — upload). RX bar color: **blue** (`#00c8ff` — download/cockpit blue). This adds color differentiation to the compact section.
- **D-03:** Bars scale **dynamically to the peak observed** throughput, with a **6-hour rolling window reset**. When the peak resets, bars recalibrate to current traffic levels. No user-configured max baseline needed.
- **D-04:** Card body layout (right UBIQUITI section):
  ```
  UBIQUITI
  ● ONLINE  42 clients
  TX ████░░ 250M  (red bar)
  RX █░░░░░  15M  (blue bar)
  ```
  Four rows total (same budget as the PI-HOLE left section).

### Health LED Rollup

- **D-05:** Overall network health LED uses **gateway-first logic**:
  - **GREEN** — all devices online
  - **AMBER** — any AP or switch offline (network degraded, but internet up)
  - **RED** — gateway/router offline (internet connection lost)
- **D-06:** Device type classification for rollup: use `model` prefix from the API response — UDM/UDMP/UDR = gateway, USW = switch, U6/UAP/UAL/UAE = access point. If model is unrecognized, treat as non-critical (amber on failure, not red).

### Settings Tab

- **D-07:** Settings tab has **2 fields only**: UniFi Controller URL + API Token (masked with eye-toggle, same pattern as Phase 3/4 credential fields).
- **D-08:** **Default site only** — no site selector field. Backend always queries the `default` site. Auth header: `X-API-KEY: <token>` (confirmed from user's controller).
- **D-09:** TEST CONNECTION button verifies token by calling `GET /proxy/network/integration/v1/sites`. Success returns site name; failure shows error (unreachable, invalid token, etc.).

### Device Detail View

- **D-10:** Devices **grouped by type**: GATEWAYS section, then SWITCHES, then ACCESS POINTS. Each section header uses the same amber mono label style as other section headers in the app.
- **D-11:** Each device row: `● [model name]  up [uptime]  [N] clients` (LED dot, model, formatted uptime, client count). Offline devices show `✕` instead of `●` and omit client count.
- **D-12:** **No IP address, no firmware version** in the list — just model, uptime, client count. Matches NET-03 exactly.
- **D-13:** Detail view is **scrollable** — device count is unknown, so the list must scroll within the view container.

### Poll Interval

- **D-14:** UniFi adapter polls at **30 second** interval. Network topology changes slowly (devices don't flap every few seconds). This is between NAS (3s live hardware) and Pi-hole (60s DNS stats).

### API Endpoints to Use

- **D-15:** Auth: `X-API-KEY` header. Base path: `/proxy/network/integration/v1/`. No session or cookie management.
- **D-16:** Three endpoints to poll:
  1. `GET /sites` — on startup only, to resolve the default site ID
  2. `GET /sites/{siteId}/devices` — every 30s, returns device list with `macAddress`, `model`, `name`, `ipAddress`, `firmwareVersion`, `state`, `uptime`, `features`
  3. `GET /sites/{siteId}/clients` — every 30s, use `totalCount` for aggregate active client count
- **D-17:** **WAN throughput research required.** The local Network Integration API (`/proxy/network/integration/v1/`) does NOT expose WAN rx/tx rate natively at the site/device level. Two APIs exist — researcher must distinguish:
  - **Local Network Integration API** (base: `https://{controller}/proxy/network/integration/v1/`) — what this phase uses for devices/clients. May have an undocumented WAN stats endpoint.
  - **Site Manager API** (cloud, `developer.ui.com`) — has `getispmetrics` returning `download_kbps`/`upload_kbps` but these are historical 5-min/1-hour aggregates, NOT real-time rates. Not suitable for live throughput bars.
  - Researcher must confirm: does `GET /proxy/network/api/stat/sites` (community endpoint) accept API key auth and return real-time `tx_bytes-r` / `rx_bytes-r`? This is the most promising path for live throughput.
  - Fallback: if no real-time WAN rate is available via API key, display WAN stats as "—" placeholder (dim, no bars) with a comment in the adapter code explaining why.
- **D-18:** `state` field values from the API are likely uppercase strings (e.g., `"ONLINE"`, `"OFFLINE"`) — researcher to confirm exact values. LED maps: `"ONLINE"` → green LED, anything else → red LED.
- **D-19:** `uptime` field is likely in seconds (integer). Format for display as `Xd Yh` (e.g., `14d 3h`). Researcher to confirm field type.

### Claude's Discretion

- Exact bar width/height in pixels for TX/RX bars — keep consistent with existing compact card instruments
- Peak throughput tracking: in-memory per adapter instance (not persisted to DB), reset every 6 hours via a timer
- Uptime formatting: display as `14d 3h` format, drop minutes for cleaner display

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UniFi API Documentation
- **Local integration API OpenAPI spec**: available at `https://{controller}/proxy/network/api-docs/integration.json` — researcher should fetch this directly from the controller to get authoritative field names
- **Official Network v10 API docs** (JS-rendered, use as reference): `https://developer.ui.com/network/v10.1.84/gettingstarted` — includes "Get Latest Adopted Device Statistics" endpoint which may expose real-time WAN throughput
- **Official Site Manager API docs**: `https://developer.ui.com/site-manager/v1.0.0/gettingstarted` — covers cloud-layer ISP metrics (historical, NOT real-time; not suitable for live bars)
- Auth header: `X-API-KEY` (confirmed from user's controller curl example)
- Local API prefix: `/proxy/network/integration/v1/`
- Device fields confirmed via [unifi-network-mcp source](https://github.com/ryanbehan/unifi-network-mcp): `macAddress`, `model`, `name`, `ipAddress`, `firmwareVersion`, `state`, `uptime`, `features`

### Existing Phase Context (decisions to follow)
- `.planning/phases/05-ui-v2-instrument-panel-polish/05-CONTEXT.md` — D-15 (NETWORK card header), D-16 (UBIQUITI placeholder layout to replace)
- `.planning/phases/04-rich-service-integrations/04-CONTEXT.md` — D-22, D-23 (settings tab conventions)
- `.planning/phases/03-settings-first-service-adapters/03-CONTEXT.md` — credential field pattern (masked, eye-toggle)

### Codebase Integration Points
- `packages/frontend/src/components/cards/ServiceCard.tsx` — `NetworkInstrument` function (replace UBIQUITI placeholder)
- `packages/backend/src/adapters/` — add `unifi.ts` following pihole/nas adapter pattern
- `packages/backend/src/poll-manager.ts` — register UniFi adapter, add to ALL_SERVICE_IDS
- `packages/backend/src/routes/settings.ts` — add UniFi settings tab handler
- `packages/backend/src/routes/test-connection.ts` — add UniFi test connection handler

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/adapters/pihole.ts` — session management pattern (use as reference for adapter structure; UniFi uses simpler static token, no session)
- `packages/backend/src/adapters/nas.ts` — poll pattern with separate timer (image update check) — can inspire the 30s poll + startup site-ID resolution pattern
- `packages/frontend/src/components/cards/ServiceCard.tsx` — `NetworkInstrument()` function has the UBIQUITI placeholder to replace (line ~150+)

### Established Patterns
- Adapters export a single `poll*()` function; PollManager calls it on interval
- Service status shape: `ServiceStatus { id, name, tier, status, configured, lastPollAt, metrics? }`
- Settings encrypted at rest via `packages/backend/src/crypto.ts` (AES-256-GCM)
- Settings tab pattern: status LED, horizontal scroll overflow, cockpit instrument aesthetic, TEST button

### Integration Points
- PollManager must add `'unifi'` to `ALL_SERVICE_IDS` array
- `idToName()` and `idToTier()` need UniFi entries (`'rich'` tier)
- SSE snapshot (`DashboardSnapshot`) — UniFi data flows through existing SSE mechanism
- Settings routes — new `/api/settings/unifi` GET/POST endpoints
- Test-connection route — new case for `serviceId === 'unifi'`

</code_context>

<specifics>
## Specific Ideas

- TX bars in **red** (`#FF4444`), RX bars in **blue** (`#00c8ff`) — user explicitly requested color differentiation for upload vs download
- 6-hour rolling peak reset: implement as a `setTimeout` in the adapter that nulls the stored peak values, then restarts itself
- The NETWORK card's UBIQUITI section will go from "NOT CONFIGURED" dim placeholder to live data when UniFi is configured — the LED and bars should animate in consistently with how other services activate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-network-monitoring*
*Context gathered: 2026-04-05*
