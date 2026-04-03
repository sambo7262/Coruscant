# Feature Research

**Domain:** Self-hosted home infrastructure monitoring dashboard
**Researched:** 2026-04-02
**Confidence:** MEDIUM (training knowledge, cutoff August 2025; external verification blocked — flag for validation before implementation)

---

## API Feasibility Assessment

Detailed per-service ratings before the feature landscape, as these directly constrain what can be built.

### Radarr / Sonarr / Lidarr / Bazarr

**Feasibility: EASY**
**Confidence: HIGH** (stable, well-documented, unchanged for years)

All four use the Servarr unified API design (v3 for Radarr/Sonarr/Lidarr, v1 for Bazarr). Authentication is a single API key passed as `X-Api-Key` header or `apikey` query parameter. The key is generated in each app's Settings > General.

Available metrics relevant to a monitoring dashboard:

| Endpoint | What It Returns |
|----------|----------------|
| `GET /api/v3/health` | Array of health check issues (warnings/errors) with message and type |
| `GET /api/v3/system/status` | App version, DB version, OS info, uptime |
| `GET /api/v3/queue` | Active download queue with progress percentages, eta, status |
| `GET /api/v3/queue/status` | Queue totals (total, pending, downloading, completed, failed) |
| `GET /api/v3/movie` | Full movie library (Radarr only) |
| `GET /api/v3/series` | Full series library (Sonarr only) |
| `GET /api/v3/diskspace` | Storage volumes with free/total space |
| `GET /api/v3/system/task` | Background tasks and their status |

Bazarr uses `/api/` prefix and requires the same API key pattern. Key endpoints: `/api/system/status`, `/api/system/health`.

**Implementation notes:**
- All services run on LAN — no CORS complexity beyond configuring the backend proxy
- Polling interval: 30–60 seconds is appropriate; these apps have no webhook push for status
- Health endpoint is the most important for "is it working" status cards
- Queue endpoint is optional for Radarr/Sonarr/Lidarr (PROJECT.md lists them as status-only), but available if desired

---

### SABnzbd

**Feasibility: EASY**
**Confidence: HIGH** (long-stable API, unchanged in format for many versions)

SABnzbd exposes a flat HTTP API at `/api` with a single API key. All calls use `?mode=X&apikey=Y&output=json` query parameters — no REST conventions, but very straightforward.

Key modes for monitoring:

| Mode | What It Returns |
|------|----------------|
| `queue` | Full queue: active downloads, filename, size, progress %, MB/s speed, ETA, status |
| `history` | Completed/failed downloads |
| `status` | Server-level stats: connections, bytes downloaded, cache usage |
| `server_stats` | Per-server (indexer) stats |
| `get_config&section=general` | Config including server status |

**Implementation notes:**
- The `queue` response is all-in-one: total speed, queue size, active slot count, and per-item progress
- Speed is in MB/s, ETA in seconds — easy to display as a progress bar
- Status values per item: `Downloading`, `Fetching`, `Extracting`, `Verifying`, `Repairing`, `Failed`, `Completed`
- No webhooks; poll at 5–15 second interval for live download progress feel
- API key is in SABnzbd Config > General > API Key

---

### Pi-hole

**Feasibility: EASY (v5) / MEDIUM (v6)**
**Confidence: MEDIUM** (v6 was in active development as of August 2025; verify which version is deployed)

**Pi-hole v5 API** (most commonly deployed as of August 2025):
- Base URL: `http://pihole.local/admin/api.php`
- Authentication: `?auth=<WEBPASSWORD_HASH>` query parameter (SHA256 of the web admin password)
- Key endpoints: `?summaryRaw` returns all stats in one call

| Field | Description |
|-------|-------------|
| `domains_being_blocked` | Blocklist size |
| `dns_queries_today` | Total queries today |
| `ads_blocked_today` | Blocked queries today |
| `ads_percentage_today` | Block percentage |
| `queries_forwarded` | Forwarded to upstream |
| `queries_cached` | Served from cache |
| `unique_clients` | Active clients |
| `status` | `enabled` or `disabled` |

**Pi-hole v6 API** (newer installs, FTL rewrite):
- REST API with Bearer token authentication (app password generated in Pi-hole web UI)
- More structured endpoints: `/api/stats/summary`, `/api/dns/blocking`, `/api/queries`
- Authentication changed significantly from v5 — verify which version before implementing

**Implementation notes:**
- v5 auth is a hash comparison weakness (not a security concern on LAN)
- v6 requires a two-step auth (obtain session token, then use Bearer)
- The most important display metrics: queries today, block %, top blocked domains (optional)
- Upstream response time is NOT in the standard API — would require parsing FTL logs or using `/api/queries` with filtering (v6 only)
- Poll interval: 60 seconds is fine; stats update every 5 minutes internally

---

### Plex Media Server

**Feasibility: EASY**
**Confidence: HIGH** (Plex API is well-documented, stable for years)

Authentication: Plex uses an `X-Plex-Token` header. The token is obtained from `~/.config/Plex Media Server/Preferences.xml` on the server (`PlexOnlineToken` key) or from the Plex account page. For local-only access, the token from the server preferences file works without OAuth.

Key endpoints (base URL: `http://nas-ip:32400`):

| Endpoint | What It Returns |
|----------|----------------|
| `GET /sessions` | Active streams: user, title, media type, progress, playback state |
| `GET /sessions/statistics/bandwidth` | Bandwidth by stream type |
| `GET /transcode/sessions` | Active transcodes: video/audio codec, bitrate, throttled, speed, progress |
| `GET /status/sessions` | Same as `/sessions`, alias |
| `GET /` | Server identity, version, friendly name, machine ID |
| `GET /library/sections` | Libraries with section metadata |
| `GET /library/sections/{id}/all` | Full library contents |
| `GET /system` | System info (undocumented but returns platform, architecture, version) |
| `GET /butler` | Background task status (metadata refresh, backup, etc.) |

Active stream object includes: `User.title`, `Player.title` (device), `Player.state` (playing/paused/buffering), `viewOffset`, `duration`, `Media.videoResolution`, `TranscodeSession.*` if transcoding.

Transcoding session includes: `videoDecision` (direct/copy/transcode), `audioDecision`, `progress`, `speed` (ratio — 1.0 = keeping up), `throttled`, `sourceVideoCodec`, `videoCodec`.

**Implementation notes:**
- `X-Plex-Token` from server preferences file is the simplest local approach — no OAuth needed
- Active stream data is rich enough for a "now playing" ticker with title, user, progress, and transcode indicator
- Server health can be inferred from: successful API response + `/transcode/sessions` speed ratios
- No webhook push; poll `/sessions` at 10–15 second intervals for live stream updates
- The `Accept: application/json` header is required to get JSON (default is XML)

---

### Synology NAS (DSM)

**Feasibility: MEDIUM**
**Confidence: HIGH** (DSM REST API is well-documented, stable across DSM 6/7)

Synology DSM exposes a comprehensive REST API via the SYNO.API namespace. Authentication requires a session login step.

**Authentication flow:**
1. `POST /webapi/auth.cgi` with `api=SYNO.API.Auth&method=login&account=user&passwd=pass&format=sid`
2. Returns `sid` session token
3. Pass `_sid=<token>` on all subsequent calls
4. Alternatively: use an "application password" (DSM Account > Security > Application Passwords) — avoids storing main credentials

**Key APIs for monitoring:**

| API | Method | What It Returns |
|-----|--------|----------------|
| `SYNO.Core.System.Utilization` | `get` | CPU usage (user, system, iowait), RAM total/free/cached/buffers |
| `SYNO.Storage.CGI.Storage` | `load_info` | Per-volume: total, used, free, status; per-disk: model, size, temp, status |
| `SYNO.Core.System` | `info` | Model, DSM version, serial number, uptime, firmware |
| `SYNO.FileStation.Info` | `getinfo` | Hostname, DSM version |
| `SYNO.DSM.Network` | `list` | Network interfaces, link speed, IPs |
| `SYNO.SurveillanceStation.Camera` | `list` | NVR camera status (if Surveillance Station installed) |

**SNMP alternative:**
- DSM supports SNMP v1/v2c/v3 (enable in Control Panel > Terminal & SNMP)
- Standard MIBs expose: CPU, memory, disk usage, network throughput, system info
- Synology provides a custom MIB (`SYNOLOGY-SYSTEM-MIB`) with disk temps, fan speeds, power status
- SNMP is more complex to parse (MIB walking) — DSM REST API is strongly preferred for new integrations

**Fan speeds and disk temps:**
- Disk temps: `SYNO.Storage.CGI.Storage` with `method=load_info` returns `temp` per disk
- Fan speeds: `SYNO.Core.System` or `SYNO.DSM.System.Hardware` — available but endpoint naming varies by DSM version. SNMP `SYNOLOGY-SYSTEM-MIB::synoSystemFanStatus` is the more reliable path for fan data
- Hardware health (UPS, fans, power supply): `SYNO.Core.Hardware` namespace — available in DSM 7

**Implementation notes:**
- Session-based auth means the backend must manage session lifecycle and re-auth on expiry
- Application passwords (DSM 7+) with limited permissions are safer than storing main credentials
- Polling CPU/RAM: 10–30 second intervals
- Polling disk temps/fans: 60 second intervals (thermal data doesn't change faster)
- DSM API may differ between DSM 6 and DSM 7 — target DSM 7 (current)
- All requests go to `http://nas-ip:5000/webapi/entry.cgi` (DSM 7) or `/webapi/` (older)

---

### Ubiquiti UniFi Controller

**Feasibility: MEDIUM**
**Confidence: MEDIUM** (API is functional but unofficial/undocumented; structure known from community documentation)

UniFi does not officially document their controller API, but it has been extensively reverse-engineered by the community and is stable in practice.

**Authentication:**
- Cookie-based login: `POST /api/login` with `{"username": "...", "password": "...", "remember": true}`
- Returns `unifises` and `csrf_token` cookies
- All subsequent requests pass both cookies
- UniFi OS (UDM/UDM Pro/UDM SE running UniFi OS 3+): endpoint changed to `/api/auth/login`, cookies are `TOKEN` (Bearer) and `X-CSRF-Token` header required

**Key endpoints (UniFi Network Controller):**

| Endpoint | What It Returns |
|----------|----------------|
| `GET /api/s/{site}/stat/device` | All devices: APs, switches, gateways — status, uptime, load, clients, version |
| `GET /api/s/{site}/stat/sta` | Connected wireless clients: signal, channel, RSSI, AP association |
| `GET /api/s/{site}/stat/alluser` | All users (including wired) |
| `GET /api/s/{site}/health` | Per-subsystem health: WAN, LAN, WLAN, VPN — client counts, rx/tx bytes |
| `GET /api/s/{site}/dashboard` | Dashboard summary: active clients, guest clients, WAN throughput |
| `GET /api/s/{site}/event` | Recent events log |
| `GET /api/s/{site}/alarm` | Active alarms |
| `GET /api/s/{site}/stat/report/5minutes.site` | 5-minute historical WAN stats |

Device object includes: `name`, `ip`, `mac`, `model`, `version`, `uptime`, `state` (1=connected), `num_sta` (connected clients), `tx_bytes`, `rx_bytes`, `load_average` (for gateways/USG), `mem` (memory usage %), `cpu`.

**Implementation notes:**
- Self-signed SSL certificates are common — HTTP client must accept self-signed certs or the controller IP must be accessed over HTTP
- Cookie session management in backend is required (same lifecycle concern as Synology)
- Default site is `default` — `s/default` in all endpoints
- UniFi OS (UDM) uses slightly different endpoints; check which hardware is in use
- Community libraries exist: `node-unifi` (Node.js), `unifi-client` — using one is wise to handle the auth quirks
- The dashboard and health endpoints give the best at-a-glance data for a monitoring card
- No official documentation — API may change on controller upgrades (historically stable but no guarantees)

---

### Google Nest

**Feasibility: HARD**
**Confidence: MEDIUM** (based on Smart Device Management API as of August 2025)

Google deprecated the original Works with Nest API in 2019. The replacement is the **Smart Device Management (SDM) API**, which requires:

1. Device Access program enrollment (one-time $5 USD fee per developer account)
2. A Google Cloud project with SDM API enabled
3. OAuth 2.0 with user consent flow — the user must authorize via a Google consent screen
4. `https://www.googleapis.com/auth/sdm.service` OAuth scope

**What the SDM API can return (Nest devices):**

| Trait | Device Type | Data |
|-------|-------------|------|
| `sdm.devices.traits.Temperature` | Thermostat | Current ambient temperature |
| `sdm.devices.traits.Humidity` | Thermostat | Current humidity % |
| `sdm.devices.traits.ThermostatMode` | Thermostat | Current mode (HEAT/COOL/OFF/HEATCOOL) |
| `sdm.devices.traits.ThermostatHvac` | Thermostat | HVAC status: HEATING/COOLING/OFF |
| `sdm.devices.traits.Connectivity` | All | ONLINE/OFFLINE |
| `sdm.devices.traits.CameraMotion` | Camera | Motion events (via pub/sub only) |
| `sdm.devices.traits.DoorbellChime` | Doorbell | Chime events (via pub/sub only) |

**Critical limitations:**
- Motion and doorbell events require Google Cloud Pub/Sub subscription — not a simple poll
- No camera live stream via simple HTTP (requires WebRTC token generation, complex setup)
- Battery level is NOT exposed via SDM API
- Historical thermostat data is NOT available
- OAuth token requires web-based consent flow — needs a redirect URI, complicates local-only setup
- Refresh tokens expire if not used for 6 months

**Implementation notes:**
- For "status/presence indicators" as listed in PROJECT.md, thermostat connectivity + HVAC state is feasible
- The OAuth flow is the hard part — requires either running it once and storing the refresh token, or a setup wizard
- This is the most complex integration in the project; recommend deferring to v1.x unless the user specifically prioritizes it
- Consider a "Nest not configured" card state that shows setup instructions

---

### Amazon Ring

**Feasibility: HARD (unofficial) / BLOCKED (official)**
**Confidence: MEDIUM** (Ring API situation as of August 2025)

**Official Ring API:** Does not exist for third-party integration. Ring acquired by Amazon in 2018; Ring has not released a public API. There is no official way to access Ring device data programmatically.

**Unofficial approach: `ring-client-api` (Node.js)**
- A community reverse-engineered library that mimics the Ring mobile app's API calls
- Authentication: Email/password + 2FA verification code (one-time setup); tokens are stored and refreshed
- Maintained on npm as `ring-client-api` — active as of August 2025
- What it can provide:

| Data | Availability |
|------|-------------|
| Device list | Doorbells, cameras, alarms — names, locations, battery % |
| Device health | Online/offline status |
| Motion events | Recent events with timestamp (polling or event stream) |
| Doorbell events | Ring/motion with timestamp |
| Live stream | Not feasible for a web dashboard (requires WebRTC, proprietary) |
| Snapshots | Can request a snapshot image from some devices |

**Critical limitations:**
- Not officially supported — Amazon can break this at any time with an app update
- 2FA adds complexity to initial setup and token refresh
- May violate Ring's Terms of Service
- Motion detection state (currently detecting motion) is NOT available; only recent event history
- For "doorbell/camera status, recent event indicators" (PROJECT.md) — feasible with unofficial library

**Implementation notes:**
- `ring-client-api` is the only real path; evaluate its maintenance status before committing
- Recommend treating Ring as an optional/best-effort integration with clear "may break" documentation
- Token refresh should happen in the backend; 2FA should only be required on initial setup
- Suggest storing "last N events" locally to avoid polling Ring too frequently

---

### Pushover Notifications

**Feasibility: EASY**
**Confidence: HIGH** (Pushover API is extremely simple and stable)

Pushover exposes a single POST endpoint: `https://api.pushover.net/1/messages.json`

Required parameters:
- `token`: Application API token (created at pushover.net)
- `user`: User/Group key
- `message`: Notification body

Optional parameters relevant to monitoring:
- `title`: Custom title (e.g., "Coruscant Alert")
- `priority`: -2 (silent) to 2 (emergency with repeat until acknowledged)
- `sound`: Predefined or custom sound
- `url` / `url_title`: Deep link back to the dashboard
- `html`: 1 to enable HTML in message body
- `device`: Target specific device (user has existing Pushover setup)

Rate limits: 10,000 messages/month per app token on free tier.

**Implementation notes:**
- This is the simplest API in the project — a single HTTP POST with no auth flow
- The backend should queue and debounce alerts (don't spam if CPU stays at 95% for 10 minutes)
- `priority: 1` (high priority, bypasses quiet hours) is appropriate for critical alerts; `priority: 0` for informational
- `priority: 2` (emergency) should be reserved for true critical failures — it repeats until acknowledged
- Deep link via `url` pointing back to the Coruscant dashboard is a nice UX touch

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Service up/down status for all monitored services | Core purpose of a monitoring dashboard | LOW | Simple health check endpoint poll or HTTP 200 check |
| Visual distinction between healthy/warning/critical states | Can't interpret a dashboard without it | LOW | Color system already defined in PROJECT.md |
| Auto-refresh / live data | A dashboard showing stale data is useless | LOW-MEDIUM | Polling intervals per service; WebSocket or SSE for UI push |
| Mobile-responsive layout | PRIMARY use case per PROJECT.md | MEDIUM | Mobile-first CSS; touch-friendly tap targets |
| Per-service detail view (drill-down) | Status dots alone aren't actionable | MEDIUM | Click from card to expanded view with more metrics |
| Plex active streams display | Users with Plex check it constantly | MEDIUM | `/sessions` endpoint; show title, user, progress |
| NAS storage capacity indicators | "Am I running out of disk space?" is daily concern | MEDIUM | Per-volume usage bars; disk count and status |
| NAS CPU and RAM usage | Diagnose slow NAS performance | LOW-MEDIUM | SYNO.Core.System.Utilization |
| Download queue status (SABnzbd) | Active downloads are high-urgency information | MEDIUM | Speed, queue count, current item progress |
| Pi-hole stats (queries, block rate) | Expected from any Pi-hole integration | LOW | `/api.php?summaryRaw` single call |
| Settings page for credentials/endpoints | Must be configurable without code changes | MEDIUM | UI for API keys, URLs, thresholds |
| Application error/log view | Diagnosing why a service shows red | MEDIUM | In-app log viewer for the Coruscant app itself |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tron/Grid living UI aesthetic | Uniquely personal; feels alive, not like a corporate tool | HIGH | Animated grid, light pulses, border traces, scan effects — significant frontend work |
| Scrolling "Now Playing" banner with active Plex streams | Glanceable entertainment status without opening Plex | MEDIUM | Title, user, progress — ticker/marquee component |
| Plex transcode status indicator | Power users care about whether Plex is struggling | MEDIUM | Transcode speed ratio; "direct play" vs "transcoding" badge |
| UniFi network at-a-glance (throughput, client counts) | Most dashboards skip network equipment | MEDIUM-HIGH | UniFi unofficial API; auth session management |
| Disk temperature monitoring | Early warning for hardware failure | MEDIUM | Synology Storage API + per-disk temp display |
| Fan speed monitoring | Completes the NAS health picture | MEDIUM | SYNO.Core.Hardware or SNMP; varies by DSM version |
| Pushover threshold alerts with configurable thresholds | Proactive notification vs reactive checking | MEDIUM | Backend alert engine; configurable per-service |
| Google Nest thermostat status (HVAC state, temp) | Adds smart home awareness to infrastructure hub | HIGH | SDM API OAuth flow; complex setup |
| Amazon Ring event indicators (last motion/doorbell) | Surfaces security camera activity in one place | HIGH | Unofficial `ring-client-api`; fragile, may break |
| Centralized log management (purge, export) | Ops quality-of-life feature | MEDIUM | Log rotation; export endpoint |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time WebSocket streaming for all data | "Live" feels better than polling | Most home services have no push API; fake real-time via 1-second polling creates unnecessary backend load and complexity | Sensible per-service polling intervals (5s for active downloads, 30s for status checks, 60s for thermal/NAS stats) |
| Service control (pause downloads, restart services, enable/disable Pi-hole) | Convenient to act from the dashboard | Blurs monitoring/control boundary; control commands have side effects; increases attack surface | Keep Coruscant read-only; link through to each service's own UI |
| Media library browsing | Plex API can return full library | Scope creep — this is what Plex's own UI does; Coruscant is a health dashboard, not a media browser | Show library size (count) only, not browsable content |
| Historical metric charts (30-day trending) | Useful for capacity planning | Requires a time-series database (InfluxDB, Prometheus) — major infrastructure addition not suited to v1 | In-memory rolling window (last 60 data points) for a sparkline; no persistent storage needed |
| User authentication / multi-user access | "What if someone else accesses it?" | On a Tailscale-only deployment this is minimal risk; adding auth (sessions, passwords) adds significant complexity for one user | Rely on Tailscale's network-level auth; add a PIN/password in v2 if needed |
| Mobile push directly from the app | Notifications without Pushover | Requires APNs/FCM setup, app certificates, ongoing maintenance | Pushover already solves this perfectly; don't reinvent it |
| Docker container management (start/stop/restart) | "Useful to have in one place" | Running `docker stop` from a dashboard is dangerous; monitoring and orchestration should be separate | Show container status only; restart via Portainer or SSH |
| Email/SMS notification channels | "Not everyone uses Pushover" | User already uses Pushover; adding channels multiplies notification configuration complexity | Pushover covers the user's need; add other channels in v2 if requested |

---

## Feature Dependencies

```
Settings (credentials/endpoints)
    └──required by──> ALL service integrations

Service integrations (polling layer)
    └──required by──> Dashboard cards
                          └──required by──> Detail views

Alert threshold config
    └──required by──> Pushover notification engine
                          └──requires──> Settings (Pushover API key)

Plex sessions polling
    └──enhances──> Now Playing banner
    └──enhances──> Plex rich card

SABnzbd queue polling
    └──enables──> Active download progress bars

Synology disk polling
    └──enables──> Disk temp display
    └──enables──> Fan speed display (separate endpoint)

UniFi auth session management
    └──required by──> UniFi device stats
    └──required by──> UniFi client counts

Google Nest OAuth flow (one-time setup)
    └──required by──> Nest status card
    └──blocks──> (if SDM API changes or token expires)

ring-client-api token setup (one-time 2FA)
    └──required by──> Ring event card
    └──blocks──> (if Ring API changes)
```

### Dependency Notes

- **Settings required by everything:** No service integration can work without stored credentials. Settings page must be built before service cards are wired up.
- **Synology session token:** DSM auth must be managed centrally in the backend — all Synology API calls share the session.
- **UniFi session management:** Same pattern as Synology — a login step produces a cookie that must be re-used and refreshed.
- **Nest and Ring are isolated:** Their failure modes are independent of all other integrations. They can be feature-flagged off without affecting the rest of the dashboard.
- **Pushover requires Pushover API key in Settings:** The alert engine cannot fire without this being configured.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates the core "single glance" premise.

- [ ] Service status cards: Radarr, Sonarr, Lidarr, Bazarr (up/down dot) — validates status monitoring approach
- [ ] SABnzbd activity card: speed, queue count, active download progress — validates activity tier
- [ ] Pi-hole stats card: queries today, block % — validates rich data tier
- [ ] Plex card: active stream count, now-playing ticker — validates the entertainment monitoring value prop
- [ ] NAS card: CPU %, RAM %, per-volume storage usage — validates infrastructure monitoring
- [ ] Settings page: credential/endpoint config for all services above
- [ ] Tron/Grid visual theme — validates aesthetic (this IS the product's identity)
- [ ] Mobile-first responsive layout
- [ ] Auto-refresh (polling)

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] NAS disk temps and fan speeds — add when basic NAS card is validated
- [ ] Plex transcode detail — add when Plex card is validated
- [ ] UniFi network card — add when backend service layer is proven (auth session complexity)
- [ ] Pushover threshold alerts — add when enough data is being collected to set meaningful thresholds
- [ ] Log viewer (in-app Coruscant logs) — add when there's enough operational history to need it
- [ ] Google Nest thermostat card — add if user confirms OAuth setup is acceptable
- [ ] Amazon Ring event card — add as optional/experimental module with documented fragility

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Sparkline charts (in-memory rolling window) — deferred: adds UI complexity; validate flat metrics first
- [ ] Additional notification channels (email, etc.) — deferred: Pushover covers v1 need
- [ ] Dashboard layout customization (drag-and-drop cards) — deferred: premature until card set is stable
- [ ] Mobile PWA / home screen install — deferred: mobile browser is sufficient for v1

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Status cards (*arr suite) | HIGH | LOW | P1 |
| SABnzbd download queue | HIGH | LOW | P1 |
| Pi-hole stats | HIGH | LOW | P1 |
| Plex active streams + now-playing banner | HIGH | MEDIUM | P1 |
| NAS CPU/RAM/storage | HIGH | MEDIUM | P1 |
| Settings page | HIGH | MEDIUM | P1 |
| Tron/Grid visual theme | HIGH | HIGH | P1 |
| NAS disk temps + fan speeds | MEDIUM | MEDIUM | P2 |
| Plex transcode status | MEDIUM | LOW | P2 |
| UniFi network card | HIGH | MEDIUM-HIGH | P2 |
| Pushover threshold alerts | HIGH | MEDIUM | P2 |
| In-app log viewer | MEDIUM | MEDIUM | P2 |
| Google Nest card | LOW-MEDIUM | HIGH | P3 |
| Amazon Ring card | LOW-MEDIUM | HIGH | P3 |
| Sparkline trend charts | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Homarr | Homepage | Heimdall | Our Approach |
|---------|--------|----------|----------|--------------|
| Service status cards | Yes, with *arr/SABnzbd widgets | Yes, service widgets | Basic (ping only) | Tiered depth (status/activity/rich) |
| Plex now playing | Widget available | Widget available | No | Live scrolling banner; richer than widget |
| Pi-hole stats | Widget | Widget | No | Stats card with block % and query count |
| NAS monitoring | Limited | No built-in | No | Deep Synology DSM integration |
| Network monitoring | No | No | No | UniFi card — differentiator |
| Smart home (Nest/Ring) | No | No | No | First-class — differentiator |
| Notifications | No | No | No | Pushover threshold alerts — differentiator |
| Visual theme | Configurable, generic | Configurable, generic | Generic | Tron/Grid living theme — strong differentiator |
| Mobile-first | Responsive but desktop-first | Responsive | No | Mobile-first from ground up |
| Log viewer | No | No | No | Built-in — differentiator |
| Self-hosted | Yes | Yes | Yes | Yes — non-negotiable |

**Differentiator summary:** Coruscant competes primarily on: (1) deeper NAS + network integration, (2) distinctive living Tron aesthetic, (3) Pushover alerting, and (4) smart home inclusion. Generic dashboards like Homarr/Homepage are close feature-parity on *arr/SABnzbd/Pi-hole/Plex but entirely absent on the others.

---

## API Feasibility Summary

| Service | Feasibility | Auth Method | Poll Interval | Notes |
|---------|-------------|-------------|---------------|-------|
| Radarr | EASY | API key header | 30–60s | Stable Servarr v3 API; health + queue endpoints |
| Sonarr | EASY | API key header | 30–60s | Identical to Radarr |
| Lidarr | EASY | API key header | 30–60s | Identical to Radarr |
| Bazarr | EASY | API key header | 60s | Same pattern, `/api/` prefix |
| SABnzbd | EASY | API key query param | 5–15s | Flat `?mode=` API; queue object is all-in-one |
| Pi-hole v5 | EASY | Password hash query param | 60s | `?summaryRaw` one call; verify v5 vs v6 |
| Pi-hole v6 | MEDIUM | Bearer session token | 60s | Two-step auth; REST endpoints |
| Plex | EASY | Static token header | 10–15s | Token from server preferences file; JSON via Accept header |
| Synology DSM | MEDIUM | Session login (sid) + optional app password | 10–60s varies | Session lifecycle management required; DSM 7 target |
| UniFi | MEDIUM | Cookie session login | 30–60s | Unofficial API; self-signed SSL; community library recommended |
| Google Nest | HARD | OAuth 2.0 (SDM API) | 60s | $5 program fee; Pub/Sub for events; complex setup wizard needed |
| Amazon Ring | HARD | Unofficial library + 2FA | 60–120s | No official API; `ring-client-api`; may break; ToS risk |
| Pushover | EASY | Static token + user key | N/A (push) | Single POST; debounce required |

---

## Sources

- Servarr Wiki (Radarr/Sonarr/Lidarr API documentation) — training knowledge, HIGH confidence
- SABnzbd API documentation at sabnzbd.org — training knowledge, HIGH confidence
- Pi-hole API documentation (v5 `api.php` and v6 REST rewrite) — MEDIUM confidence; v6 was in active development as of August 2025, verify current state
- Plex Media Server API (unofficial documentation at plexapi.dev and community resources) — HIGH confidence, stable API
- Synology DSM Web API Guide — HIGH confidence, official documentation
- UniFi community API documentation (Art-of-Wifi, hjdhjd/unifi-network-rules) — MEDIUM confidence, unofficial
- Google Smart Device Management API (developers.google.com/nest/device-access) — MEDIUM confidence, verify current OAuth flow
- Amazon Ring — no official API; `ring-client-api` npm library community documentation — MEDIUM confidence, inherently fragile
- Pushover API documentation (pushover.net/api) — HIGH confidence, extremely stable
- Competitor analysis: Homarr, Homepage (gethomepage.dev), Heimdall — training knowledge

---

*Feature research for: self-hosted home infrastructure monitoring dashboard (Coruscant)*
*Researched: 2026-04-02*
*Note: Web access was unavailable during research. All findings based on training knowledge (cutoff August 2025). Critical items to verify before implementation: Pi-hole version (v5 vs v6 auth differs significantly), UniFi controller version (UDM OS vs classic), Ring API (`ring-client-api`) current maintenance status.*
