---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed quick task 260405-1of (debug-docker-stats-api-discovery)
last_updated: "2026-04-05T08:14:57.729Z"
last_activity: 2026-04-05
progress:
  total_phases: 11
  completed_phases: 4
  total_plans: 35
  completed_plans: 32
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-02)

**Core value:** A single glance from a phone tells you whether your home infrastructure is healthy or needs attention.
**Current focus:** Phase 05 — ui-v2-instrument-panel-polish

## Current Position

Phase: 05 (ui-v2-instrument-panel-polish) — EXECUTING
Plan: 3 of 5
Status: Ready to execute
Last activity: 2026-04-05

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
| Phase 02-core-ui-shell P08 | 3m | 2 tasks | 4 files |
| Phase 02-core-ui-shell P09 | 124s | 2 tasks | 4 files |
| Phase 02-core-ui-shell P13 | 8m | 2 tasks | 2 files |
| Phase 02-core-ui-shell P12 | 187s | 2 tasks | 4 files |
| Phase 02-core-ui-shell P11 | 188s | 2 tasks | 4 files |
| Phase 03-settings-first-service-adapters P01 | 5min | 2 tasks | 11 files |
| Phase 03-settings-first-service-adapters P03 | 8min | 1 tasks | 2 files |
| Phase 03-settings-first-service-adapters P02 | 6m4s | 2 tasks | 6 files |
| Phase 03-settings-first-service-adapters P04 | 5min | 1 tasks | 1 files |
| Phase 03-settings-first-service-adapters P04 | 5min | 2 tasks | 1 files |
| Phase 04-rich-service-integrations P01 | 223s | 2 tasks | 7 files |
| Phase 04-rich-service-integrations P02 | 363s | 3 tasks | 8 files |
| Phase 04-rich-service-integrations P03 | 314s | 2 tasks | 4 files |
| Phase 04-rich-service-integrations P04 | 116s | 2 tasks | 2 files |
| Phase 04-rich-service-integrations P05 | 1.5min | 1 tasks | 2 files |
| Phase 05-ui-v2-instrument-panel-polish P02 | 8min | 2 tasks | 3 files |
| Phase 05-ui-v2-instrument-panel-polish P03 | 127s | 1 tasks | 1 files |

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
- [Phase 02-core-ui-shell]: Static instrument wall uses repeating-linear-gradient at 120px/200px pitch for amber seam lines — no animated pulses
- [Phase 02-core-ui-shell]: ServiceCard: chamfered instrument panel with service-specific instrument bodies — NAS gauges, arr dot matrix, Plex signal bars, SABnzbd progress, Pi-hole stats
- [Phase 02-core-ui-shell]: Back button removed from ServiceDetailPage — AppHeader showBack prop handles back navigation on all sub-pages (D-37)
- [Phase 02-core-ui-shell]: StreamRow restructured to single row (USER > TITLE left, QUAL/DIRECT right) with 1px amber progress line below
- [Phase 02-core-ui-shell]: Deep-space blue tokens kept at low opacity (0.06-0.15) so amber remains dominant; GridBackground uses two-div layout for seam grid plus nebula overlay; spaceFloat/nebulaBreath are GPU-composited transform+opacity only
- [Phase 02-core-ui-shell]: ArrInstrument replaces DotMatrixInstrument — status LED + download indicator shows only actionable info on card face
- [Phase 02-core-ui-shell]: Attention Required section in arr detail page uses amber tint + left border, only rendered when attentionItems exist
- [Phase 02-core-ui-shell]: AppHeader uses 3-col CSS grid for single-row NAS instrument panel layout at 800px
- [Phase 02-core-ui-shell]: NasVolume interface exported from shared types with tempF field; mock uses TheRock volume name with realistic 88-100°F temps
- [Phase 03-settings-first-service-adapters]: PollManager uses setInterval (not node-cron) for service polling — interval-based not schedule-based, simpler to test
- [Phase 03-settings-first-service-adapters]: crypto.ts: use parts.length !== 3 guard in decrypt() — !ciphertextHex fails for empty string encryption (empty hex is falsy)
- [Phase 03-settings-first-service-adapters]: SettingsPage accepts snapshot as prop from App.tsx — avoids duplicate SSE connections
- [Phase 03-settings-first-service-adapters]: Settings GET never returns encryptedApiKey or plaintext key — only hasApiKey boolean for frontend display
- [Phase 03-settings-first-service-adapters]: test-connection always returns HTTP 200 with success/failure in JSON body — simpler frontend error handling
- [Phase 03-settings-first-service-adapters]: ServiceCard: configured === false strict check — legacy services without flag are not treated as unconfigured
- [Phase 03-settings-first-service-adapters]: ServiceCard: StatusDot status='stale' reused for grey LED on unconfigured cards — no new LED state needed
- [Phase 03-settings-first-service-adapters]: ServiceCard: configured === false strict check — legacy services without flag are not treated as unconfigured
- [Phase 03-settings-first-service-adapters]: ServiceCard: StatusDot status='stale' reused for grey LED on unconfigured cards — no new LED state needed
- [Phase 04-rich-service-integrations]: username column stored plaintext on serviceConfig — DSM login name is not a secret, only the password is encrypted
- [Phase 04-rich-service-integrations]: Pi-hole v6 only: POST /api/auth with password — v5 FTL API not supported
- [Phase 04-rich-service-integrations]: Pi-hole session cached in module-level Map, invalidated on 401
- [Phase 04-rich-service-integrations]: Plex has no poll timer — Tautulli webhook is the ONLY data source for Plex streams (D-25) [SUPERSEDED by quick task 260404-rxw: Plex now uses direct 5s PMS poll; Tautulli webhook kept as backward-compat override]
- [Phase 04-rich-service-integrations]: ARR_INTERVAL_MS changed from 45_000 to 5_000 (D-27); PIHOLE=60s; NAS=3s
- [Phase 04-rich-service-integrations]: NAS fans field is undefined (not []) when empty (D-19)
- [Phase 04-rich-service-integrations]: recharts installed for PieChart donut chart — missing dependency auto-fixed (Rule 3)
- [Phase 04-rich-service-integrations]: MediaStackRow exported from ServiceCard.tsx — condensed LED+label rows for arr services (D-29)
- [Phase 04-rich-service-integrations]: CardGrid two-column layout: MEDIA STACK panel (arr LED rows) left, full cards right
- [Phase 04-rich-service-integrations]: AppHeader expandable panel IS the NAS detail view (SVCRICH-05) — no separate route needed
- [Phase 04-rich-service-integrations]: nasConfigured uses strict !== false check — legacy/mock services without configured flag are not treated as unconfigured
- [Phase 04-rich-service-integrations]: NowPlayingBanner returns null only when plexConfigured is false — idle state shown for configured+no-streams (D-11)
- [Phase 05-ui-v2-instrument-panel-polish]: MediaStackRow LED: green when online+idle (not purple); solid purple=downloading, flashing=queued
- [Phase 05-ui-v2-instrument-panel-polish]: Pi-hole card renamed NETWORK with Ubiquiti NOT CONFIGURED placeholder (D-15, D-16)
- [Phase 05-ui-v2-instrument-panel-polish]: CardGrid rewritten as flat grid without tier section labels — reclaims 96px vertical space for 800x480
- [Phase 05-ui-v2-instrument-panel-polish]: NAS header is always-visible with no expand/collapse mechanic — disk temps, Docker stats, and image update LED render inline (D-18 through D-22)
- [Phase quick-260405-1of]: /debug/docker-stats now returns { discovery, attempts, attemptsWithType } — discovery holds raw SYNO.API.Info response revealing exact required params; attemptsWithType retries with type=all to resolve error 114 (missing required param)

### Roadmap Evolution

- Phase 9 added: Production Deploy and Hardening (self-hosted registry migration, v1.0 tagging, git cleanup)
- Phase 11 added: Raspberry Pi kiosk — SSH-driven fullscreen browser kiosk on local LAN

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260403-eh1 | arr+SABnzbd status color semantics: green=up, red=down, yellow=error, purple=downloading | 2026-04-03 | b4a0398 | [260403-eh1-arr-sabnzbd-status-color-semantics-green](./quick/260403-eh1-arr-sabnzbd-status-color-semantics-green/) |
| 260404-rxw | Switch Plex data source from Tautulli webhook to direct 5-second PMS poll | 2026-04-05 | 0db78f8 | [260404-rxw-switch-plex-data-source-from-tautulli-we](./quick/260404-rxw-switch-plex-data-source-from-tautulli-we/) |
| 260405-1ai | Phase 5 visual fixes: AppHeader 3-col grid, tile height reduction, NETWORK left/right split, guarded decrypt() | 2026-04-05 | 798747a | [260405-1ai-phase5-visual-fixes-and-crypto-error](./quick/260405-1ai-phase5-visual-fixes-and-crypto-error/) |

### Blockers/Concerns

- Phase 1: Verify Synology NAS UID/GID for volume permission setup before first container start
- Phase 4: Pi-hole version (v5 vs v6) must be confirmed before implementing Pi-hole adapter — auth mechanism differs
- Phase 5: UniFi controller version (classic vs UniFi OS 3.x) must be confirmed before implementation — login endpoint differs
- Phase 8: `ring-client-api` maintenance status unknown after August 2025 — verify before starting Phase 8

## Session Continuity

Last session: 2026-04-05T08:14:50.013Z
Stopped at: Completed quick task 260405-1of (debug-docker-stats-api-discovery)
Resume file: None
