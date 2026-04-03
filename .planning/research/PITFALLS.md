# Pitfalls Research

**Domain:** Self-hosted home infrastructure monitoring dashboard (Docker on Synology NAS)
**Researched:** 2026-04-02
**Confidence:** MEDIUM — web search tools unavailable; findings drawn from training data covering well-documented homelab/self-hosted community patterns. High-traffic issues (Synology Docker UID, SQLite in Docker, WebSocket proxying) are widely documented and carry higher confidence. Niche items (Ubiquiti API rate limits, Synology DSM session management specifics) should be validated during implementation.

---

## Critical Pitfalls

### Pitfall 1: Synology Container Manager UID/GID Permission Mismatch

**What goes wrong:**
Containers run as a non-root user (e.g., `node`, `uid=1000`) but bind-mount paths on the Synology filesystem are owned by the `admin` group (`gid=101`) or a specific Synology user. On first run the container either fails to write data, silently writes to the wrong location, or creates files the NAS UI can't read back. This is particularly insidious for the SQLite database and any config files persisted to `/volume1/docker/coruscant/`.

**Why it happens:**
Synology DSM uses its own UID/GID scheme. Docker Desktop users are used to bind mounts "just working" because macOS VMs reconcile permissions automatically. On Synology, the host filesystem permissions are real Linux permissions and the container's UID must match or the volume owner must be set explicitly.

**How to avoid:**
- In `docker-compose.yml`, set `user: "1000:1000"` only after verifying the bind-mount path is owned by UID 1000 on the host, or set the path ownership first via SSH: `chown -R 1000:1000 /volume1/docker/coruscant/data`.
- Alternatively, run the container as root and drop privileges in the entrypoint — less ideal but avoids the mismatch.
- Document the required host-side setup in a `SETUP.md` next to the compose file.

**Warning signs:**
- Container starts but database file is never created (or is zero bytes).
- Logs show `EACCES` or `permission denied` on startup.
- The app works fine locally with Docker Desktop but fails on Synology.

**Phase to address:** Infrastructure foundation phase (first Docker Compose scaffold). Get volume ownership right before any data persistence code is written.

---

### Pitfall 2: SQLite File Lives Inside the Container Layer

**What goes wrong:**
The SQLite database file path is defined relative to the working directory (e.g., `./data/coruscant.db`) without a bind mount. The file is created inside the container's writable layer. Everything works until the container is rebuilt or updated — then all historical data, settings, and credentials are silently destroyed.

**Why it happens:**
In development the path works. It's easy to forget to add a `volumes:` entry in `docker-compose.yml` before first deploy. Container Manager's UI doesn't warn you.

**How to avoid:**
- Define the data path as an environment variable (`DB_PATH=/data/coruscant.db`) and mount `/data` as a named volume or bind mount from day one in `docker-compose.yml`.
- Add a startup assertion: if the DB directory is not writable, exit with a clear error rather than silently using a temp path.
- Test data persistence explicitly before any other feature: `docker compose down && docker compose up` should not lose data.

**Warning signs:**
- No `volumes:` entry in `docker-compose.yml` for the service.
- Database file found at a path inside the image (visible with `docker exec coruscant ls /app/data` showing files not reflected in host filesystem).
- Settings reset after container restart.

**Phase to address:** Infrastructure foundation phase. Add the persistence test as an explicit acceptance criterion.

---

### Pitfall 3: Aggressive Polling Degrades Services or Triggers Defense Mechanisms

**What goes wrong:**
Polling every service every 5–10 seconds across 10+ integrations creates a sustained API load that can: degrade Plex transcoding performance (extra API overhead on the same CPU), cause Pi-hole's web UI to become sluggish, trigger Ubiquiti UniFi's built-in rate limiter (returns 429s or drops the session), and make the NAS's own DSM API return errors under NAS load spikes. The dashboard's "always fresh" goal leads developers to set the shortest interval they can, without measuring cumulative impact.

**Why it happens:**
Each integration is developed and tested in isolation. Polling Plex every 10 seconds seems fine in a unit test. But 10 integrations × 10-second intervals = 60+ API calls per minute against services running on the same host or local network, simultaneously, in a tight event loop.

**How to avoid:**
- Assign per-service poll intervals based on data volatility: Plex active streams (15s), NAS hardware stats (30s), Radarr/Sonarr status (60s), Pi-hole stats (60s), Ubiquiti (30–60s), network equipment (60s). Never below 10s for any integration.
- Stagger poll starts with a small random jitter (0–5s offset per service) so all timers don't fire simultaneously.
- Implement a circuit breaker: if a service returns 3+ consecutive errors, back off to 5-minute intervals and surface a warning on the dashboard.
- For Ubiquiti UniFi specifically: use the WebSocket event stream if available rather than polling the REST API, as the controller supports push-based updates.

**Warning signs:**
- NAS CPU spikes visible in DSM during dashboard activity.
- Integration returns 429 or connection reset errors in logs.
- Plex playback stutters when the dashboard is open.
- Dashboard polling overwhelms pi-hole's FTL process (visible via pi-hole logs).

**Phase to address:** Backend polling engine phase. Establish configurable intervals and jitter before wiring up integrations; don't retrofit it.

---

### Pitfall 4: Credentials Stored in Plain `.env` Files Committed to Git

**What goes wrong:**
API keys, Plex tokens, Pi-hole passwords, Pushover app keys, and DSM credentials end up in a `.env` file that is committed to the GitHub repo. Because this is a personal project, the repo may be public, or it may go public later. Even in a private repo, the secrets are in git history permanently.

**Why it happens:**
Docker Compose's `env_file:` directive encourages a single `.env` at the repo root. The developer creates it, it works immediately, and there's no friction prompting them to `.gitignore` it. The GitHub repo is set up for CI/CD and the `.env` gets added with `git add .`.

**How to avoid:**
- Add `.env` and any `*.env` to `.gitignore` before the first commit — before writing any secrets to them.
- Provide a `.env.example` with placeholder values and document every required variable.
- For Docker secrets, use Docker Compose's `secrets:` block to mount secrets from files at `/run/secrets/` instead of environment variables, making them invisible to `docker inspect`.
- On Synology, store sensitive bind-mounted files outside the git-tracked project directory (e.g., `/volume1/docker/coruscant/secrets/` not `/volume1/docker/coruscant/repo/secrets/`).

**Warning signs:**
- `git log --all -- .env` shows any history.
- `git status` after `docker compose up` shows `.env` as a tracked file.
- `docker inspect coruscant` reveals full credential values in the `Env` array.

**Phase to address:** Infrastructure foundation phase (day one). Non-negotiable before any integration credentials are added.

---

### Pitfall 5: WebSocket Connections Drop on NAS Hibernate/Wake or Under Nginx Proxy

**What goes wrong:**
Coruscant uses WebSockets to push real-time updates to the browser. Two failure modes: (1) The Synology NAS enters its HDD hibernation state; when it wakes, the Node process is briefly unresponsive and all open WebSocket connections are terminated. The browser receives no data but shows no error — the dashboard appears live but is frozen. (2) A reverse proxy (Synology's built-in Application Portal or nginx) has a default timeout (often 60s) that kills idle WebSocket connections, causing silent disconnection.

**Why it happens:**
WebSocket keep-alive (ping/pong) is not enabled by default in most Node.js WebSocket libraries. The browser's WebSocket API has no automatic reconnect. The proxy timeout is a config detail that's easy to miss.

**How to avoid:**
- Implement server-side WebSocket ping every 30s (within the 60s proxy timeout window) and terminate connections that don't respond within 5s.
- Implement browser-side exponential backoff reconnect: on `onclose`, wait 1s then retry, doubling up to 30s, then poll at 30s indefinitely. Show a "Reconnecting..." indicator in the UI.
- If routing through Synology's Application Portal (reverse proxy), set the custom header `Upgrade: websocket` and increase proxy timeout to 3600s via the custom nginx config.
- Validate the full wake-from-hibernate flow explicitly: put the NAS to sleep, wake it, verify the dashboard reconnects within 60s without a page reload.

**Warning signs:**
- Dashboard data stops updating but the page shows no error state.
- Browser devtools shows the WebSocket connection in `CLOSING` or `CLOSED` state while the UI displays a healthy indicator.
- Logs show no new WebSocket messages after several minutes of inactivity.

**Phase to address:** Real-time transport layer phase. Build reconnect logic before wiring up any live data displays.

---

### Pitfall 6: Synology DSM API Session Expiry Breaks Monitoring Silently

**What goes wrong:**
The Synology DSM API (used for NAS hardware stats) requires a session token obtained via `/webapi/auth.cgi`. Tokens expire (default: 24–48 hours). When the token expires, subsequent API calls return an auth error, but if the error handling just logs and continues, the NAS stats card shows stale data indefinitely. The card appears "healthy" (last known good values) while the session has actually been dead for hours.

**Why it happens:**
Developers authenticate once on startup and store the token in memory. Works great for days, then silently fails after the session expires. Re-authentication logic is an afterthought.

**How to avoid:**
- Treat every DSM API call as potentially auth-expired: on a 403 or `error_code: 105` (`SYNOAPIErrorInvalidSession`) response, re-authenticate automatically and retry the request once.
- Persist the session ID to SQLite so it survives container restarts; validate it on startup with a lightweight `info.cgi` ping.
- Surface stale-data age in the UI: show a small "last updated X ago" on the NAS card; if data is >2 min old, show amber state.

**Warning signs:**
- NAS stats show the same values for long periods.
- Logs show `401` or `error_code: 105` responses from DSM API.
- Container restart "fixes" the NAS card temporarily.

**Phase to address:** NAS integration phase. Build auth-refresh into the DSM client from the start, not as a bugfix.

---

### Pitfall 7: CSS Animations Tank Mobile Performance (Especially on Older iPhones)

**What goes wrong:**
The Tron aesthetic requires animated grid backgrounds, traveling light pulses, glowing pulsing borders, and scan/flicker effects. Implemented naively (animating `box-shadow`, `background-position` on large elements, `filter: blur()`, or `opacity` on non-composited layers), these trigger layout and paint on every frame, consuming the main thread. On an iPhone with a 60Hz ProMotion screen (or an older device at 60fps), this appears as constant jank: the dashboard feels slow to scroll, cards flicker, and the battery drains noticeably.

**Why it happens:**
CSS animations look smooth on a development MacBook. Mobile GPUs have far less memory bandwidth, and the browser compositor can only offload animations that exclusively use `transform` and `opacity` on their own compositing layer. Animating `box-shadow` (re-paints every frame), large `background-size` gradients, or `filter` on many elements simultaneously breaks GPU compositing.

**How to avoid:**
- Restrict animations to `transform` (translate, scale) and `opacity` only — these are the only properties the browser compositor can handle without triggering layout or paint.
- For glowing effects, use `box-shadow` only on small, isolated elements (individual dots, not full cards). Prefer `filter: drop-shadow()` on SVG elements which composites better.
- For the animated grid background, use a `<canvas>` element with `requestAnimationFrame` rather than CSS `background-position` animation — gives direct control over render cost.
- Add `will-change: transform` to elements with active animations, but use sparingly (each creates a new compositing layer, consuming GPU memory).
- Test on an actual iPhone (not just desktop Chrome's device emulator) during the UI development phase.
- Provide a `prefers-reduced-motion` media query escape hatch that disables particle/pulse animations and falls back to a static glow.

**Warning signs:**
- DevTools > Performance panel shows long "Paint" or "Layout" entries during animation.
- `Rendering > Paint Flashing` shows large painted areas on every frame.
- Dashboard visible framerate noticeably below 60fps on physical mobile device.
- Battery gets warm during normal dashboard viewing.

**Phase to address:** UI foundation phase, when the Tron animation system is first built. Do not defer "make it smooth" to a polish phase — the animation architecture must be correct from the start.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode poll intervals (no config) | Faster to build | Can't tune without redeploy; no per-service control | Never — use env vars or DB config from day one |
| Single WebSocket for all service data | Simpler server logic | One slow integration blocks all real-time updates; reconnect resets everything | Never — multiplex per-service channels or use heartbeat-aware connection pools |
| Store all integration credentials in one env var block | Works immediately | No granular rotation; all credentials visible in `docker inspect` | MVP only — migrate to Docker secrets before adding sensitive credentials (Plex tokens, DSM password) |
| Polling as the only data transport | Dead simple | CPU waste, latency; can't react to push events from services that support them | Acceptable for v1; upgrade push-capable integrations (Ubiquiti WS, Plex webhooks) in v2 |
| No stale-data indicators in UI | Cleaner UI | Users see outdated data and trust it; silent failures look like healthy state | Never — always show "last updated" timestamps on data-bearing cards |
| Embed all components in one large React/Svelte file | Fast initial scaffold | Impossible to test, re-use, or extend incrementally | Spike/prototype only, never committed |
| Use `latest` Docker image tag for dependencies | No version pinning friction | Breaking changes on next deploy; non-reproducible builds | Never — pin all image versions |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Plex Media Server | Using the `X-Plex-Token` from the Plex web URL (which is a short-lived user session token) instead of a proper managed token | Generate a dedicated server token via `POST /users/sign_in.json` to plex.tv with user credentials to get a permanent user auth token, then use the server's `accessToken` from `GET /`; store this, not URL-scraped tokens |
| Plex Media Server | Polling `/status/sessions` every few seconds to detect stream changes | Use Plex's webhook mechanism (Settings > Webhooks) to receive `media.play`, `media.pause`, `media.stop` events; fall back to 15s polling only if webhooks aren't reachable |
| Pi-hole v5/v6 | Using the old v5 API (`/admin/api.php?auth=TOKEN`) when running Pi-hole v6 which has a completely different REST API with bearer tokens | Check Pi-hole version at startup and route to the appropriate API client; Pi-hole v6 uses `POST /api/auth` to get a JWT |
| Ubiquiti UniFi | Authenticating against the old `/api/login` endpoint which was deprecated in UniFi Network Application 7.x | Use `/api/auth/login` for newer controllers; detect controller version via `/api/self` and branch accordingly |
| Ubiquiti UniFi | Creating a new authenticated session on every polling cycle | Session cookies are valid for hours; maintain the session in the polling service and re-authenticate only on 401 |
| Synology DSM | Using the `admin` account credentials for API access | Create a dedicated DSM user with read-only permissions scoped to the APIs needed (InfoCenter, Storage, Hardware); reduces blast radius if credentials leak |
| Synology DSM | Calling `auth.cgi` with `format=cookie` and then trying to pass that in headers | DSM auth returns either a `sid` (session ID) for use in query params or a cookie; pick one strategy and be consistent — mixing them causes random auth failures |
| SABnzbd | Using the API key from the config file directly | SABnzbd exposes an API key in its web UI settings; however, if `host_whitelist` is not set, SABnzbd may reject requests from the Docker container's internal IP. Add the container's subnet to `host_whitelist` or use `0.0.0.0` carefully |
| Google Nest | Attempting to use the deprecated Works with Nest API | Nest migrated to Google's Smart Device Management (SDM) API which requires OAuth2 with Google Cloud project setup; this is non-trivial and may not be worth the effort for status-only indicators |
| Amazon Ring | Using third-party Ring API libraries (ring-client-api) | Ring has no official API; third-party libs reverse-engineered from the mobile app and break on Ring firmware/backend updates. Treat this as LOW reliability, flag it in the UI |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full Plex library metadata on every poll | Plex API response times >500ms, high Plex CPU | Only fetch `/status/sessions` for live data; never poll `/library/sections` on a timer | Immediately if Plex library is large (>10k items) |
| Querying SQLite with no index on `timestamp` for log display | Log viewer loads slowly, scrolling is laggy | Add `CREATE INDEX idx_logs_timestamp ON logs(timestamp DESC)` at schema creation | When log table exceeds ~50k rows (days of operation at 5s polling) |
| Re-rendering the entire dashboard on every WebSocket message | UI jank when multiple services update simultaneously | Reconcile incoming data into a store (Zustand, Nanostores, Svelte stores) and only re-render affected cards | As soon as 3+ services are live |
| Sending full service snapshots over WebSocket instead of diffs | High WebSocket message volume, unnecessary parsing | Send only changed fields; use a diff structure (`{service: "plex", changed: {streams: 2}}`) | At 10+ services × 30s intervals = high sustained throughput |
| Running SQLite without WAL mode | Writes block reads, UI log viewer hangs during write bursts | Enable `PRAGMA journal_mode=WAL` on DB open | Under any concurrent read+write (standard operation) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API proxy endpoint at `/api/proxy?url=<any_url>` for integration calls | SSRF: attacker on local network can probe internal services via the dashboard | Maintain an allowlist of permitted upstream base URLs; never pass arbitrary URLs from the client |
| Dashboard accessible on all NAS interfaces without authentication | Anyone on the LAN (or Tailscale network) can view infrastructure details | Add at minimum a single shared password (HTTP Basic Auth via nginx, or app-level session) even for a personal tool |
| Logging full API responses including auth tokens in the app log viewer | Plex tokens, DSM session IDs visible in the UI log stream | Scrub tokens from log output; use a log sanitizer that replaces known secret patterns with `[REDACTED]` |
| Docker socket mount (`/var/run/docker.sock`) for container status | Full Docker API access = root on the host | Avoid mounting the socket entirely; use the Synology API or a read-only health endpoint approach; if needed, use a Docker socket proxy (Tecnativa's socket-proxy image) |
| Pushover API token stored as plain env var exposed to all container processes | Token can be extracted from `docker inspect` or read via a compromised process | Move Pushover token to a Docker secret or a file mount; read it at startup only |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No error state distinct from "loading" | User can't tell if a service is down or the data just hasn't loaded yet | Three states from the start: loading (spinner/skeleton), healthy (data), error (red state + last-seen time) |
| Status indicators update only when the dashboard is focused | Opening dashboard after hours away shows stale data with no visual indication | Show data age on each card; mark cards amber if data is older than 2× the poll interval |
| Tron animations playing during error/down states | A beautifully animated card makes a downed service look healthy | Dim or desaturate animations on error state; a "dead" card should feel visually different from a live one |
| "Click for detail" not discoverable on mobile | Users don't know cards are tappable; core drill-down feature unused | Use subtle tap affordance (border highlight, touch ripple) and a small indicator icon on tappable cards |
| Log viewer shows all logs by default (no filter) | 50k log entries scroll-jank on first open | Default to last 100 entries; provide filter by service and level; paginate or virtualize the list |
| Settings page saves credentials immediately on field change | Accidental keypress mid-edit causes a bad credential to be saved | Save only on explicit "Save" button press; validate the credential (ping the service) before committing |
| Dashboard layout breaks on notched iPhones (iPhone X+) | Core UX broken for primary device | Use `env(safe-area-inset-*)` CSS variables for padding; test on a notched viewport from day one |

---

## "Looks Done But Isn't" Checklist

- [ ] **WebSocket reconnect:** The connection shows "connected" in devtools — verify it actually reconnects after `docker compose restart` without a page reload.
- [ ] **Data persistence:** The database file survives `docker compose down && docker compose up` — verify by checking row count before and after.
- [ ] **SQLite WAL mode:** The schema creation SQL includes `PRAGMA journal_mode=WAL` — verify with `PRAGMA journal_mode;` query.
- [ ] **Credential redaction in logs:** POST a bad credential and check the app log viewer — the bad credential string must not appear in log output.
- [ ] **Mobile safe area:** Open the dashboard on a physical notched iPhone — verify no content is hidden under the notch or home indicator.
- [ ] **Stale data indicator:** Kill one integration's upstream service, wait 3 minutes — verify the card shows amber/stale state, not the last healthy value with no warning.
- [ ] **Circuit breaker active:** Set an integration to an invalid URL, wait for 3 poll failures — verify poll interval backs off and dashboard shows error state.
- [ ] **`.env` not in git:** Run `git log --all -- .env` — output must be empty.
- [ ] **Pi-hole version detection:** Test against both v5 and v6 Pi-hole API — the same client must handle both or fail gracefully.
- [ ] **NAS hibernate/wake:** Put NAS to sleep, wait for HDD spindown, wake it — verify dashboard reconnects and shows fresh data within 60s.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SQLite file in container layer (data lost after update) | HIGH | Restore from backup if any; if no backup, accept data loss; add volume mount immediately and document backup strategy going forward |
| Credentials committed to git | HIGH | Rotate all committed credentials immediately (Plex token, DSM password, Pi-hole API key, Pushover token); use `git filter-repo` to purge history; make repo private if public |
| Docker socket mounted — container compromised | HIGH | Revoke NAS admin access, rebuild NAS OS from scratch; remove socket mount; implement socket proxy |
| Animations janking on mobile (wrong CSS properties) | MEDIUM | Audit all `@keyframes` and `transition` rules; replace any non-`transform`/`opacity` animated properties; refactor background animation to canvas |
| Poll interval too aggressive, services degraded | LOW | Reduce intervals in env vars, restart container; services recover within minutes once load drops |
| DSM session expired, stale NAS data | LOW | Restart container (re-authenticates on startup) while permanent fix (auto-refresh logic) is added |
| WebSocket not reconnecting after NAS wake | LOW | Page reload as user workaround; implement reconnect logic in next release cycle |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| UID/GID permission mismatch on Synology volumes | Infrastructure foundation | Write test: container writes to bind-mount path, host can read file with correct ownership |
| SQLite file in container layer | Infrastructure foundation | Persistence test: `docker compose down && up` retains row count |
| Credentials in git | Infrastructure foundation (day one) | `git log --all -- .env` returns empty; `.gitignore` contains `.env` |
| Aggressive polling / no circuit breaker | Backend polling engine | Configurable intervals in env; circuit breaker activates on 3 consecutive failures in test |
| WebSocket silent disconnection | Real-time transport layer | NAS wake/sleep integration test passes without page reload |
| DSM session expiry | NAS integration | Auth-refresh test: manually expire session, verify next poll re-authenticates automatically |
| CSS animations tanking mobile | UI foundation (Tron animation system) | Physical iPhone performance test; DevTools shows no paint/layout in animation frames |
| Stale data shown as healthy | Any integration phase | Kill upstream service, wait 2× poll interval, verify amber stale state appears |
| Plex wrong token type | Plex integration phase | Token survives container restart (not a session token); verify with server `/` endpoint |
| Pi-hole v5 vs v6 API divergence | Pi-hole integration phase | Test suite runs against both API versions (or mock both) |

---

## Sources

- Training knowledge of Synology DSM Docker/Container Manager behavior, UID/GID patterns on DSM 7.x (MEDIUM confidence — well-documented in homelab communities, no live verification)
- SQLite WAL mode and Docker persistence patterns — documented in SQLite official docs and widely confirmed in homelab discussions (HIGH confidence)
- WebSocket keep-alive and proxy timeout behavior — standard nginx/WebSocket interaction, widely documented (HIGH confidence)
- Plex API token types — documented in Plex developer forums and community wikis (MEDIUM confidence — verify token generation flow against current plex.tv API)
- Pi-hole v5 vs v6 API divergence — Pi-hole v6 introduced breaking API changes (MEDIUM confidence — verify current Pi-hole version in the deployment)
- CSS compositing layer rules (`transform`/`opacity` only) — documented in MDN, Google Web Fundamentals, Chrome DevTools docs (HIGH confidence)
- Ubiquiti UniFi API endpoint versioning — confirmed across UniFi community forums and homelab wikis (MEDIUM confidence — test against actual controller version)
- Docker Compose `secrets:` block — official Docker documentation (HIGH confidence)
- Tailscale subnet routing — Tailscale official documentation (HIGH confidence for basic subnet routing; specific Synology interactions MEDIUM)
- Google Nest/SDM API migration — Google deprecated Works with Nest in August 2023 (HIGH confidence)
- Amazon Ring unofficial API fragility — well-known limitation in ring-client-api and related projects (HIGH confidence)

---
*Pitfalls research for: Self-hosted home infrastructure monitoring dashboard (Coruscant)*
*Researched: 2026-04-02*
