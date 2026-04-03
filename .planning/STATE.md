---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-core-ui-shell 02-06-PLAN.md
last_updated: "2026-04-03T16:00:37.939Z"
last_activity: 2026-04-03
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 12
  completed_plans: 8
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-02)

**Core value:** A single glance from a phone tells you whether your home infrastructure is healthy or needs attention.
**Current focus:** Phase 02 — core-ui-shell

## Current Position

Phase: 02 (core-ui-shell) — EXECUTING
Plan: 3 of 10
Status: Ready to execute
Last activity: 2026-04-03

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 6 | 2 tasks | 18 files |
| Phase 01 P02 | 90 | 2 tasks | 4 files |
| Phase 02-core-ui-shell P02 | 8 | 2 tasks | 11 files |
| Phase 02-core-ui-shell P01 | 18min | 3 tasks | 9 files |
| Phase 02-core-ui-shell P03 | 2m12s | 2 tasks | 8 files |
| Phase 02-core-ui-shell P04 | 5 | 2 tasks | 4 files |
| Phase 02-core-ui-shell P07 | 8m | 2 tasks | 5 files |
| Phase 02-core-ui-shell P06 | 153s | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Stack confirmed as Node.js 22 + TypeScript + Fastify + React + Vite + SQLite (better-sqlite3) + SSE
- Init: Docker base image is `node:22-slim` (Debian) — NOT Alpine due to musl/better-sqlite3 incompatibility
- Init: SSE chosen over WebSocket — unidirectional, proxies cleanly through Synology DSM Nginx
- Init: Settings page (Phase 3) must exist before ANY service integration is wired to live credentials
- Init: Phase 8 (Smart Home) is research-gated and isolated — failure does not affect prior phases
- [Phase 01]: DB_PATH read lazily in createDb() default param — prevents ESM test isolation failures where env vars are set after import hoisting
- [Phase 01]: backend/tsconfig.json sets types:['node'] explicitly — TypeScript 6 changed default to empty types array, breaking Node.js globals
- [Phase 01]: Frontend tsconfig uses moduleResolution:bundler (not NodeNext) and does not extend root tsconfig — Vite 8 requires bundler resolution
- [Phase 01]: node:22-slim (Debian) runner — NOT Alpine: musl libc breaks better-sqlite3 prebuilt binaries
- [Phase 01]: PUID/PGID in compose.yaml user directive — required for Synology NAS bind-mount write permissions
- [Phase 01]: GitHub Actions CI builds linux/amd64 and linux/arm64 — NAS is ARM64, developer workstation is amd64
- [Phase 02-core-ui-shell]: Shared types (NasStatus, DashboardSnapshot, PlexStream) added to packages/shared in Plan 02 — AppHeader needed NasStatus for type-safe prop, ahead of Plan 03 but within scope
- [Phase 02-core-ui-shell]: Settings animation slider uses document.documentElement.style.setProperty for --grid-pulse-opacity — no React state needed; Phase 3 persists to SQLite
- [Phase 02-01]: MockSocket detection for SSE testing: request.raw.socket.constructor.name === 'MockSocket' identifies Fastify inject() — call reply.raw.end() immediately so inject returns with first SSE payload
- [Phase 02-01]: vitest --passWithNoTests flag added to frontend test script so npm run test succeeds before any component tests are written
- [Phase 02-core-ui-shell]: SSE hook lifted to App.tsx so AppHeader receives NAS stats and connected state on all routes
- [Phase 02-core-ui-shell]: Per-card animation stagger uses globalIndex across CardGrid sections for sequential border trace and entrance delays
- [Phase 02-core-ui-shell]: SSE hook called at App.tsx root level so snapshot is shared across all routes without multiple EventSource connections
- [Phase 02-core-ui-shell]: ServiceDetailPage accepts snapshot as prop rather than calling useDashboardSSE internally — avoids duplicate connections
- [Phase 02-core-ui-shell]: showBack detection lives in App.tsx via useLocation — avoids double-header problem on Settings/Logs pages
- [Phase 02-core-ui-shell]: AppHeader icon nav buttons hidden when showBack=true — redundant on sub-pages
- [Phase 02-core-ui-shell]: LED animations use separate keyframes (ledBreathe/ledPulseWarn/ledFlashDown) per health state for independent timing control
- [Phase 02-core-ui-shell]: CRT scanline rendered via body::after pseudo-element (not a React component) — zero JS overhead
- [Phase 02-core-ui-shell]: WiringOverlay uses preserveAspectRatio=none so paths stretch to fill any viewport

### Roadmap Evolution

- Phase 9 added: Production Deploy and Hardening (self-hosted registry migration, v1.0 tagging, git cleanup)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: Verify Synology NAS UID/GID for volume permission setup before first container start
- Phase 4: Pi-hole version (v5 vs v6) must be confirmed before implementing Pi-hole adapter — auth mechanism differs
- Phase 5: UniFi controller version (classic vs UniFi OS 3.x) must be confirmed before implementation — login endpoint differs
- Phase 8: `ring-client-api` maintenance status unknown after August 2025 — verify before starting Phase 8

## Session Continuity

Last session: 2026-04-03T16:00:37.934Z
Stopped at: Completed 02-core-ui-shell 02-06-PLAN.md
Resume file: None
