---
phase: 01-infrastructure-foundation
plan: 02
subsystem: infra
tags: [docker, dockerfile, compose, github-actions, ci-cd, multi-arch, arm64, sqlite]

# Dependency graph
requires:
  - phase: 01-01
    provides: Fastify backend with /health endpoint, SQLite DB, React Vite frontend, npm workspaces monorepo

provides:
  - Multi-stage Dockerfile (node:22 builder → node:22-slim runner)
  - compose.yaml with bind-mounted SQLite volume and UID/GID support
  - .env.example documenting all infrastructure variables
  - GitHub Actions CI/CD workflow building linux/amd64 + linux/arm64 images to Docker Hub
  - Verified SQLite persistence across container stop/start cycles (D-20)
  - Deployed and verified on Synology NAS at port 1688

affects: [Phase 2, all future phases — provides the deployment container every phase ships inside]

# Tech tracking
tech-stack:
  added: [Docker multi-stage build, Docker Compose v2, GitHub Actions, QEMU/Buildx for multi-arch, Docker Hub registry]
  patterns:
    - node:22-slim (Debian) runner — NOT Alpine, avoids musl/better-sqlite3 incompatibility
    - Bind mount at /app/data for SQLite persistence; host path configurable via DATA_PATH env var
    - PUID/PGID user: directive in compose.yaml for Synology NAS volume permission compatibility
    - HEALTHCHECK uses /health endpoint via node fetch — no curl required in slim image
    - GitHub Actions GHA layer cache (cache-from/cache-to type=gha) for fast re-builds
    - IMAGE_TAG env var in compose.yaml allows pinning to SHA tag from CI output

key-files:
  created:
    - Dockerfile
    - compose.yaml
    - .env.example
    - .github/workflows/docker-publish.yml
  modified: []

key-decisions:
  - "node:22-slim (Debian) for runner stage — Alpine rejected due to musl libc breaking better-sqlite3 prebuilt binaries"
  - "Single compose.yaml with all configuration via .env variable substitution — no environment-specific compose overrides needed at home scale"
  - "PUID/PGID in compose.yaml user directive — required for Synology NAS bind-mount write permissions"
  - "GitHub Actions CI builds both linux/amd64 and linux/arm64 — NAS is ARM64 but developer workstation is amd64"
  - "HEALTHCHECK node fetch against /health — no additional tooling needed in slim image"
  - "IMAGE_TAG defaults to latest in compose.yaml — allows pin to SHA tag for rollbacks"

patterns-established:
  - "Deployment pattern: docker compose up with .env file on NAS; no SSH scripting required"
  - "CI/CD: push to main triggers build + push to Docker Hub as both :latest and :sha-XXXXXX tags"
  - "Data persistence: bind mount /app/data → host DATA_PATH; SQLite file survives compose down/up"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04]

# Metrics
duration: ~90min (including NAS deployment and GitHub Actions verification)
completed: 2026-04-03
---

# Phase 01 Plan 02: Docker Containerisation and CI/CD Summary

**Multi-stage Dockerfile (node:22-slim runner), compose.yaml with bind-mounted SQLite, and GitHub Actions multi-arch CI/CD pipeline publishing to Docker Hub — verified end-to-end on local Docker and Synology NAS**

## Performance

- **Duration:** ~90 min (including NAS deployment and CI pipeline verification)
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 4 created

## Accomplishments

- Multi-stage Dockerfile produces a working image: node:22 builder compiles TypeScript and Vite bundle; node:22-slim runner serves the app — image size kept lean with production-only npm install
- SQLite data persistence verified (D-20): database file survives container stop/start with bind mount; second container start returns `/health` ok against existing DB
- GitHub Actions workflow builds linux/amd64 and linux/arm64 images on every push to main, caches layers via GHA, and pushes both `:latest` and `:sha-XXXXXX` tags to Docker Hub
- Successfully deployed to Synology NAS at port 1688 — `/health` returns `{"status":"ok","db":"connected"}` from NAS
- INFRA-04 (Tailscale WAN access) satisfied architecturally with zero app-level code: app binds to 0.0.0.0, Tailscale routes at the network layer

## Task Commits

1. **Task 1: Create Dockerfile, compose.yaml, .env.example, GitHub Actions workflow** - `be81c84` (feat)
2. **Task 2: Human verification checkpoint** - approved by user (no code commit — verification-only task)

Additional commits during NAS deployment iteration:
- `01645a5` chore: update default port to 1688 and NAS deployment defaults
- `b754f96` ci: trigger workflow test

## Files Created/Modified

- `Dockerfile` — Multi-stage build: node:22 AS builder compiles TS+Vite; node:22-slim AS runner with production deps only, HEALTHCHECK via /health
- `compose.yaml` — Single-service compose with bind-mount volume, PUID/PGID user directive, all config via .env substitution
- `.env.example` — Documents PORT, DATA_PATH, PUID, PGID, DOCKER_HUB_REPO, IMAGE_TAG, ENCRYPTION_KEY_SEED with NAS-specific defaults
- `.github/workflows/docker-publish.yml` — Builds linux/amd64+linux/arm64 on push to main, tags :latest and :sha-XXXXXX, uses GHA layer cache

## Decisions Made

- **node:22-slim (Debian) runner — NOT Alpine**: Alpine uses musl libc which breaks better-sqlite3 prebuilt binaries. Debian slim avoids this entirely.
- **PUID/PGID in compose.yaml**: Synology NAS creates volumes owned by the NAS admin user (uid ~1026); container must run as matching UID/GID to write to bind mount.
- **Default port 1688**: Avoids collision with common services on the NAS; set as default in .env.example.
- **Single compose.yaml**: No override files needed at home scale. All environment differences handled via .env variable substitution.
- **HEALTHCHECK uses node fetch**: Slim image has no curl; node 22 has global fetch built-in — no extra tooling needed.

## Deviations from Plan

None - plan executed exactly as written.

The only post-commit changes were operational: port updated to 1688 (from 3000) after identifying a collision on the NAS, and a CI trigger commit to verify the GitHub Actions workflow end-to-end. These were expected operational adjustments, not plan deviations.

## Issues Encountered

- Port 3000 conflicted with an existing service on the Synology NAS — updated compose.yaml default to 1688. Resolved by updating .env.example default value.
- GitHub Actions required a trigger commit to verify the workflow ran correctly after adding DOCKERHUB_TOKEN and DOCKERHUB_USERNAME secrets/variables to the repo.

## User Setup Required

External services were configured for this plan:

**Docker Hub:**
- `DOCKERHUB_TOKEN` added as GitHub Actions repository secret
- `DOCKERHUB_USERNAME` added as GitHub Actions repository variable
- Image visible at `docker.io/sambo7262/coruscant` with both `:latest` and SHA tags

**Synology NAS:**
- Data directory created at `/volume1/docker/coruscant`
- PUID/PGID values confirmed from `id` command and set in `.env`
- Container running at `NAS_IP:1688`

## Next Phase Readiness

- Phase 2 (Core UI Shell) can start immediately — the deployment container is proven and CI/CD is live
- Every commit to main now produces a fresh multi-arch image on Docker Hub; NAS operator only needs `docker compose pull && docker compose up -d` to update
- INFRA-01 through INFRA-04 all satisfied; Phase 1 infrastructure foundation is complete

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-04-03*
