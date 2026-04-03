# Phase 1: Infrastructure Foundation — Research

**Researched:** 2026-04-02
**Domain:** npm workspaces monorepo, Docker multi-stage + multi-arch build, GitHub Actions CI/CD, Fastify + SQLite bootstrap, Synology NAS deployment
**Confidence:** HIGH (core patterns verified against current npm registry and official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** npm workspaces monorepo with three packages: `packages/backend`, `packages/frontend`, `packages/shared`
- **D-02:** `packages/shared` holds TypeScript types shared between backend and frontend (SSE event shapes, service status types, etc.) — starts empty, populated as types emerge in later phases
- **D-03:** Single root `package.json` declares workspaces; each package has its own `package.json`
- **D-04:** Phase 1 scaffolds all three packages — backend, frontend, and shared — so Phase 2 has real files to build on
- **D-05:** Backend: Fastify server with a `/health` endpoint and a SQLite round-trip test (write + read on startup to prove persistence)
- **D-06:** Frontend: bare React + Vite app serving a single placeholder page (no real UI, just proving the build pipeline works)
- **D-07:** Shared: empty `types.ts` export, ready for Phase 2+
- **D-08:** GitHub Actions triggers on every push to `main` branch
- **D-09:** Builds a multi-arch Docker image (linux/amd64 + linux/arm64 for Synology NAS compatibility)
- **D-10:** Pushes to Docker Hub with two tags: `yourname/coruscant:latest` and `yourname/coruscant:<short-sha>`
- **D-11:** `compose.yaml` references `${DOCKER_HUB_REPO}:${IMAGE_TAG}` — both configurable via `.env`
- **D-12:** Self-hosted registry migration is deferred to Production Hardening phase (Phase 9)
- **D-13:** Single `compose.yaml` at repo root; no compose.override.yaml split
- **D-14:** `.env` file (gitignored) controls infrastructure-only variables: port, data path, Docker Hub repo/tag, and encryption key seed
- **D-15:** `.env.example` (committed) documents all required variables with placeholder values
- **D-16:** Service URLs and API keys are NOT in `.env` — they belong in the Settings UI (Phase 3), persisted encrypted in SQLite
- **D-17:** Encryption key seed for SQLite credential storage lives in `.env`
- **D-18:** SQLite database bind-mounted from `${DATA_PATH}` on the host to `/app/data` inside the container
- **D-19:** `DATA_PATH` defaults in `.env.example` to `/volume1/docker/coruscant`
- **D-20:** Phase 1 success requires verifying data survives `docker compose down && docker compose up`
- **D-21:** Multi-stage Dockerfile: builder stage (`node:22`) compiles TypeScript + builds Vite bundle; runner stage (`node:22-slim`) copies only built artifacts
- **D-22:** Base image is `node:22-slim` (Debian slim) — NOT Alpine
- **D-23:** Fastify serves the compiled React bundle as static files in production (no separate nginx container)

### Claude's Discretion

- Port number for the app (3000 is conventional; Claude may choose)
- Exact GitHub Actions workflow file structure and job naming
- NAS UID/GID volume permission handling (noted in STATE.md as a blocker to verify)

### Deferred Ideas (OUT OF SCOPE)

- Self-hosted registry CI/CD + v1.0 release hardening (Phase 9)
- Service integrations, credentials, Settings UI (Phase 3+)
- Any real UI or animations (Phase 2+)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | App runs as a Docker Compose project deployable via Synology NAS Container Manager | compose.yaml structure, node:22-slim base image, bind mount pattern — all researched |
| INFRA-02 | Docker images built from GitHub repo and pushed to self-hosted registry; compose file references versioned tags | GitHub Actions multi-arch workflow with QEMU + buildx + docker/metadata-action tagging — researched |
| INFRA-03 | App is accessible in any browser via local IP and port | Fastify serving static Vite build via @fastify/static — researched |
| INFRA-04 | No app-level tunnel configuration required; Tailscale provides external access transparently | No app changes needed; Tailscale operates at network layer — confirmed out of scope for app code |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield bootstrap: stand up a three-package npm workspaces monorepo, build a minimal Fastify + SQLite backend and a bare React + Vite frontend, containerise it with a multi-stage Dockerfile, and wire a GitHub Actions CI/CD pipeline that produces and publishes multi-arch images to Docker Hub.

The stack versions in CLAUDE.md are substantially out of date relative to the npm registry as of April 2026. React is at 19.x (not 18.x), Fastify is at 5.x (not 4.x), Vite is at 8.x (not 5.x), TypeScript is at 6.x (not 5.4+), better-sqlite3 is at 12.x (not 9.x), and pino is at 10.x. All of these are stable production releases — the project should adopt current versions rather than pinning to stale ones. Version incompatibilities across the set are not a concern: all current versions support Node.js 22 and ARM64 Debian.

The most important operational pitfall for a Synology NAS deployment is volume permission handling. Docker containers run as root by default, but Synology uses a custom UID/GID scheme; bind-mounted folders must be owned by the UID/GID the container actually runs as, or file creation will fail silently at the filesystem level. The plan must include a step to document and wire `PUID`/`PGID` into the compose file. INFRA-04 (Tailscale access) requires zero app-level work — Tailscale handles it at the network layer.

**Primary recommendation:** Scaffold with current ecosystem versions (React 19, Fastify 5, Vite 8, TS 6, better-sqlite3 12, Drizzle 0.45), use the standard QEMU-based GitHub Actions multi-arch workflow, and use `user: "${PUID}:${PGID}"` in compose.yaml with defaults documented in `.env.example`.

---

## Standard Stack

### Core (verified against npm registry 2026-04-02)

| Library | Verified Version | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| Node.js | 22 LTS | Backend runtime | LTS through April 2027; official linux/arm64 Docker image; locked in CLAUDE.md |
| TypeScript | **6.0.2** | Language | Current stable; `strict: true` is now the default — no tsconfig flag needed |
| Fastify | **5.8.4** | HTTP API server | Current stable v5; requires Node 20+; TypeScript-first; serves static files via @fastify/static |
| @fastify/static | **9.0.0** | Serve React build | Official Fastify plugin for static file serving; replaces need for nginx sidecar |
| React | **19.2.4** | Frontend UI | Current stable; production-ready since Dec 2024; `forwardRef` no longer required |
| react-dom | **19.2.4** | React renderer | Must match React version exactly |
| Vite | **8.0.3** | Frontend build | Current stable (Mar 2026); Rolldown-powered; 10-30x faster builds; requires Node 20.19+ or 22.12+ |
| @vitejs/plugin-react | **6.0.1** | React + Vite integration | v6 uses Oxc instead of Babel; ships with Vite 8 |
| better-sqlite3 | **12.8.0** | SQLite driver | Current stable; requires Node 20+; prebuilt linux/arm64 glibc binaries ship in release |
| @types/better-sqlite3 | **7.6.13** | TypeScript types | Official types package |
| drizzle-orm | **0.45.2** | ORM / query builder | Type-safe SQLite; zero-process (no separate engine binary) |
| drizzle-kit | **0.31.10** | Migration CLI | Must be kept in sync with drizzle-orm; run `drizzle-kit migrate` |
| pino | **10.3.1** | Structured logger | Fast JSON logger; built-in child loggers; replaces console.log in backend |
| tsx | **4.21.0** | TypeScript runner | Run .ts files directly in dev; replaces ts-node for Node 22 |

### Supporting (dev tooling — verified)

| Library | Verified Version | Purpose | When to Use |
|---------|-----------------|---------|-------------|
| vitest | **4.1.2** | Test runner | Same config as Vite; no separate Jest needed; use for unit tests |
| eslint | **10.1.0** | Linting | Standard TS project tooling |
| typescript-eslint | **8.58.0** | ESLint TS rules | The canonical ESLint plugin for TypeScript |
| prettier | **3.8.1** | Code formatting | Configure once at root |
| @types/node | **25.5.0** | Node.js types | Required by TS 6 — must be listed in tsconfig `types` array explicitly |
| @types/react | **19.2.14** | React types | Matches React 19 |
| @types/react-dom | **19.2.3** | React DOM types | Matches react-dom 19 |

### Alternatives Considered

| Recommended | Alternative | Tradeoff |
|-------------|-------------|----------|
| Fastify 5 | Fastify 4 (pinned) | No reason to pin to 4.x; v5 is stable, requires Node 20+ (already using Node 22) |
| Vite 8 | Vite 5 (from CLAUDE.md) | Vite 8 is current stable; 5 is available as `previous` tag but unmaintained going forward |
| React 19 | React 18 | React 19 is stable since Dec 2024; new `use()`, Actions, and ref-as-prop all useful in later phases |
| TS 6 | TS 5.x | TS 6 defaults are saner for new projects; `strict: true` by default saves tsconfig config |
| better-sqlite3 12 | better-sqlite3 9 (from CLAUDE.md) | v12 is current; same API, supports Node 20+ |
| drizzle-orm 0.45 | drizzle-orm 0.30 (from CLAUDE.md) | 0.45 is current stable; same API surface for SQLite basic use |

**Installation (root-level dev tools):**
```bash
npm install -D typescript@6 tsx vitest eslint prettier typescript-eslint @types/node
```

**Installation (backend workspace):**
```bash
npm install fastify @fastify/static better-sqlite3 drizzle-orm pino
npm install -D @types/better-sqlite3 drizzle-kit
```

**Installation (frontend workspace):**
```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react @types/react @types/react-dom
```

---

## Architecture Patterns

### Recommended Project Structure

```
coruscant/                        # repo root
├── compose.yaml                  # single compose file (D-13)
├── Dockerfile                    # multi-stage build (D-21)
├── .env.example                  # committed; documents all vars (D-15)
├── .env                          # gitignored; actual values (D-14)
├── .gitignore
├── package.json                  # root — declares workspaces, root scripts
├── tsconfig.json                 # root base tsconfig
├── tsconfig.build.json           # references all packages for tsc --build
├── drizzle.config.ts             # at repo root, points to backend schema
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── types.ts          # empty export for now (D-07)
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          # Fastify server entrypoint
│   │       ├── db.ts             # better-sqlite3 + drizzle setup
│   │       ├── schema.ts         # Drizzle schema (minimal for Phase 1)
│   │       └── routes/
│   │           └── health.ts     # GET /health
│   └── frontend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx          # React entrypoint
│           └── App.tsx           # placeholder page
└── .github/
    └── workflows/
        └── docker-publish.yml    # CI/CD pipeline (D-08 to D-11)
```

### Pattern 1: npm Workspaces with TypeScript Project References

**What:** Root `package.json` declares `"workspaces": ["packages/*"]`. Each package has its own `package.json` and `tsconfig.json` with `"composite": true`. Root `tsconfig.build.json` lists all packages as references so `tsc --build` compiles in dependency order.

**When to use:** Always — this is the mandatory structure per D-01 through D-03.

Root `package.json`:
```json
{
  "name": "coruscant",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "tsc --build tsconfig.build.json",
    "dev:backend": "npm run dev --workspace=packages/backend",
    "dev:frontend": "npm run dev --workspace=packages/frontend",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^6.0.2",
    "tsx": "^4.21.0",
    "vitest": "^4.1.2"
  }
}
```

Root `tsconfig.json` (TypeScript 6 defaults — `strict: true` and `module: esnext` are already default):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "sourceMap": true,
    "composite": true,
    "skipLibCheck": true,
    "types": ["node"]
  }
}
```

**CRITICAL — TypeScript 6 breaking change:** `types` defaults to `[]` (empty) in TS 6. If `"types": ["node"]` is omitted, `process`, `fs`, and other Node globals will cause compile errors in the backend. Must be explicit.

### Pattern 2: Fastify v5 Server with Static File Serving

**What:** Fastify 5 serves both the `/api/*` routes and the compiled Vite bundle from the same process. No nginx sidecar needed (D-23).

Backend `src/index.ts`:
```typescript
// Source: https://fastify.dev/docs/latest/Guides/Getting-Started/
import Fastify from 'fastify'
import staticPlugin from '@fastify/static'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fastify = Fastify({ logger: true })

// Serve compiled Vite bundle (production)
const __dirname = fileURLToPath(new URL('.', import.meta.url))
await fastify.register(staticPlugin, {
  root: join(__dirname, '../../frontend/dist'),
  prefix: '/',
})

// API routes
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Start
await fastify.listen({ port: parseInt(process.env.PORT ?? '3000'), host: '0.0.0.0' })
```

**Fastify v5 change from v4:** Use `{ port: 3000 }` object form for `.listen()`. The old positional `.listen(3000)` is deprecated. The `host: '0.0.0.0'` is mandatory in Docker — without it the server only listens on loopback and is unreachable from the host.

### Pattern 3: Drizzle ORM + better-sqlite3 with SQLite round-trip

**What:** On backend startup, open the SQLite database at `/app/data/coruscant.db`, run pending migrations, then write and read a probe row to confirm persistence (D-05, D-20).

Backend `src/db.ts`:
```typescript
// Source: https://orm.drizzle.team/docs/get-started-sqlite
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const sqlite = new Database(process.env.DB_PATH ?? '/app/data/coruscant.db')

// WAL mode for concurrent reads; recommended for Node.js servers
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('synchronous = normal')

export const db = drizzle({ client: sqlite })

export async function initDb() {
  // Run any pending migrations from ./drizzle folder
  migrate(db, { migrationsFolder: './drizzle' })
}
```

`drizzle.config.ts` (at repo root):
```typescript
// Source: https://orm.drizzle.team/docs/get-started-sqlite
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './packages/backend/src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH ?? './data/coruscant.db',
  },
})
```

### Pattern 4: Multi-Stage Dockerfile

**What:** Builder stage compiles TypeScript and builds the Vite bundle. Runner stage (`node:22-slim`) copies only the compiled output and production `node_modules`. No devDependencies in the final image (D-21, D-22).

```dockerfile
# Stage 1: builder
FROM node:22 AS builder
WORKDIR /build

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
COPY packages/shared/package.json packages/shared/

RUN npm ci

# Copy source
COPY . .

# Build backend TypeScript
RUN npm run build --workspace=packages/backend

# Build Vite frontend
RUN npm run build --workspace=packages/frontend

# Stage 2: runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests for production install
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/
COPY packages/shared/package.json packages/shared/

RUN npm ci --omit=dev

# Copy compiled backend output
COPY --from=builder /build/packages/backend/dist ./packages/backend/dist

# Copy compiled frontend bundle to where backend serves it from
COPY --from=builder /build/packages/frontend/dist ./packages/frontend/dist

# Copy drizzle migration files
COPY --from=builder /build/drizzle ./drizzle

EXPOSE 3000

CMD ["node", "packages/backend/dist/index.js"]
```

**Note:** `node:22-slim` is Debian-based (glibc). better-sqlite3 12.x ships prebuilt glibc binaries for linux/arm64 — no compilation needed in the runner stage, so `python3` and `make` are not required.

### Pattern 5: GitHub Actions Multi-Arch CI/CD

**What:** On push to `main`, build linux/amd64 + linux/arm64 via QEMU emulation and push to Docker Hub with `latest` and `<short-sha>` tags (D-08 to D-11).

`.github/workflows/docker-publish.yml`:
```yaml
# Source: https://docs.docker.com/build/ci/github-actions/multi-platform/
name: Build and Publish Docker Image

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to Docker Hub
        uses: docker/login-action@v4
        with:
          username: ${{ vars.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v4

      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ vars.DOCKERHUB_USERNAME }}/coruscant
          tags: |
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}
            type=sha,format=short

      - name: Build and push
        uses: docker/build-push-action@v7
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**GitHub Actions secrets to configure:**
- `DOCKERHUB_TOKEN` (secret) — Docker Hub access token (not password)
- `DOCKERHUB_USERNAME` (variable, not secret) — Docker Hub username

### Pattern 6: compose.yaml with Bind Mount and UID/GID

**What:** Single `compose.yaml` at repo root. Data directory bind-mounted from host. UID/GID passed via `.env` so the container process matches the NAS user who owns the data directory (D-13, D-14, D-18, D-19).

```yaml
# compose.yaml
services:
  coruscant:
    image: ${DOCKER_HUB_REPO}:${IMAGE_TAG:-latest}
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - ${DATA_PATH}:/app/data
    user: "${PUID:-1000}:${PGID:-1000}"
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/coruscant.db
      - ENCRYPTION_KEY_SEED=${ENCRYPTION_KEY_SEED}
```

`.env.example`:
```bash
# Docker Hub image to pull
DOCKER_HUB_REPO=yourusername/coruscant
IMAGE_TAG=latest

# Port exposed on the NAS host
PORT=3000

# Absolute path on NAS host where SQLite data is stored
# Synology convention: /volume1/docker/<app-name>
DATA_PATH=/volume1/docker/coruscant

# NAS user/group IDs — find with: id <your-nas-user>
# Run `id` on the NAS SSH shell to get these values
PUID=1026
PGID=100

# Seed for SQLite credential encryption (Phase 3+)
# Generate: openssl rand -hex 32
ENCRYPTION_KEY_SEED=changeme-replace-with-random-hex
```

### Anti-Patterns to Avoid

- **Alpine base image:** `node:22-alpine` uses musl libc; better-sqlite3 v12 prebuilt binaries target glibc (Debian). Use `node:22-slim` exclusively.
- **Missing `host: '0.0.0.0'` in Fastify listen:** Container processes default to localhost; without this the app is unreachable from outside the container.
- **Committing `.env`:** Contains `ENCRYPTION_KEY_SEED` — must be in `.gitignore`.
- **PM2 inside Docker:** Anti-pattern. Use `restart: unless-stopped` in compose.yaml.
- **Service URLs in `.env`:** Per D-16, service credentials belong in the Settings UI (Phase 3), not in the `.env` file.
- **Running container as root:** Synology volume permissions will mismatch. Always set `user: PUID:PGID`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static file serving in production | Custom file server middleware | `@fastify/static` v9 | Handles ETag, cache headers, range requests, and content-type correctly |
| SQLite schema migrations | Custom SQL runner | `drizzle-kit migrate` + `migrate()` from drizzle | Tracks applied migrations; handles schema diff |
| Multi-arch Docker builds | Manual QEMU setup | `docker/setup-qemu-action` + `docker/build-push-action` | Abstracts platform matrix, manifest list creation, push atomicity |
| Docker image tagging | Shell git-sha extraction | `docker/metadata-action` | Produces correctly-formatted OCI labels and multiple tags from a declarative spec |
| TypeScript Node.js execution in dev | Custom watch + compile loop | `tsx` | Instant TS execution; no compile step; file watching built in |

**Key insight:** Every item in this list has a well-maintained official solution. Custom implementations in this domain introduce subtle bugs (cache poisoning in static file serving, migration ordering errors, partial manifest pushes in multi-arch builds).

---

## Common Pitfalls

### Pitfall 1: Synology NAS Volume Permission Denied

**What goes wrong:** Container starts, Fastify initialises, `better-sqlite3` opens the database path `/app/data/coruscant.db`, gets `EACCES: permission denied`. App crashes on startup.

**Why it happens:** The bind-mounted directory on the NAS is owned by a Synology-specific UID (e.g., `1026`) and GID (e.g., `100`). If the container runs as root (UID 0) or any other UID, writes to the mount will be denied by the host filesystem.

**How to avoid:** Set `user: "${PUID}:${PGID}"` in `compose.yaml`. SSH into the NAS, run `id <your-user>` to get the UID and GID, and write those into `.env`. Create the data directory manually before first deploy: `mkdir -p /volume1/docker/coruscant`.

**Warning signs:** `Error: SQLITE_CANTOPEN: unable to open database file` or `EACCES` in container logs immediately after startup.

### Pitfall 2: TypeScript 6 — `types` Array is Empty by Default

**What goes wrong:** Backend compiles fine locally (or with a broader tsconfig), but CI build fails with `Cannot find name 'process'`, `Cannot find name 'Buffer'`, or similar Node.js global errors.

**Why it happens:** TypeScript 6 changed the default for `types` from auto-discovery to `[]` (empty). `@types/node` is no longer automatically included.

**How to avoid:** Add `"types": ["node"]` to the backend `tsconfig.json`. The frontend tsconfig does not need `node` types.

**Warning signs:** TS errors referencing `process`, `Buffer`, `__dirname`, `URL`, or any `fs`/`path` module type.

### Pitfall 3: Fastify Not Reachable from Host in Docker

**What goes wrong:** Container starts, health endpoint returns `ok` when `exec`'d into, but `curl http://localhost:3000/health` from the NAS host returns connection refused.

**Why it happens:** Fastify defaults to listening on `127.0.0.1`. Inside a Docker container this is the container's own loopback — unreachable from the host even with port mapping.

**How to avoid:** Always pass `host: '0.0.0.0'` to `fastify.listen()`. This is mandatory in any container deployment.

**Warning signs:** Port mapping appears correct in `compose.yaml` but the service is unreachable.

### Pitfall 4: QEMU Multi-Arch Build — ARM64 Compilation of Native Modules

**What goes wrong:** GitHub Actions multi-arch build succeeds for `linux/amd64` but fails for `linux/arm64` with a compile error related to `node-pre-gyp` or `better-sqlite3`.

**Why it happens:** When QEMU emulates ARM64 on an x86 runner, `npm ci` may attempt to compile `better-sqlite3` from source if prebuilt binaries aren't found. The compile environment inside QEMU may lack `python3` or `make`.

**How to avoid:** The builder stage of the Dockerfile runs `npm ci` (which downloads prebuilt binaries). better-sqlite3 v12 ships prebuilt glibc binaries for `linux-arm64` — they should download without compilation. If compilation is triggered, add `python3` and `build-essential` to the builder stage only. Confirm the prebuilt binary is used by watching for "Downloading prebuilt binaries" (vs "Building from source") in the CI logs.

**Warning signs:** `gyp ERR! build error` or `make: not found` during ARM64 build step.

### Pitfall 5: Drizzle Config `driver` vs `dialect` Field

**What goes wrong:** `drizzle-kit migrate` fails with a config parsing error or "driver not found" error.

**Why it happens:** Drizzle's config schema changed between 0.30 and 0.45. Older docs and examples use `driver: 'better-sqlite'`; current versions use `dialect: 'sqlite'`. The two are not interchangeable.

**How to avoid:** Always use `dialect: 'sqlite'` in `drizzle.config.ts` for drizzle-kit 0.31+. The `driver` field is no longer used.

**Warning signs:** `Invalid configuration` or `Cannot read properties of undefined` from drizzle-kit CLI.

### Pitfall 6: better-sqlite3 `migrate()` is Synchronous

**What goes wrong:** Code wraps `migrate(db, ...)` in `await`, or expects it to return a Promise. It doesn't — it blocks synchronously.

**Why it happens:** better-sqlite3 is a synchronous driver by design. All operations including migrations are synchronous. This is intentional and correct.

**How to avoid:** Call `migrate(db, { migrationsFolder: './drizzle' })` without `await`. It executes synchronously at startup before the Fastify server begins listening. This is the correct usage pattern.

---

## Code Examples

### Health endpoint with SQLite round-trip (D-05)

```typescript
// packages/backend/src/routes/health.ts
// SQLite round-trip proves persistence is operational on startup
import { db } from '../db.js'
import { sql } from 'drizzle-orm'

export async function healthRoutes(fastify: any) {
  fastify.get('/health', async () => {
    // Simple SELECT to confirm DB is readable
    const result = db.get(sql`SELECT 1 as ping`)
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: result ? 'connected' : 'error',
    }
  })
}
```

### Vite config for frontend (Vite 8)

```typescript
// packages/frontend/vite.config.ts
// Source: https://vite.dev/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Emit source maps for debugging
    sourcemap: false,
  },
  server: {
    port: 5173,
    // Proxy API calls to Fastify in dev
    proxy: {
      '/health': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
})
```

### SQLite initialisation with WAL pragma

```typescript
// packages/backend/src/db.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const DB_PATH = process.env.DB_PATH ?? '/app/data/coruscant.db'

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('synchronous = normal')
sqlite.pragma('cache_size = -10000')  // 10MB page cache

export const db = drizzle({ client: sqlite })

export function initDb(migrationsFolder: string): void {
  migrate(db, { migrationsFolder })
}
```

---

## State of the Art

| Old Approach (CLAUDE.md) | Current Approach | Changed | Impact |
|--------------------------|-----------------|---------|--------|
| React 18.x | React 19.2.4 | Dec 2024 | New hooks (`useActionState`, `use()`); `forwardRef` no longer needed; stable since Dec 2024 |
| Fastify 4.x | Fastify 5.8.4 | Oct 2024 | Full JSON Schema required for query/params/body; `.listen()` object form required; Node 20+ minimum |
| Vite 5.x | Vite 8.0.3 | Mar 2026 | Rolldown-powered (10-30x faster builds); `rollupOptions` renamed to `rolldownOptions`; Node 20.19+ / 22.12+ required |
| TypeScript 5.4+ | TypeScript 6.0.2 | 2025 | `strict: true` and `module: esnext` are now defaults; `types: []` default breaks `@types/node` auto-discovery |
| better-sqlite3 9.x | better-sqlite3 12.8.0 | 2025 | Requires Node 20+; same API; prebuilt linux/arm64 glibc binaries included |
| drizzle-orm 0.30 | drizzle-orm 0.45.2 | 2025 | `driver` field removed from config; use `dialect: 'sqlite'` instead; same ORM API |
| pino 9.x | pino 10.3.1 | 2025 | Same API; minor version bumps |
| Socket.IO (CLAUDE.md) | SSE (STATE.md decision) | Init | SSE chosen over Socket.IO — proxies cleanly through Synology DSM Nginx; Phase 1 installs neither |

**Not yet installed in Phase 1 (planned for later phases):**
- SSE transport: Phase 2+
- TanStack Query: Phase 2+
- Framer Motion / Three.js: Phase 2
- node-cron / axios: Phase 3+

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build / dev | Yes | 25.8.1 (local dev) | — |
| npm | Package management | Yes | 11.11.0 | — |
| Docker | Container build | Yes | 29.2.1 | — |
| Docker Compose v2 | Container orchestration | Yes | v5.1.0 | — |
| Git | Version control | Yes | 2.39.5 | — |
| GitHub CLI (`gh`) | PR/release automation | No | — | Use GitHub web UI or curl for API calls |

**Node.js version note:** Local dev machine runs Node.js 25.8.1 (current). The Docker container will run `node:22-slim`. Both satisfy the minimum requirements for all Phase 1 packages (Node 20+). No version conflict.

**Missing dependencies with no fallback:**
- None that block Phase 1 execution.

**Missing dependencies with fallback:**
- `gh` CLI: Not installed. GitHub Actions workflows can be created via file edit + git push. No blocker.

**Synology NAS availability:** Not checked (remote device). The plan must include a step to verify NAS accessibility and UID/GID before the first `docker compose up`. The user must SSH into the NAS and run `id <user>` to populate `.env`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | None yet — Wave 0 gap |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| INFRA-01 | App runs as Docker Compose project on Synology NAS | Smoke (manual deploy) | Manual: `docker compose up` on NAS | N/A — infrastructure |
| INFRA-02 | GitHub Actions builds + pushes multi-arch image to Docker Hub | Integration (CI verify) | Manual: check GitHub Actions run; `docker manifest inspect` for arm64 | N/A — CI pipeline |
| INFRA-03 | App accessible in browser via local IP and port | Smoke (automated) | `npx vitest run --reporter=verbose` + manual curl | ❌ Wave 0 |
| INFRA-04 | No app-level Tailscale config required | N/A — architectural | No test needed; verified by architecture review | N/A |

**Unit-testable behaviors in Phase 1:**
- Fastify server initialises and `/health` returns `{ status: 'ok' }` — unit test with Fastify `inject()`
- SQLite round-trip: write then read returns the same value — unit test with in-memory `:memory:` database
- Database path defaults to `/app/data/coruscant.db` when `DB_PATH` env var is absent

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run` (full suite; no coverage gate in Phase 1)
- **Phase gate:** All unit tests green; manual smoke test of Docker deploy on NAS

### Wave 0 Gaps

- [ ] `packages/backend/src/__tests__/health.test.ts` — covers INFRA-03 (Fastify health endpoint unit test)
- [ ] `packages/backend/src/__tests__/db.test.ts` — covers INFRA-01/DB persistence (SQLite round-trip with `:memory:`)
- [ ] `vitest.config.ts` at repo root — workspace-aware test config pointing to `packages/*/src/__tests__`
- [ ] Framework install: already declared (`vitest` in root devDependencies)

---

## Open Questions

1. **NAS UID/GID values**
   - What we know: Synology NAS uses custom UIDs (often 1026+); the container must run as the NAS user who owns `/volume1/docker/coruscant`
   - What's unclear: The actual UID/GID values on this specific NAS — cannot be determined without SSH access
   - Recommendation: Document in `.env.example` with instructions; include a setup step in the plan that tells the user to run `id` on the NAS before first deploy

2. **Docker Hub repository name**
   - What we know: D-10 specifies `yourname/coruscant:<short-sha>` as the tag pattern
   - What's unclear: The actual Docker Hub username to use in the workflow
   - Recommendation: Use `${{ vars.DOCKERHUB_USERNAME }}` as a GitHub Actions variable — the user sets it in their GitHub repo settings

3. **Fastify serving React SPA — catch-all route**
   - What we know: `@fastify/static` serves files from `dist/`; React Router (used in Phase 2+) needs a catch-all to serve `index.html` for all non-API paths
   - What's unclear: Whether Phase 1 needs this now or just static serving is sufficient
   - Recommendation: Add a catch-all `*` route that returns `index.html` in Phase 1 so Phase 2 doesn't need to touch the server

---

## Sources

### Primary (HIGH confidence)

- npm registry (verified 2026-04-02) — all package versions confirmed via `npm view <pkg> version`
- [Fastify Getting Started](https://fastify.dev/docs/latest/Guides/Getting-Started/) — Fastify v5 server setup, `.listen()` object form
- [Fastify v5 Migration Guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/) — breaking changes from v4
- [Drizzle ORM SQLite (better-sqlite3)](https://orm.drizzle.team/docs/get-started-sqlite) — `dialect: 'sqlite'`, DB setup, drizzle.config.ts
- [Docker multi-platform CI/CD](https://docs.docker.com/build/ci/github-actions/multi-platform/) — QEMU + buildx + build-push-action workflow
- [Vite 8 release announcement](https://vite.dev/blog/announcing-vite8) — stability confirmation, Node 22.12+ requirement, Rolldown architecture

### Secondary (MEDIUM confidence)

- [React 19 blog post](https://react.dev/blog/2024/12/05/react-19) — stability confirmation, new APIs
- [TypeScript 6 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) — `types: []` default change, `strict: true` default
- WebSearch: Synology NAS Docker UID/GID — multiple community sources confirm `user: PUID:PGID` pattern in compose.yaml; `id <user>` command to get values
- WebSearch: GitHub Actions multi-arch Docker QEMU workflow — confirmed QEMU approach is standard for free GitHub runners; 3-10x slower than native ARM but functional
- [npm workspaces + TypeScript project references](https://yieldcode.blog/post/npm-workspaces/) — `tsconfig.build.json` references pattern, `"composite": true` per package

### Tertiary (LOW confidence — flag for validation)

- better-sqlite3 12.x prebuilt linux/arm64 glibc binaries: confirmed via GitHub release asset count (143 assets) and community reports; exact binary list not directly verified — test during Wave 0 CI run
- Drizzle ORM 0.45 `dialect` vs `driver` config field change: confirmed via search; verify empirically when running `drizzle-kit migrate` in CI

---

## Metadata

**Confidence breakdown:**
- Standard stack versions: HIGH — verified against npm registry on research date
- Architecture patterns: HIGH — based on official docs for all core tools
- Docker multi-arch CI: MEDIUM — QEMU approach confirmed working but ARM build time in CI is unknown
- Synology NAS UID/GID: MEDIUM — community pattern is consistent; specific values require on-device verification
- better-sqlite3 arm64 prebuilt binary: MEDIUM — expected to work based on v12 release assets; verify in first CI run

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable ecosystem; Vite/Drizzle move fast — re-verify if planning resumes after 30 days)
