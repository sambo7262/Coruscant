# Phase 1: Infrastructure Foundation — Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the full project structure, prove Docker Compose deploys to Synology NAS with persistent SQLite data, and establish a GitHub Actions CI/CD pipeline that publishes images to Docker Hub. Phase ends when the app is accessible at a LAN IP/port, data survives container restarts, and a push to main automatically produces a pullable image.

No service integrations, no real UI, no credentials — just the foundation every subsequent phase builds on.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- **D-01:** npm workspaces monorepo with three packages: `packages/backend`, `packages/frontend`, `packages/shared`
- **D-02:** `packages/shared` holds TypeScript types shared between backend and frontend (SSE event shapes, service status types, etc.) — starts empty, populated as types emerge in later phases
- **D-03:** Single root `package.json` declares workspaces; each package has its own `package.json`

### Bootstrap App Scope
- **D-04:** Phase 1 scaffolds all three packages — backend, frontend, and shared — so Phase 2 has real files to build on
- **D-05:** Backend: Fastify server with a `/health` endpoint and a SQLite round-trip test (write + read on startup to prove persistence)
- **D-06:** Frontend: bare React + Vite app serving a single placeholder page (no real UI, just proving the build pipeline works)
- **D-07:** Shared: empty `types.ts` export, ready for Phase 2+

### CI/CD Pipeline
- **D-08:** GitHub Actions triggers on every push to `main` branch
- **D-09:** Builds a multi-arch Docker image (linux/amd64 + linux/arm64 for Synology NAS compatibility)
- **D-10:** Pushes to Docker Hub with two tags: `yourname/coruscant:latest` and `yourname/coruscant:<short-sha>`
- **D-11:** `compose.yaml` references `${DOCKER_HUB_REPO}:${IMAGE_TAG}` — both configurable via `.env`
- **D-12:** Self-hosted registry migration is deferred to a new Production Hardening phase at the end of the milestone (v1.0 release prep)

### Docker Compose & Environment Config
- **D-13:** Single `compose.yaml` at repo root; no compose.override.yaml split
- **D-14:** `.env` file (gitignored) controls infrastructure-only variables: port, data path, Docker Hub repo/tag, and encryption key seed
- **D-15:** `.env.example` (committed) documents all required variables with placeholder values
- **D-16:** Service URLs and API keys are NOT in `.env` — they belong in the Settings UI (Phase 3), persisted encrypted in SQLite
- **D-17:** Encryption key seed for SQLite credential storage lives in `.env` (cannot be stored in the thing it encrypts)

### Data Persistence
- **D-18:** SQLite database bind-mounted from `${DATA_PATH}` on the host to `/app/data` inside the container
- **D-19:** `DATA_PATH` is set in `.env` — defaults in `.env.example` to `/volume1/docker/coruscant` (documented as NAS convention, changeable)
- **D-20:** Phase 1 success requires verifying data survives `docker compose down && docker compose up`

### Docker Image
- **D-21:** Multi-stage Dockerfile: builder stage (`node:22`) compiles TypeScript + builds Vite bundle; runner stage (`node:22-slim`) copies only built artifacts — no devDependencies in production image
- **D-22:** Base image is `node:22-slim` (Debian slim) — NOT Alpine; avoids musl/better-sqlite3 native binary incompatibility
- **D-23:** Fastify serves the compiled React bundle as static files in production (no separate nginx container)

### Claude's Discretion
- Port number for the app (3000 is conventional; Claude may choose)
- Exact GitHub Actions workflow file structure and job naming
- NAS UID/GID volume permission handling (noted in STATE.md as a blocker to verify)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §INFRA-01 through INFRA-04 — the four infrastructure requirements this phase must satisfy

### Project Context
- `.planning/PROJECT.md` §Constraints — Docker Compose on Synology NAS, self-hosted registry, no cloud telemetry
- `.planning/PROJECT.md` §Key Decisions — stack decisions already locked (Node.js 22-slim, SSE, Drizzle ORM)
- `.planning/STATE.md` §Blockers — NAS UID/GID volume permission issue to verify before first container start

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing source code

### Established Patterns
- None yet — this phase establishes the patterns all subsequent phases follow

### Integration Points
- Phase 2 builds the Tron UI directly on top of the `packages/frontend` scaffold created here
- Phase 3 adds the Settings page and first service adapters to `packages/backend`; the SQLite init from Phase 1 becomes the schema migration baseline

</code_context>

<specifics>
## Specific Ideas

- Encryption of service credentials at rest in SQLite is a Phase 3 concern (when Settings UI is built), but the encryption key seed must be wired into `.env` in Phase 1 so it's available before any credentials are stored
- The Settings UI (Phase 3) is the canonical place to enter and test service connections — the `.env` file should never need editing to add a new monitored service

</specifics>

<deferred>
## Deferred Ideas

- **Self-hosted registry CI/CD + v1.0 release hardening** — User wants a production hardening phase at the end of the milestone that: migrates from Docker Hub to the self-hosted registry, cleans up git history, and tags the final release as v1.0. Add this as a new phase after Phase 8 (Smart Home) using `/gsd:add-phase`.

</deferred>

---

*Phase: 01-infrastructure-foundation*
*Context gathered: 2026-04-02*
