# Project Research Summary

**Project:** Coruscant
**Domain:** Self-hosted home infrastructure monitoring dashboard (Docker on Synology NAS)
**Researched:** 2026-04-02
**Confidence:** MEDIUM

## Executive Summary

Coruscant is a single-user home monitoring dashboard that aggregates health and activity data from 10+ home services into one mobile-first web interface, deployable as a Docker Compose project on Synology NAS. The self-hosted dashboard ecosystem — led by Uptime Kuma, Homarr, and Dashdot — has converged on a clear production pattern: Node.js backend + React frontend + SQLite storage + server-side polling with WebSocket or SSE push to the browser. This stack is ARM64-native, runs in ~50–100MB RAM on NAS hardware, and avoids the operational overhead of Postgres, InfluxDB, or Grafana. Coruscant should follow this established pattern exactly, with Fastify (faster and more type-safe than Express), Drizzle ORM (no separate engine process unlike Prisma), and SSE (simpler than WebSocket for a read-only dashboard).

The recommended architecture is an Adapter pattern for service integrations (one file per service, all implementing `poll(): Promise<PollResult>`), a central PollingEngine with per-service concurrency managed by `p-queue`, and an internal EventEmitter bus that decouples polling from SSE delivery and Pushover notification dispatch. Credentials live in environment variables from a `.env` file — never in the database, never in Docker Swarm secrets (which Synology Container Manager does not support). This architecture makes adding new services trivial and keeps each integration independently testable.

The critical risks for this project are: (1) the two hard integrations — Google Nest requires a $5 Google Cloud OAuth enrollment with Pub/Sub event delivery, and Amazon Ring has no official API and relies on a fragile reverse-engineered npm library — both should be deferred to v1.x after core is validated; (2) CSS animations for the Tron aesthetic must be architected correctly from the start using only `transform` and `opacity` properties, or mobile performance will be unrecoverable without a full rewrite; and (3) Synology-specific gotchas (UID/GID volume permissions, no Docker Swarm secrets, SSE proxy buffering) must be addressed in the infrastructure foundation phase, not discovered in production.

---

## Key Findings

### Recommended Stack

The Node.js + TypeScript + Fastify + React + Vite + SQLite stack is the right call for this project. It mirrors what Uptime Kuma and Homarr have proven in production, is entirely ARM64-native (no musl issues if using `node:22-slim` Debian base, not Alpine), and keeps the container image under 200MB with a multi-stage Dockerfile. Socket.IO is available but SSE is the better choice for a read-only dashboard — it is unidirectional, works natively in the browser without a client library, and proxies cleanly through Synology's Nginx reverse proxy (with `proxy_buffering off` configured). TanStack Query manages client-side server-state caching; Framer Motion drives card and UI animations; the Tron grid background should start as CSS and only escalate to Three.js / React Three Fiber if the CSS approach proves insufficient.

**Core technologies:**
- **Node.js 22 LTS + TypeScript 5.4+**: Runtime and language — ARM64 native, LTS through April 2027, type safety eliminates entire classes of integration bugs
- **Fastify 4.x**: HTTP/SSE server — 2-3x faster than Express, built-in schema validation, TypeScript-first
- **React 18 + Vite 5**: Frontend — largest animation ecosystem (Framer Motion), fastest dev server, correct for a SPA behind Tailscale where SSR has no value
- **SQLite via better-sqlite3 9.x + Drizzle ORM**: Persistence — zero-ops embedded database, single file backup, no separate container, synchronous API works well with Node.js event loop
- **Framer Motion 11.x**: UI animations — the right tool for Tron card border traces, status transitions, and pulsing glows without GSAP licensing concerns
- **node-cron + p-queue**: Polling scheduler + concurrency control — prevents slow services from blocking the entire poll cycle
- **`node:22-slim` Docker base (Debian)**: NOT Alpine — better-sqlite3 native module has known musl libc incompatibility issues on Alpine

**Key version constraints to validate before pinning:**
- `socket.io-client` and `socket.io` must match major version (both 4.x if used)
- `@react-three/fiber@8` requires `three@r155+`
- `@tanstack/react-query@5` requires React 18+ (breaking from v4)

### Expected Features

The features research revealed a clear three-tier structure that maps directly to the dashboard's service cards: simple status-only services (*arr suite), activity services (SABnzbd), and rich-data services (Pi-hole, Plex, NAS, Ubiquiti). API feasibility is uniformly EASY to MEDIUM for the core set — all Servarr apps use identical API patterns, SABnzbd's flat query-param API returns everything in one call, Plex tokens are static, and Pi-hole's v5 summary is a single endpoint. The two problematic integrations (Nest OAuth, Ring unofficial library) are correctly flagged as optional.

**Must have (table stakes):**
- Service up/down status for all monitored services — core premise of the product
- Visual healthy/warning/critical state distinction (Tron Blue / Amber / Red color system)
- Auto-refresh via server-side polling with SSE push — stale dashboards are useless
- Mobile-first responsive layout — primary usage is phone-based daily glance
- Plex active streams + Now Playing banner — highest-frequency user interaction
- NAS CPU, RAM, and per-volume storage indicators — daily concern
- SABnzbd download queue with progress bars — active download tracking
- Pi-hole DNS stats (queries today, block %) — expected from any Pi-hole integration
- Settings page for credentials and service endpoints — prerequisite for all integrations
- Tron/Grid living UI aesthetic — this IS the product's identity, not a polish item

**Should have (after v1 validation):**
- NAS disk temperatures and fan speeds
- Plex transcode status indicator
- UniFi network card (client counts, throughput, device status)
- Pushover threshold alerts with per-service threshold configuration
- In-app log viewer with purge/export

**Defer to v2+:**
- Sparkline trend charts (requires persistent time-series data architecture decisions)
- Dashboard layout customization (premature until card set is stable)
- Mobile PWA / home screen install
- Additional notification channels beyond Pushover

**Hard anti-features to avoid:**
- Service control (pause downloads, restart services) — read-only monitoring only
- Media library browsing — out of Coruscant's scope
- User authentication beyond Tailscale network-level auth — adds complexity for single-user
- Client-side polling from the browser — every tab polls independently; use server-side polling + SSE push

### Architecture Approach

The architecture is a single-container Node.js process combining Fastify HTTP server, SSE endpoint, PollingEngine, and SQLite data layer. All service integrations are isolated as Adapter modules implementing a common `poll(): Promise<PollResult>` interface. The PollingEngine manages per-service schedulers, calls adapters with timeout guards (10s default), writes results to SQLite, evaluates alert thresholds, and emits events on an internal EventEmitter bus that SSE and Pushover notification layers subscribe to independently. Browsers connect once via `EventSource` and receive an immediate full-state snapshot followed by delta events as polls complete.

**Major components:**
1. **Service Adapters** (`packages/server/src/adapters/`) — One file per integration; encapsulates all HTTP/auth logic for that service; implements `ServiceAdapter` interface
2. **PollingEngine** (`packages/server/src/polling/`) — Central scheduler with p-queue concurrency control; per-service timeouts, jitter on startup, circuit-breaker backoff on consecutive failures
3. **SSE Layer** (`packages/server/src/api/sse.ts`) — EventSource endpoint; maintains connected client map; sends snapshot on connect + delta events on poll completion
4. **Data Layer** (`packages/server/src/db/`) — better-sqlite3 singleton; WAL mode enabled; typed query functions; 5 tables (service_configs, poll_results, threshold_configs, notification_log, app_logs) with rolling retention and nightly pruning
5. **Notification Dispatcher** (`packages/server/src/notifications/`) — Stateless Pushover POST; rate-limited to max 1 alert per service per 15 minutes; subscribes to internal event bus
6. **React SPA** (`packages/client/`) — Dashboard cards (3 tiers), detail views, settings, log viewer; `useSSE` hook consumes EventSource stream; Framer Motion drives all Tron UI animations

### Critical Pitfalls

1. **Synology UID/GID volume permission mismatch** — Set host-side `chown -R 1000:1000 /volume1/docker/coruscant/data` before first container start, or accept root-owned data files; document in SETUP.md; test with a write-then-read verification before proceeding to any other work
2. **SQLite file lives inside the container layer** — Add `volumes:` bind mount for the data directory in `docker-compose.yml` on day one; test persistence with `docker compose down && docker compose up` as a mandatory acceptance criterion
3. **Credentials committed to git** — Add `.env` and `*.env` to `.gitignore` before writing any credentials; provide `.env.example`; never write credentials through the Settings UI to the database
4. **CSS animations tanking mobile performance** — Restrict animations to `transform` and `opacity` only from the start; implement the animated grid as `<canvas>` with `requestAnimationFrame`; test on a physical iPhone, not just Chrome's device emulator; wrong animation architecture cannot be fixed cheaply
5. **WebSocket/SSE silent disconnection after NAS hibernate** — Implement browser-side exponential backoff reconnect and server-side SSE ping every 30s; add a "Reconnecting..." UI state; test the full hibernate/wake cycle explicitly
6. **Synology DSM session expiry causes silent stale data** — Build auth-refresh (retry on 403/error_code 105) into the DSM adapter from the start; surface data age on the NAS card with amber state when data is older than 2x the poll interval

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Infrastructure Foundation
**Rationale:** Every other phase depends on this. Synology-specific Docker gotchas (UID/GID, volume mounts, no Swarm secrets) must be resolved before any application code is written. Data persistence proven before service integrations are built.
**Delivers:** Working Docker Compose deployment on NAS; SQLite schema with migrations; health endpoint; `.env` / secrets pattern established; data persistence verified
**Addresses:** Settings architecture (credential storage pattern), deployment model
**Avoids:** SQLite-in-container-layer data loss, UID/GID permission failures, credentials-in-git, Docker Swarm secrets on Synology

### Phase 2: Polling Engine + First Adapter
**Rationale:** ARCHITECTURE.md explicitly identifies this as the critical-path phase. Prove the full data flow (external API → poll → SQLite → SSE → browser) end-to-end with one service before building 10+ adapters. Radarr is the right first adapter: simplest auth (one header), well-documented API, stable.
**Delivers:** Working PollingEngine with p-queue, configurable intervals, per-service timeout guards, startup jitter, circuit-breaker backoff; Radarr adapter; SSE endpoint serving live data; minimal React shell with one live status card
**Uses:** Fastify, better-sqlite3, node-cron, p-queue, Drizzle ORM, TanStack Query, EventSource hook
**Implements:** ServiceAdapter interface, EventEmitter bus, Snapshot + Delta SSE pattern
**Avoids:** Aggressive polling without circuit breaker, single polling loop for all services, client-side polling anti-pattern

### Phase 3: Core Service Adapters
**Rationale:** With the architecture proven in Phase 2, all remaining P1 service adapters follow the same interface. Servarr suite (Sonarr/Lidarr/Bazarr) are near-clones of Radarr. SABnzbd, Pi-hole, and Plex are EASY feasibility. NAS DSM is MEDIUM complexity but highest user value.
**Delivers:** All P1 monitoring integrations live: Sonarr, Lidarr, Bazarr (clones of Radarr), SABnzbd (download queue), Pi-hole (DNS stats), Plex (active streams, Now Playing banner), Synology NAS (CPU/RAM/storage)
**Implements:** DSM auth-refresh pattern (critical — build from the start), Pi-hole version detection (v5 vs v6), Plex token handling
**Avoids:** DSM session expiry silent failures, Pi-hole v5/v6 divergence, Plex wrong token type, fetching full Plex library metadata on poll

### Phase 4: Dashboard UI + Tron Aesthetic
**Rationale:** The animated Tron UI is core product identity, not a polish item. PITFALLS.md explicitly warns that animation architecture must be correct from the start. With live data flowing from Phase 3, the UI can be built against real data.
**Delivers:** Full Tron/Grid visual theme; animated grid background (CSS first, canvas if needed); Framer Motion card animations (border traces, status transitions, pulsing glows); Now Playing banner; tiered card components (status / activity / rich); detail drill-down views; mobile-first responsive layout with safe-area-inset support
**Uses:** Framer Motion 11.x, CSS custom properties, `will-change: transform`, physical iPhone performance testing
**Avoids:** CSS box-shadow/filter/background-position animations, layout-triggering keyframes, jank on mobile, error states that look like healthy states, missing stale-data indicators

### Phase 5: Settings + Notifications
**Rationale:** Settings UI lets the user configure service URLs and thresholds without code changes. Pushover notifications are HIGH user value and depend on having stable poll data from Phase 3.
**Delivers:** Settings page (service endpoint config, credential documentation via `.env.example`); threshold configuration UI per service; Pushover notification dispatcher with rate limiting (1 per service per 15 min); notification log table
**Implements:** Config write flow (REST → SQLite → polling engine restart for changed service), threshold evaluation in polling engine
**Avoids:** Credentials written to database, settings saving on keypress instead of explicit save action

### Phase 6: UniFi Network + NAS Extended
**Rationale:** UniFi is MEDIUM feasibility (unofficial API, cookie session management) and adds the highest differentiation value post-launch. NAS disk temps and fan speeds are natural extensions of Phase 3 NAS work. Group together as session-management-heavy integrations.
**Delivers:** UniFi card (device status, client counts, WAN throughput); NAS disk temperatures per disk; fan speed monitoring; Plex transcode detail indicator
**Implements:** Cookie session management pattern (shared with Synology DSM, apply same auth-refresh strategy), UniFi version detection (classic controller vs. UniFi OS 3.x)
**Avoids:** Creating new UniFi auth session on every poll cycle, UniFi endpoint version mismatch

### Phase 7: Logging + Polish
**Rationale:** Log viewer and management are quality-of-life features for an operational system. After core monitoring is validated, centralized logs become the tool for diagnosing integration failures.
**Delivers:** In-app log viewer (last 100 entries by default, filterable by service and level, paginated/virtualized); log purge and export; SQLite index on timestamp; WAL mode verification; nightly pruning job for all rolling-retention tables
**Avoids:** Log viewer loading all rows, unbounded SQLite file growth, missing SQLite WAL mode

### Phase 8: Smart Home (Research-Gated)
**Rationale:** Nest (OAuth/Cloud) and Ring (unofficial library) are the two HARD feasibility integrations. Both are isolated from all other integrations and can fail independently. Deferring to final phase ensures core monitoring value is delivered first, and OAuth setup complexity is handled after the user has context from using the app.
**Delivers:** Google Nest thermostat card (HVAC state, ambient temp) if OAuth enrollment is completed; Amazon Ring event card (last motion/doorbell) via `ring-client-api` with explicit "may break" documentation; "Not configured" placeholder card states with setup instructions
**Avoids:** SDM API deprecation surprises, Ring ToS risk without documentation, blocking core roadmap on external OAuth flows

### Phase Ordering Rationale

- **Phases 1-2 are the critical path.** Everything parallelizable after Phase 2. ARCHITECTURE.md explicitly identifies Phase 1 → Phase 2 → Phase 3 as the critical path.
- **UI (Phase 4) after data (Phase 3)** because the Tron aesthetic requires real data to validate that live updates feel right at the card level. Building the UI against mocked data risks rework.
- **Notifications (Phase 5) after integrations (Phase 3)** because meaningful threshold values can only be set after seeing real data ranges.
- **Smart home last** because their OAuth/unofficial-library complexity would block shipping if included earlier, and their failure modes are entirely isolated from everything else.
- **Settings in Phase 5** — the credential storage pattern is established in Phase 1; the UI for it comes after the integrations are working.

### Research Flags

Phases needing deeper research during planning:
- **Phase 8 (Smart Home):** Google Nest SDM API OAuth flow changes frequently; `ring-client-api` maintenance status must be checked at implementation time. Full `/gsd:research-phase` recommended before starting.
- **Phase 6 (UniFi):** UniFi controller version on the user's hardware determines which auth endpoint to use (`/api/login` vs `/api/auth/login`). Research-phase or manual verification recommended before implementation.

Phases with well-established patterns (skip research-phase):
- **Phase 1 (Infrastructure):** Docker Compose on Synology is well-documented; patterns are known.
- **Phase 2 (Polling Engine):** Node.js polling + SSE is the Uptime Kuma / Dashdot pattern exactly; no novel ground.
- **Phase 3 (Core Adapters):** All Servarr APIs are stable and identical; SABnzbd, Pi-hole v5, and Plex APIs are well-documented.
- **Phase 4 (Tron UI):** Framer Motion patterns are well-documented; CSS compositing rules are stable MDN knowledge.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Ecosystem-level patterns are HIGH confidence; specific package versions need validation at npmjs.com before pinning (web access unavailable during research) |
| Features | MEDIUM-HIGH | *arr/SABnzbd/Pi-hole v5/Plex API patterns are HIGH confidence and stable; Pi-hole v6 auth needs version check at deployment time; Ring unofficial API is inherently LOW confidence |
| Architecture | MEDIUM-HIGH | Core patterns (Adapter, EventEmitter bus, SSE, SQLite) drawn from well-documented open-source projects (Uptime Kuma, Homarr, Dashdot); Synology Container Manager constraints are HIGH confidence |
| Pitfalls | MEDIUM-HIGH | High-traffic issues (UID/GID, SQLite volumes, WebSocket proxy, CSS compositing) are HIGH confidence from multiple independent sources; niche items (Ubiquiti rate limits, DSM session specifics) need implementation-time validation |

**Overall confidence:** MEDIUM — sufficient to build a roadmap and begin development. Gaps are implementation-level details, not architectural unknowns.

### Gaps to Address

- **Pi-hole version:** Verify whether the deployment is running Pi-hole v5 or v6 before implementing the Pi-hole adapter. The auth mechanism is completely different. If v6, allocate extra time for Bearer token session management.
- **UniFi controller version:** Verify whether the network is running a classic UniFi Network Controller or UniFi OS 3.x (UDM/UDM Pro). The login endpoint differs and the API key model changed in OS 3.x.
- **Plex token acquisition:** The recommended approach (token from server preferences XML) works for local access. Confirm the Plex server is accessible at its local IP from the Docker container's bridge network without routing through plex.tv.
- **Package versions:** All version recommendations in STACK.md carry MEDIUM confidence. Validate current stable versions at npmjs.com before writing `package.json`. Pay particular attention to Drizzle ORM (fast-moving) and React Three Fiber (three.js peer dependency constraint).
- **Ring API current status:** `ring-client-api` npm library maintenance status unknown after August 2025 cutoff. Check npm page and GitHub repo for recent activity before committing to Phase 8 Ring integration.
- **better-sqlite3 + Alpine:** Research noted potential musl libc issues with `node:22-alpine`. If image size is a concern, verify current prebuilt binary status for musl before changing base image from `node:22-slim`.

---

## Sources

### Primary (HIGH confidence)
- Node.js 22 LTS schedule — Active LTS through October 2026, maintenance through April 2027
- Fastify vs Express performance characteristics — architecture-level benchmark, stable
- SQLite WAL mode and Docker volume persistence — SQLite official docs and standard Docker patterns
- Docker Compose `secrets:` Swarm requirement — official Docker documentation
- CSS compositing layer rules (`transform`/`opacity` only) — MDN Web Docs, Chrome DevTools documentation
- Servarr unified API design (Radarr/Sonarr/Lidarr) — stable API, well-documented
- SABnzbd `?mode=` flat API — long-stable, unchanged across many versions
- Plex Media Server REST API — well-documented, stable for years
- Synology DSM Web API Guide — official Synology documentation
- Google Nest SDM API deprecation of Works with Nest (2019) — confirmed
- Amazon Ring unofficial API fragility — widely documented in `ring-client-api` community

### Secondary (MEDIUM confidence)
- Uptime Kuma architecture (Node.js + Socket.IO + SQLite) — based on open-source project analysis, training knowledge through August 2025
- Homarr architecture (Next.js + Drizzle + SQLite) — training knowledge through August 2025
- Dashdot SSE streaming pattern (NestJS + SSE) — training knowledge through August 2025
- Synology DSM UID/GID Docker patterns — widely documented in homelab communities
- Pi-hole v6 REST API rewrite — in active development as of August 2025; verify current state
- UniFi community API documentation (Art-of-Wifi) — unofficial, functionally accurate but subject to controller version changes
- better-sqlite3 ARM64/musl compatibility issues — community-documented; verify current prebuilt binary status

### Tertiary (LOW confidence)
- Drizzle ORM version (0.30+) — fast-moving package; verify at drizzle.team before pinning
- React Three Fiber / three.js version constraints — version pair constraint known; verify exact current versions at npmjs.com
- `ring-client-api` current maintenance status — unknown after August 2025 cutoff; verify before Phase 8

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
