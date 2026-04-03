<!-- GSD:project-start source:PROJECT.md -->
## Project

**Coruscant**

Coruscant is a self-hosted home infrastructure monitoring hub running on a Synology NAS via Docker. It aggregates health and activity data from all home services — media apps, NAS hardware, network equipment, and smart home devices — into a single mobile-first web dashboard. Instead of navigating five different apps, everything is visible at a glance with real-time status, alerts, and drill-down detail views.

**Core Value:** A single glance from a phone tells you whether your home infrastructure is healthy or needs attention.

### Constraints

- **Platform**: Must run in Docker Compose on Synology NAS Container Manager — no exotic runtime dependencies
- **Network**: App must work on LAN; Tailscale provides WAN access transparently
- **Registry**: Images pulled from user's own self-hosted Docker registry
- **Privacy**: All data stays local — no cloud telemetry, no external API calls except to services the user controls
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Research Method Notes
- Training knowledge of self-hosted dashboard codebases (Uptime Kuma, Homarr, Dashdot, Scrutiny, Whoogle, Heimdall) through August 2025
- Known characteristics of the Node.js/TypeScript/React/SQLite ecosystem
- ARM64/Docker multi-arch publishing practices for Synology NAS targets
## What the Self-Hosted Dashboard Ecosystem Uses
| Project | Backend | Frontend | Database | Real-time | Notes |
|---------|---------|----------|----------|-----------|-------|
| **Uptime Kuma** | Node.js + Express | Vue 3 | SQLite (better-sqlite3) | Socket.IO | Most widely deployed; ARM64 native |
| **Homarr** | Next.js (full-stack) | React + Mantine | SQLite (Drizzle ORM) | REST polling | v1 migrated to Next.js App Router |
| **Dashdot** | NestJS | React + Recharts | None (live syscall) | SSE | Tightly coupled single-image |
| **Scrutiny** | Go (gin) | Angular | InfluxDB | REST polling | SMART monitoring focus |
| **Heimdall** | Laravel (PHP) | Blade/jQuery | SQLite | None | Older; no real-time |
| **Grafana** | Go | React | TimescaleDB/InfluxDB | WebSocket | Overkill for home use; resource heavy |
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Node.js** | 22 LTS (22.x) | Backend runtime | LTS through April 2027; official ARM64 Docker images; dominates self-hosted dashboard space; excellent for I/O-bound polling workloads | [MEDIUM confidence on version — verify at nodejs.org/en/download] |
| **TypeScript** | 5.4+ | Language for both backend and frontend | Type safety eliminates entire classes of runtime errors; universal in modern Node.js projects; both Fastify and React have first-class TS support |
| **Fastify** | 4.x | HTTP API server | 2–3x faster than Express on benchmarks; built-in schema validation (JSON Schema); TypeScript-first; WebSocket plugin available; lighter than NestJS for a focused monitoring app | [MEDIUM confidence on version] |
| **React** | 18.x | Frontend UI framework | Largest ecosystem; best animation library support (Framer Motion, GSAP, React Spring); critical for Tron-aesthetic animated UI; Homarr uses it; Context/hooks model works well for real-time dashboard state |
| **Vite** | 5.x | Frontend build tool | Fastest dev server available; native ESM; replaces Create React App (deprecated); sub-second HMR; standard choice since 2023 | [MEDIUM confidence on version] |
| **SQLite (better-sqlite3)** | 9.x | Local persistent storage | Zero-ops embedded database; single file backup; synchronous API plays well with Node.js event loop; sufficient for config, alerts, logs, thresholds at home scale; Uptime Kuma uses this exact library | [MEDIUM confidence on version] |
| **Socket.IO** | 4.x | Real-time bidirectional communication | Battle-tested for dashboards; automatic fallback from WebSocket to polling; client library available for React; Uptime Kuma uses it at scale; supports rooms for per-service subscriptions | [MEDIUM confidence on version] |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Drizzle ORM** | 0.30+ | Type-safe SQLite queries | Use for all DB access — generates TypeScript types from schema; migrations built-in; Homarr adopted it; lighter than Prisma (no separate process) | [LOW confidence on version — verify at drizzle.team] |
| **Zod** | 3.x | Runtime schema validation | Validate all external API responses (Plex, Pi-hole, etc.) and user config inputs; pairs with Fastify's schema validation to form a complete validation layer |
| **node-cron** | 3.x | Polling scheduler | Schedule periodic polls to Radarr, Sonarr, Pi-hole, NAS APIs; simpler than full job queue for home use |
| **axios** | 1.x | HTTP client for service polling | Timeout and retry config; interceptors for auth headers; works with self-signed certs (Ubiquiti gear) via httpsAgent option |
| **Framer Motion** | 11.x | React animation library | The right tool for Tron UI animations — card border traces, status transitions, pulsing glows; declarative API fits React model; hardware-accelerated via CSS transforms | [MEDIUM confidence on version] |
| **React Three Fiber / Three.js** | r3f 8.x / Three 0.163+ | Canvas/WebGL for grid background | For animated Tron grid with traveling light pulses — canvas-based, GPU-accelerated; avoids heavy CPU usage on NAS ARM hardware vs. pure CSS animation at scale | [LOW confidence on versions — verify] |
| **Recharts** | 2.x | Chart components | SVG-based React charts for Pi-hole DNS stats, NAS CPU/RAM/disk; lightweight vs. Chart.js; React-native API |
| **react-query (TanStack Query)** | 5.x | Server state management | Handles polling intervals, caching, stale-while-revalidate for service data; reduces manual useEffect/fetch patterns | [MEDIUM confidence on version] |
| **Pushover client (pushover-notifications)** | latest | Pushover notification delivery | Small Node.js package for Pushover HTTP API; evaluate if maintained, otherwise implement directly against Pushover REST API (simple POST) |
| **pino** | 9.x | Structured logging | Fast JSON logger; log levels; built-in child loggers per service; log output can be stored in SQLite or streamed to frontend log viewer | [LOW confidence on version] |
| **winston** | 3.x | Alternative structured logger | More widely known alternative to pino; choose one, not both |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **Docker Compose v2** | Container orchestration | Synology Container Manager uses Docker Compose v2 syntax; use `compose.yaml` (preferred) or `docker-compose.yml` |
| **Multi-stage Dockerfile** | Lean production images | Builder stage (Node 22 full) → runner stage (Node 22 slim/alpine); critical for keeping image size under 200MB for NAS storage efficiency |
| **ESLint + Prettier** | Code quality | Standard TS project tooling; configure once, run in CI |
| **Vitest** | Unit testing | Same config as Vite; fast; no separate Jest setup needed |
| **tsx** | TypeScript execution | Run TypeScript directly in development without separate compile step; replaces ts-node for Node 22 |
## Installation
# Backend core
# Frontend core
# WebGL grid (evaluate based on complexity preference)
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Fastify** | Express.js | Express if team is already familiar and performance isn't critical; Express has larger tutorial base but is slower and less type-safe out of the box |
| **Fastify** | NestJS | NestJS if the project grows to 10+ microservices with complex DI; overkill for a focused home monitoring app |
| **Fastify** | Hono | Hono is viable and extremely lightweight; choose if you want edge/Bun compatibility in future; smaller ecosystem than Fastify |
| **React** | Vue 3 | Vue 3 if team prefers Options/Composition API; Uptime Kuma uses Vue 3 successfully; animation ecosystem (Framer Motion) is React-only, so Vue requires GSAP instead |
| **React** | SvelteKit | SvelteKit produces smaller bundles and is excellent for dashboards; lacks Framer Motion; animation requires manual CSS or GSAP; viable if Tron animations stay CSS-only |
| **Socket.IO** | Native WebSocket (ws library) | Use `ws` directly if you want zero overhead and will handle reconnection logic manually; Socket.IO adds ~40KB client bundle but eliminates reconnection complexity |
| **Socket.IO** | Server-Sent Events (SSE) | SSE is simpler for server-push-only (status updates from server to client); choose SSE if the dashboard never needs to send commands back to the server |
| **SQLite (better-sqlite3)** | PostgreSQL | PostgreSQL if you already have a Postgres instance on the NAS and want shared DB; adds operational complexity for a single-app dashboard |
| **SQLite (better-sqlite3)** | InfluxDB / TimescaleDB | Time-series DBs if you want months of historical metrics with efficient range queries; overkill for home use where 7–30 days retention is sufficient and SQLite can hold it |
| **Drizzle ORM** | Prisma | Prisma is more popular and has better docs; Drizzle is lighter (no Prisma engine process); for a NAS deployment with limited RAM, Drizzle's zero-process model is preferable |
| **Three.js / R3F** | Pure CSS animations | CSS-only is viable if the grid is simple (CSS Grid + keyframes); Three.js for complex traveling-light effects that need per-pixel control; start with CSS, upgrade to Three.js if needed |
| **Recharts** | Chart.js | Chart.js has Canvas rendering (slightly better at high data density); Recharts is React-native and easier to customize with Tron color palette |
| **Vite** | Next.js | Next.js if you want SSR/SSG; unnecessary for a dashboard behind Tailscale where SEO doesn't matter; Vite SPA is simpler and faster to deploy in Docker |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Create React App (CRA)** | Officially deprecated since 2023; unmaintained; slow builds | Vite + React |
| **Webpack (custom config)** | Config complexity; slower than Vite; no reason to choose it for a new project | Vite |
| **Electron** | Desktop app runtime; incompatible with Docker/NAS headless deployment model | Web app in Docker |
| **InfluxDB + Grafana** | Operationally heavy; requires separate InfluxDB container + Grafana container; 500MB+ combined RAM; overkill for home | SQLite + custom charts |
| **MySQL / MariaDB** | Requires separate container; no benefit over SQLite at home-monitoring scale | SQLite (better-sqlite3) |
| **Prisma (on NAS)** | Prisma Engine is a separate binary that adds 50–100MB and a separate process; on ARM64 NAS with limited RAM this is wasteful | Drizzle ORM |
| **Redux / Zustand (for server state)** | Overkill when TanStack Query manages all server-fetched data; global client state in this app is minimal | TanStack Query + React Context for UI state |
| **GSAP (free tier)** | GSAP's advanced plugins are paid; Framer Motion covers the animation needs with no licensing concern | Framer Motion |
| **PM2 inside Docker** | Anti-pattern; Docker restart policies replace process manager; adding PM2 inside a container adds complexity with no benefit | Docker restart: unless-stopped |
| **Alpine Linux base for Node.js** | Alpine uses musl libc; better-sqlite3 and some native Node modules have known issues with musl; use `node:22-slim` (Debian slim) instead | `node:22-slim` Docker base |
## Stack Patterns by Variant
- Use CSS custom properties + `@keyframes` for grid lines and traveling pulses
- Use Framer Motion for card entrance animations, status transitions, and border-trace effects
- Avoids Three.js complexity; faster to implement; works on any browser
- Recommended starting point — upgrade to WebGL only if CSS proves insufficient
- Use `@react-three/fiber` with a fullscreen Canvas behind the dashboard UI
- Shader-based grid with traveling light pulses (uniforms driven by requestAnimationFrame)
- Portal the dashboard cards over the canvas using `position: absolute` layering
- Higher GPU usage — test on mobile Safari (iOS) which has WebGL limits
- Replace Socket.IO with TanStack Query's `refetchInterval` (5–30 second polling)
- Eliminates WebSocket connection maintenance; simpler architecture
- Acceptable for status-only and activity monitors; not ideal for live Plex stream updates
- Keep the monitoring card slots as placeholders with "Coming Soon" states
- Architecture (polling scheduler, card component model) is the same regardless
## ARM64 / Synology NAS Compatibility
| Technology | ARM64 Status | Notes |
|------------|--------------|-------|
| Node.js 22 LTS | Native ARM64 support | Official Docker image `node:22-slim` publishes linux/arm64; no emulation needed |
| better-sqlite3 | ARM64 native via prebuilt binaries | Ships prebuilt binaries for linux/arm64; Docker multi-arch builds work; avoid Alpine (musl issues) |
| Socket.IO | Pure JS | No native binaries; runs on any Node.js target |
| React / Vite | Pure JS | No native binaries; runs anywhere |
| Three.js | Pure JS | No native binaries; GPU-accelerated in browser (not on NAS) |
| Drizzle ORM | Pure JS | No native binaries |
| Framer Motion | Pure JS | No native binaries |
## Docker Compose Structure
# compose.yaml — Coruscant deployment pattern
## Version Compatibility
| Package | Compatible With | Notes |
|---------|----------------|-------|
| `react@18` | `react-dom@18` | Must match exactly |
| `socket.io@4` | `socket.io-client@4` | Server and client must be same major version |
| `drizzle-orm@0.30+` | `drizzle-kit@0.20+` | Keep these in sync; drizzle-kit is the migration CLI |
| `@react-three/fiber@8` | `three@0.163+` | R3F 8.x requires Three r155+; pin both |
| `better-sqlite3@9` | `Node.js 18+` | v9 dropped Node 16; v9 works on Node 22 |
| `@tanstack/react-query@5` | React 18+ | v5 dropped React 17; breaking change from v4 |
## Sources
- Training knowledge of Uptime Kuma (v1.23+), Homarr (v0.15.x), Dashdot, Scrutiny codebase patterns — MEDIUM confidence (ecosystem-level patterns well-established; specific versions may have advanced since August 2025 cutoff)
- Node.js LTS schedule (known: v22 is Active LTS through October 2026) — HIGH confidence
- better-sqlite3 ARM64/musl compatibility issues — MEDIUM confidence (well-documented community issue; verify current status)
- Fastify performance vs Express benchmarks (fastify.io/benchmarks) — HIGH confidence (architecture-level claim, stable)
- Framer Motion + React animation ecosystem — HIGH confidence (dominant pattern since 2022)
- Alpine Linux + native Node modules musl issue — MEDIUM confidence (verify if better-sqlite3 prebuilt binaries now cover musl)
- Three.js R3F integration patterns — MEDIUM confidence (ecosystem stable; versions advance rapidly, verify before pinning)
- https://nodejs.org/en/download — current LTS
- https://www.npmjs.com/ — current package versions
- https://fastify.dev — current Fastify version
- https://orm.drizzle.team — current Drizzle version
- https://www.framer.com/motion — current Framer Motion version
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
