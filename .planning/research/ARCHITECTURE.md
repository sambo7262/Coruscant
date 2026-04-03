# Architecture Research

**Domain:** Self-hosted home infrastructure monitoring dashboard (Docker on Synology NAS)
**Researched:** 2026-04-02
**Confidence:** MEDIUM-HIGH (based on established patterns from Uptime Kuma, Homarr, Scrutiny, Dashdot source analysis; web verification unavailable during this session)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER CLIENT                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React SPA (mobile-first)                                │   │
│  │  Dashboard cards · Detail views · Settings · Log viewer  │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │ WebSocket (live updates)              │
│                          │ REST/tRPC (config writes, fetches)    │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    DOCKER CONTAINER                               │
│                          │                                       │
│  ┌───────────────────────▼──────────────────────────────────┐   │
│  │  API Layer (Express / Fastify)                           │   │
│  │  REST endpoints · WebSocket server · SSE fallback        │   │
│  └───────────┬──────────────────────────┬────────────────────┘   │
│              │                          │                        │
│  ┌───────────▼──────────┐   ┌───────────▼──────────────────┐   │
│  │  Polling Engine       │   │  Config & Secrets Layer      │   │
│  │  Scheduler (node-cron │   │  Reads env vars / mounted    │   │
│  │  or p-queue)          │   │  secrets file at startup      │   │
│  │  Per-service adapters │   └──────────────────────────────┘   │
│  │  Timeout handling     │                                       │
│  │  Retry/backoff        │                                       │
│  └───────────┬──────────┘                                       │
│              │                                                   │
│  ┌───────────▼──────────────────────────────────────────────┐   │
│  │  Service Adapters (one per integration)                  │   │
│  │  Radarr · Sonarr · Lidarr · Bazarr · SABnzbd             │   │
│  │  Pi-hole · Plex · Synology DSM · Ubiquiti · Pushover     │   │
│  │  Nest (if feasible) · Ring (if feasible)                 │   │
│  └───────────┬──────────────────────────────────────────────┘   │
│              │                                                   │
│  ┌───────────▼──────────────────────────────────────────────┐   │
│  │  Data Layer                                              │   │
│  │  SQLite (via better-sqlite3)                             │   │
│  │  Poll results · History · Config · Logs                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                           │ outbound HTTP only
┌──────────────────────────┼──────────────────────────────────────┐
│                  HOME NETWORK SERVICES                            │
│  Radarr  Sonarr  Lidarr  Bazarr  SABnzbd  Pi-hole  Plex         │
│  Synology DSM API  Ubiquiti Controller  Ring API  Nest API       │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React SPA | Render dashboard, cards, detail views, settings UI | React + Vite, Tanstack Query for data, Zustand for UI state |
| WebSocket server | Push live poll results to connected clients | ws or socket.io, embedded in the same Node process |
| REST/tRPC API | Config CRUD, log retrieval, manual refresh triggers | Express or Fastify with tRPC for type-safe RPC |
| Polling Engine | Schedule and execute service polls at configurable intervals | node-cron for schedule; p-queue for concurrency control |
| Service Adapters | Encapsulate all API knowledge for a single service | One class/module per service; implements a common interface |
| Config & Secrets Layer | Load credentials from env vars or mounted file at startup | dotenv + Docker Compose `environment:` or `secrets:` |
| Data Layer | Persist poll snapshots, config, logs | SQLite via better-sqlite3 (synchronous, zero-dependency) |
| Notification Dispatcher | Fire Pushover alerts when thresholds are breached | Stateless function called by polling engine; rate-limited |

---

## How Reference Tools Structure This (Confidence: HIGH)

### Uptime Kuma
- **Backend:** Node.js + Express + Socket.IO. Single process.
- **Frontend:** Vue 3 SPA served by the same Express server.
- **Database:** SQLite via `knex`. One file at `/app/data/kuma.db`.
- **Real-time:** Socket.IO (WebSocket with fallback). Backend emits heartbeat events after each poll; frontend subscribes and rerenders.
- **Polling:** A per-monitor interval timer calls an async check function. Results are written to SQLite then emitted over Socket.IO.
- **Lesson for Coruscant:** The single-process model is correct for a home NAS. Socket.IO's full duplex is overkill if you only push from server to client — SSE would suffice, but Socket.IO is fine.

### Homarr
- **Backend:** Next.js (full-stack). API routes handle service integrations.
- **Frontend:** Next.js pages/app router. React.
- **Database:** SQLite (Drizzle ORM) in newer versions; flat YAML config files in older versions.
- **Real-time:** Client-side polling via `setInterval` on the frontend (not WebSocket). Simple but adds visible latency.
- **Lesson for Coruscant:** Client-side polling is the simplest approach but means every browser tab hammers the backend independently. A server-push model (SSE or WebSocket) is better for a live "always-on" dashboard.

### Scrutiny
- **Backend:** Go binary (InfluxDB + SQLite for metrics).
- **Frontend:** Angular SPA.
- **Database:** InfluxDB for time-series disk metrics; SQLite for config.
- **Real-time:** Polling-only; no live push.
- **Lesson for Coruscant:** InfluxDB for disk metrics is overkill at home scale. SQLite handles hundreds of thousands of rows without issue.

### Dashdot
- **Backend:** Node.js (NestJS). Streams hardware metrics via SSE.
- **Frontend:** React + Recharts.
- **Database:** No persistence — hardware metrics are ephemeral, read on demand from the OS.
- **Real-time:** SSE. The frontend subscribes to `/api/system/sse` and redraws charts on each event.
- **Lesson for Coruscant:** SSE is the right model for streaming live data. Simpler than WebSocket because it's unidirectional (server → client only), which is exactly what a dashboard needs.

---

## Recommended Architecture Decisions

### 1. Polling vs Push

**Decision: Server-side polling with WebSocket push to browser.**

Most home services (Radarr, Sonarr, Pi-hole, Ubiquiti, Plex, Synology DSM) expose HTTP REST APIs — they do not push events. The backend must poll them on a schedule.

Once the backend has fresh data, it pushes to the browser via WebSocket or SSE. This means:
- Browser opens one persistent connection; no per-tab polling overhead.
- Poll interval is controlled server-side, not by however many tabs the user has open.
- Notifications (Pushover) can be evaluated server-side immediately after each poll result.

Use SSE (`/api/stream`) over WebSocket unless bidirectional communication is needed (it isn't — the browser only reads live data, it doesn't send commands over the stream). SSE is simpler, works over standard HTTP/1.1, has built-in browser reconnect, and is easier to proxy through Synology's reverse proxy.

**Polling intervals by service tier:**

| Tier | Services | Recommended Interval |
|------|----------|----------------------|
| Status-only | Radarr, Sonarr, Lidarr, Bazarr | 60s |
| Activity | SABnzbd | 10s (active download progress) |
| Rich data | Pi-hole, Plex, NAS, Ubiquiti | 30s |
| Smart home | Nest, Ring | 120s (rate-limited APIs) |

### 2. Real-time Frontend Updates

**Decision: Server-Sent Events (SSE) for live dashboard data.**

SSE characteristics relevant to this project:
- Unidirectional: server → client only. Correct for a read-only dashboard.
- Single long-lived HTTP connection per client.
- Browser auto-reconnects on disconnect (built into the EventSource API).
- Works cleanly through Synology's Nginx reverse proxy (if used).
- No library dependency on the client — native `EventSource` API.

Use tRPC or REST for mutations (saving config, API keys, thresholds). SSE is only for the live data stream.

**Event payload structure:**
```typescript
// Server emits after each poll cycle
type ServiceUpdateEvent = {
  type: 'service_update';
  serviceId: string;
  timestamp: number;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  data: Record<string, unknown>; // service-specific payload
};

type SystemEvent = {
  type: 'poll_cycle_complete';
  timestamp: number;
  duration_ms: number;
};
```

### 3. Credential / API Key Storage

**Decision: Environment variables via Docker Compose; never store credentials in the database.**

Pattern used by Uptime Kuma, Homarr, Scrutiny, and most self-hosted tools:

```yaml
# docker-compose.yml
services:
  coruscant:
    environment:
      - PLEX_TOKEN=${PLEX_TOKEN}
      - PIHOLE_API_KEY=${PIHOLE_API_KEY}
      - PUSHOVER_USER_KEY=${PUSHOVER_USER_KEY}
      - PUSHOVER_APP_TOKEN=${PUSHOVER_APP_TOKEN}
      - SABNZBD_API_KEY=${SABNZBD_API_KEY}
      - UBIQUITI_PASSWORD=${UBIQUITI_PASSWORD}
```

Store service endpoints (URLs) in the database (they're not secret). Store credentials only in env vars loaded from a `.env` file that lives outside the container and is `.gitignore`d.

**Settings UI writes endpoint URLs to the database. Credentials are never written through the UI — they are set in the `.env` file.** This is the correct security boundary for a home self-hosted app: the settings page configures which services to show and at what URL; the `.env` file holds the keys.

**Why not Docker secrets (the swarm feature)?** Container Manager on Synology DSM supports Docker Compose but not Docker Swarm secrets natively. Env vars + `.env` file is the correct approach here.

### 4. Database / Storage

**Decision: SQLite via `better-sqlite3`. No Postgres, no InfluxDB.**

Rationale:
- **No separate container.** Postgres requires its own container, volume, health checks, and connection pooling. For a single-user dashboard on a home NAS, this is pure overhead.
- **SQLite is fast enough.** 30-second poll intervals with 15 services = ~30 writes/minute. SQLite handles tens of thousands of writes per second.
- **Synology NAS storage is the right persistence layer.** A mounted volume means the database file survives container restarts and upgrades.
- **Schema migrations are simple** with `better-sqlite3` + a hand-rolled migration runner (or Drizzle ORM, which has a built-in migrator).

**What goes in SQLite:**

| Table | Contents | Retention |
|-------|----------|-----------|
| `service_configs` | Service name, URL, enabled flag, poll interval | Permanent |
| `poll_results` | service_id, timestamp, status, raw JSON payload | Rolling 30 days |
| `threshold_configs` | service_id, metric_key, operator, threshold value | Permanent |
| `notification_log` | timestamp, service_id, message, delivered_at | Rolling 90 days |
| `app_logs` | timestamp, level, message, context | Rolling 7 days |

**What stays ephemeral (in memory only):**

- Current status for each service (held in-memory; rebuilt on restart from last poll result)
- Active SSE client connections
- In-flight HTTP requests to services

**Automatic data pruning:** A nightly scheduled job (node-cron) deletes rows older than retention thresholds. This prevents unbounded SQLite file growth.

### 5. Multi-Service Polling Architecture

**Decision: One scheduler per service, managed by a central polling engine. Use `p-queue` for concurrency control.**

```
PollingEngine
├── ServiceScheduler (one per enabled service)
│   ├── Interval timer (configurable per service)
│   ├── Calls: adapter.poll() with timeout
│   ├── On success: writes to DB, emits SSE event
│   ├── On timeout: marks service as 'degraded', emits SSE event
│   └── On error: marks service as 'down', backoff on next attempt
└── p-queue (global concurrency limit: 5 concurrent polls)
```

**Key behaviors:**
- **Per-service timeouts:** Each `adapter.poll()` call wraps the HTTP request in a `Promise.race` against a configurable timeout (default 10s). A slow service cannot stall the whole engine.
- **Jitter on startup:** Stagger initial poll times by a random 0-5s delay so all services don't fire simultaneously on container start.
- **Failure backoff:** After 3 consecutive failures, double the poll interval (up to max 5× base interval). Reset on success.
- **Manual refresh:** The REST API exposes `POST /api/services/:id/refresh` which enqueues an immediate poll bypassing the schedule.

**Service adapter interface:**
```typescript
interface ServiceAdapter {
  readonly serviceId: string;
  poll(): Promise<PollResult>;  // must resolve or reject within timeout
}

type PollResult = {
  status: 'up' | 'down' | 'degraded';
  latency_ms: number;
  data: Record<string, unknown>; // service-specific structured data
  raw?: unknown;                  // raw API response for debugging
};
```

This interface makes adding new integrations trivial: implement one class, register it, done.

---

## Recommended Project Structure

```
coruscant/
├── docker-compose.yml          # Deployment definition
├── .env.example                # Template with all required vars (no values)
├── .env                        # Actual secrets — gitignored
├── Dockerfile                  # Multi-stage: build + production image
│
├── packages/
│   ├── server/                 # Node.js backend
│   │   ├── src/
│   │   │   ├── adapters/       # One file per service integration
│   │   │   │   ├── plex.ts
│   │   │   │   ├── pihole.ts
│   │   │   │   ├── radarr.ts
│   │   │   │   ├── sonarr.ts
│   │   │   │   ├── lidarr.ts
│   │   │   │   ├── bazarr.ts
│   │   │   │   ├── sabnzbd.ts
│   │   │   │   ├── synology.ts
│   │   │   │   ├── ubiquiti.ts
│   │   │   │   ├── ring.ts     # If feasible
│   │   │   │   └── nest.ts     # If feasible
│   │   │   ├── polling/
│   │   │   │   ├── engine.ts   # Scheduler and concurrency manager
│   │   │   │   └── backoff.ts  # Retry/backoff logic
│   │   │   ├── db/
│   │   │   │   ├── client.ts   # better-sqlite3 singleton
│   │   │   │   ├── migrations/ # Numbered SQL migration files
│   │   │   │   └── queries/    # Typed query functions (no raw SQL in business logic)
│   │   │   ├── api/
│   │   │   │   ├── router.ts   # Express/Fastify route definitions
│   │   │   │   ├── sse.ts      # SSE connection management
│   │   │   │   └── trpc.ts     # tRPC router (if used for type-safe RPC)
│   │   │   ├── notifications/
│   │   │   │   └── pushover.ts # Pushover dispatcher with rate limiting
│   │   │   ├── config/
│   │   │   │   └── secrets.ts  # Reads process.env at startup; validates required vars
│   │   │   └── index.ts        # Entry point
│   │   └── package.json
│   │
│   └── client/                 # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── cards/      # ServiceCard variants (status / activity / rich)
│       │   │   ├── layout/     # Grid, NowPlayingBanner, AnimatedBackground
│       │   │   └── ui/         # Shared primitives (glows, borders, dots)
│       │   ├── views/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── ServiceDetail.tsx
│       │   │   ├── Settings.tsx
│       │   │   └── Logs.tsx
│       │   ├── hooks/
│       │   │   ├── useSSE.ts   # EventSource subscription hook
│       │   │   └── useService.ts
│       │   ├── store/          # Zustand slices for UI state
│       │   └── main.tsx
│       └── package.json
│
└── data/                       # Docker volume mount point
    └── coruscant.db            # SQLite file (created on first run)
```

### Structure Rationale

- **`packages/server/src/adapters/`:** Each file owns exactly one service integration. Adding a new service = add one file. No cross-service coupling.
- **`packages/server/src/polling/`:** Polling logic is completely decoupled from adapters. The engine calls adapter interfaces; it doesn't know about HTTP.
- **`packages/server/src/db/queries/`:** All SQL is isolated here. Business logic imports typed functions, not raw query strings.
- **`data/`:** Mounted as a Docker volume. Separating it from the codebase ensures `docker compose down -v` is never accidentally run on the data directory.

---

## Data Flow

### Poll Cycle Flow (every N seconds per service)

```
PollingEngine scheduler fires
    ↓
Enqueue poll task in p-queue (respects concurrency limit)
    ↓
ServiceAdapter.poll() called with timeout guard
    ↓ (HTTP GET to home service API)
External service returns JSON
    ↓
Adapter transforms raw JSON → PollResult (typed, normalized)
    ↓
Write PollResult to SQLite (poll_results table)
    ↓
Evaluate thresholds against PollResult
    ↓ (if threshold breached)
Pushover notification dispatched (rate-limited: max 1 per service per 15min)
    ↓
Emit SSE event to all connected browser clients
    ↓
React dashboard re-renders affected service card
```

### Browser Connection Flow

```
Browser opens dashboard
    ↓
EventSource connects to GET /api/stream (SSE endpoint)
    ↓
Server registers client in active connection map
    ↓
Server immediately sends current snapshot of all services (initial payload)
    ↓
Browser renders dashboard from snapshot
    ↓
As polls complete → server emits service_update events
    ↓
React hook receives event → updates Zustand store → card re-renders
    ↓
On disconnect: server removes client from map; browser auto-reconnects after 3s
```

### Config Write Flow

```
User changes service URL in Settings UI
    ↓
React form submits POST /api/config/services/:id
    ↓
API validates input (URL must be reachable, not required to be up)
    ↓
Write new config to SQLite service_configs table
    ↓
PollingEngine notified of config change → restarts that service's scheduler
    ↓
Immediate poll enqueued for the changed service
    ↓
Result returned via SSE (normal flow)
```

---

## Docker Compose Structure (Synology Container Manager)

### Recommended docker-compose.yml

```yaml
version: "3.9"

services:
  coruscant:
    image: your-registry.local:5000/coruscant:latest
    container_name: coruscant
    restart: unless-stopped
    ports:
      - "3000:3000"       # Adjust host port as needed
    volumes:
      - ./data:/app/data  # SQLite database persistence
    env_file:
      - .env              # Credentials — never committed to git
    environment:
      - NODE_ENV=production
      - PORT=3000
    networks:
      - coruscant_net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

networks:
  coruscant_net:
    driver: bridge
```

### Synology NAS / Container Manager Gotchas

| Gotcha | Issue | Mitigation |
|--------|-------|------------|
| DSM user permissions | Container Manager runs containers as root by default; volume files owned by root | Set `PUID`/`PGID` env vars and use `chown` in entrypoint, or accept root-owned data files (acceptable for single-user home use) |
| Volume path syntax | Synology paths are under `/volume1/` or similar, not `/home/` | Use relative paths (`./data`) in compose file so it resolves relative to the compose file location, typically `/volume1/docker/coruscant/` |
| No Docker Swarm | Container Manager does not support Docker Swarm mode | Do not use `secrets:` (swarm feature); use `env_file:` with `.env` instead |
| Port conflicts | Ports 80/443/8080 often in use by DSM | Use a non-conflicting port (3000, 7575, 8888 are commonly available) |
| Reverse proxy | DSM has a built-in Nginx reverse proxy (Control Panel → Application Portal) | SSE requires `proxy_buffering off` and `proxy_read_timeout 3600` — set these in DSM's custom header config or skip the proxy and use direct IP:port |
| Restart policy | DSM Container Manager respects `restart: unless-stopped` | This is correct for a dashboard — it survives NAS reboots |
| Time zone | Container may default to UTC; log timestamps will look wrong | Add `TZ=America/Chicago` (or user's zone) to environment |
| Host networking | Using `network_mode: host` simplifies LAN service access but removes container network isolation | Prefer bridge network + service URLs configured to the NAS LAN IP; avoid host networking |

### SSE + Synology Reverse Proxy (Important)

If the user routes Coruscant through DSM's built-in Application Portal proxy, SSE connections will break without these custom Nginx headers:

```
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 3600s;
X-Accel-Buffering: no
```

DSM's Application Portal allows custom headers per application. If this configuration is too complex, bypassing the proxy entirely (direct IP:port access, which Tailscale makes easy) is the simpler path.

---

## Architectural Patterns

### Pattern 1: Adapter Pattern for Service Integrations

**What:** Each external service is encapsulated in a single module with a consistent interface. The polling engine calls `adapter.poll()` and doesn't know anything about HTTP, JSON parsing, or service-specific quirks.

**When to use:** Any time you have N integrations with different APIs but you want uniform behavior from the caller's perspective.

**Trade-offs:** Adds a layer of abstraction but makes the list of supported services immediately obvious from the filesystem and makes each integration independently testable.

```typescript
// All adapters implement this contract
interface ServiceAdapter {
  readonly serviceId: string;
  poll(): Promise<PollResult>;
}

// Radarr adapter example
class RadarrAdapter implements ServiceAdapter {
  readonly serviceId = 'radarr';
  constructor(private baseUrl: string, private apiKey: string) {}

  async poll(): Promise<PollResult> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/api/v3/system/status`, {
      headers: { 'X-Api-Key': this.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    return {
      status: res.ok ? 'up' : 'down',
      latency_ms: Date.now() - start,
      data: res.ok ? await res.json() : {},
    };
  }
}
```

### Pattern 2: Event Bus for Decoupling Polling from SSE

**What:** The polling engine emits typed events on an internal Node.js `EventEmitter`. The SSE layer subscribes to these events and forwards them to connected clients. Neither layer knows about the other.

**When to use:** When you need to decouple data production (polling) from data delivery (SSE). Also makes it easy to add a second consumer (e.g., notification dispatcher) without modifying polling logic.

**Trade-offs:** Slight indirection. For a home project, direct calls would also work. Use an event bus if you have 3+ consumers of poll results (SSE, notifications, DB writes).

```typescript
// Polling engine emits; SSE layer and notification layer subscribe
const pollBus = new EventEmitter();

// Polling engine
pollBus.emit('poll:result', { serviceId: 'radarr', result });

// SSE layer
pollBus.on('poll:result', ({ serviceId, result }) => {
  broadcastToClients({ type: 'service_update', serviceId, ...result });
});

// Notification layer
pollBus.on('poll:result', ({ serviceId, result }) => {
  evaluateThresholds(serviceId, result);
});
```

### Pattern 3: Snapshot + Delta SSE

**What:** When a browser client first connects to the SSE endpoint, the server immediately sends a complete snapshot of all current service states. Subsequent events are deltas (only changed services). This eliminates the race condition where the browser renders before the first poll cycle completes.

**When to use:** Always for this type of dashboard.

**Trade-offs:** Requires maintaining an in-memory current-state map on the server. Minimal overhead for ~15 services.

---

## Anti-Patterns

### Anti-Pattern 1: Client-Side Polling From the Browser

**What people do:** Set a `setInterval` in React to `fetch('/api/services')` every 10 seconds.

**Why it's wrong:** Every browser tab polls independently. Two tabs = double the load. Reconnect logic is manual. Threshold evaluation must happen either in the browser (wrong place) or on every GET request (wasteful). Notification timing becomes unreliable.

**Do this instead:** Server-side polling + SSE push. One source of truth, push to all connected clients, evaluate thresholds server-side.

### Anti-Pattern 2: Storing Credentials in SQLite

**What people do:** Build a settings UI that saves API keys and passwords to the database, then commit the database file to the repo or include it in the Docker image.

**Why it's wrong:** The database file is a backup target, often readable by multiple processes, and tempting to commit "just once." Credentials in a database file are one `SELECT *` away from leaking.

**Do this instead:** Env vars in `.env` for credentials. Database only stores URLs and threshold configuration. Settings UI allows configuring URLs; credentials are documented as env var names in `.env.example`.

### Anti-Pattern 3: One Polling Loop for All Services

**What people do:** A single `setInterval` fires every N seconds and polls ALL services sequentially.

**Why it's wrong:** Sequential polling means a slow or hung service blocks all others. If SABnzbd times out at 30s, Plex doesn't get polled. Dashboard goes stale for everything.

**Do this instead:** Separate scheduler per service with individual timeout guards. Use `p-queue` to limit concurrency so all polls don't fire in a burst but no single service blocks others.

### Anti-Pattern 4: Unbounded History in SQLite

**What people do:** Write every poll result to a table and never delete anything.

**Why it's wrong:** At 30-second intervals across 15 services, that's ~43,000 rows/day. A year = ~15M rows. SQLite will remain fast but the file will grow to several GB unnecessarily. NAS storage isn't infinite.

**Do this instead:** Scheduled nightly pruning job. Keep 30 days of results, 7 days of debug logs, 90 days of notification history.

### Anti-Pattern 5: Using Docker Swarm Secrets on Synology

**What people do:** Use `secrets:` in docker-compose.yml because it looks "more secure."

**Why it's wrong:** Docker Swarm secrets require swarm mode, which Synology Container Manager does not support. The compose file will fail to deploy.

**Do this instead:** `env_file: .env` with a `.gitignore`d `.env` file. This is the correct pattern for single-host Docker Compose deployments.

---

## Integration Points

### External Services

| Service | Protocol | Auth Method | Key Gotchas |
|---------|----------|-------------|-------------|
| Radarr / Sonarr / Lidarr / Bazarr | HTTP REST | `X-Api-Key` header | All share the same API structure; one adapter template covers all four |
| SABnzbd | HTTP REST | `apikey` query param | Returns download queue as JSON; 10s poll adequate for progress |
| Pi-hole | HTTP REST (v5) / FTL API (v6) | API token or password | v5 and v6 have completely different API shapes; detect version on startup |
| Plex Media Server | HTTP REST | `X-Plex-Token` header | `/status/sessions` for active streams; token obtained from Plex account or config file |
| Synology DSM | HTTP REST (SYNO.API.*) | Session token (user/pass login) | Session must be established first; token refreshed; use a read-only DSM user |
| Ubiquiti UniFi | HTTP REST | Cookie session or API key (UniFi OS 3.x+) | UniFi OS 3.x introduces proper API keys; older controllers use cookie auth |
| Pushover | HTTP REST | app token + user key | POST to `api.pushover.net/1/messages.json`; rate limit: 1 per service per N minutes |
| Ring | HTTP/OAuth | OAuth 2.0 tokens | Ring's unofficial API requires 2FA on first auth; tokens need refresh; HIGH complexity |
| Google Nest | REST (Google SDM API) | OAuth 2.0 via Google Cloud | Requires Google Cloud project + Device Access enrollment; HIGH complexity |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Polling Engine ↔ Service Adapters | Direct async function call | Adapter is instantiated with credentials at startup; engine calls `poll()` |
| Polling Engine ↔ DB Layer | Direct import of query functions | Synchronous better-sqlite3 calls are fine in polling callbacks |
| Polling Engine ↔ SSE Layer | EventEmitter (internal bus) | Decouples producers from consumers |
| Polling Engine ↔ Notification Layer | EventEmitter (internal bus) | Same bus; notification layer subscribes independently |
| API Layer ↔ DB Layer | Direct import of query functions | REST handlers read/write config and logs |
| API Layer ↔ Polling Engine | Direct method call for manual refresh | `engine.triggerPoll(serviceId)` |
| React Client ↔ API Layer | SSE for live data; REST/tRPC for config writes | Two separate connection types from browser |

---

## Suggested Build Order (Phase Dependency Map)

The architecture has clear dependency layers. Build order must respect them:

```
Phase 1: Foundation
  Docker Compose skeleton + SQLite schema + migrations + health endpoint
  (Nothing works without this; all other phases depend on it)

Phase 2: Polling Engine + First Adapter
  Polling engine with p-queue + Radarr adapter (simplest, well-documented API)
  Prove the poll → DB → SSE → browser loop end-to-end with one service
  (Validates the architecture before building 10+ adapters)

Phase 3: SSE + Minimal Dashboard Shell
  SSE endpoint + React app with one card that shows live Radarr status
  (Closes the full loop: external service → backend → browser)

Phase 4: Remaining Service Adapters
  All remaining adapters can be built in parallel once Phase 2 is proven
  Order: Sonarr/Lidarr/Bazarr (clones of Radarr) → SABnzbd → Pi-hole → Plex → NAS → Ubiquiti

Phase 5: Notifications + Thresholds
  Pushover dispatcher + threshold evaluation + configuration UI
  (Depends on poll results being available in DB from Phase 4)

Phase 6: Rich Dashboard UI
  Full Tron aesthetic, animated cards, detail views, Now Playing banner
  (Can be built in parallel with Phase 5 once Phase 3 shell exists)

Phase 7: Smart Home (Research-Gated)
  Ring and Nest integration
  (Complexity and OAuth requirements warrant a separate phase after core is stable)

Phase 8: Logging + Settings UI
  Centralized log viewer, config management UI, purge/export
  (Quality-of-life; doesn't block core monitoring)
```

**Critical path:** Phase 1 → Phase 2 → Phase 3. Everything else parallelizable after Phase 3.

---

## Scaling Considerations

This is a single-user home dashboard. Scaling to multiple users is out of scope. The relevant "scaling" concern is reliability under NAS resource constraints.

| Concern | At 1 user (home NAS) | Notes |
|---------|----------------------|-------|
| CPU | Negligible — ~15 polls/30s, each is a single HTTP call | NAS ARM CPUs are fine |
| Memory | ~50-100MB Node.js process | Well within NAS limits |
| SQLite writes | ~30 writes/minute — trivial | SQLite handles 10,000+/s |
| SQLite file size (no pruning) | ~2GB/year | Implement nightly pruning |
| SSE connections | 1-3 browser tabs typical | In-memory map; no concern |
| Network | All traffic is LAN | Negligible |

**First bottleneck (if any):** NAS I/O during heavy Synology workloads (e.g., RAID rebuild). Mitigation: set Docker CPU/memory limits in compose file to prevent Coruscant from competing with NAS operations.

---

## Sources

- Uptime Kuma source code structure (github.com/louislam/uptime-kuma) — Node.js + Socket.IO + SQLite pattern (MEDIUM confidence; web access unavailable during this session, based on well-documented open-source project)
- Homarr v0.15+ architecture — Next.js + Drizzle + SQLite pattern (MEDIUM confidence)
- Dashdot SSE streaming pattern (github.com/MauriceNino/dashdot) — NestJS + SSE for live hardware metrics (MEDIUM confidence)
- Scrutiny architecture — Go + SQLite/InfluxDB (MEDIUM confidence)
- Synology Container Manager Docker Compose compatibility — DSM 7.2+ supports Compose v3.x without Swarm mode (HIGH confidence; well-documented Synology limitation)
- `better-sqlite3` synchronous API performance characteristics (HIGH confidence; stable well-known library)
- Docker SSE + Nginx proxy buffering requirements (HIGH confidence; standard Nginx behavior)
- Ring API / Google Nest SDM API OAuth complexity (HIGH confidence; well-documented developer friction)

---

*Architecture research for: Self-hosted home infrastructure monitoring dashboard (Coruscant)*
*Researched: 2026-04-02*
