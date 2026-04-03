# Phase 2: Core UI Shell — Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Tron/Grid living UI shell with animated background, service card grid, NAS header stats bar, Now Playing banner, and card-to-detail navigation. Prove the full data pipeline (mock poll → SQLite → SSE → browser state → animated UI) end-to-end. Phase ends when a user can open the dashboard on a physical phone, see an animated grid with live-ish data updating every 5 seconds, tap a card to reach a detail view, and tap a Plex stream summary to see per-stream details. All data is mock in Phase 2 — real service integrations come in Phase 3+.

No service credentials, no real API calls, no Settings page content — that's Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Grid Background Animation

- **D-01:** CSS-only animated grid — no Three.js/WebGL canvas. CSS Grid lines + `@keyframes` for traveling pulses via pseudo-elements or SVG dashes. Zero runtime cost on NAS ARM hardware.
- **D-02:** Grid is `position: fixed` — it stays put as the user scrolls. Cards scroll over the grid. No parallax (scroll-jank risk on mobile, not worth it).
- **D-03:** Pulse intensity at rest is subtle (low-opacity, slow-moving). However, a **Settings toggle** must exist for animation intensity/speed — user wants to tune it after shipping. This is in-scope for Phase 2 as a Settings stub that Phase 3 wires to persisted config.
- **D-04:** Card glow/pulse rhythm changes with health state: healthy = slow breathing glow, warning = faster amber pulse, critical = sharp red flash. Animation rhythm communicates state, not just color.

### App Header

- **D-05:** Fixed top app bar structure (top-to-bottom):
  1. **Title row:** "CORUSCANT" left, Settings (⚙) and Logs (≡) icon buttons right
  2. **NAS stats strip:** split horizontally — left: CPU % + RAM %, right: /vol1 disk usage + temperature. Uses mock data in Phase 2; Phase 4 wires it live.
- **D-06:** Header uses the same Tron glow/animation treatment as cards — not a plain static bar.
- **D-07:** NAS stats live in the header, not as a service card. This frees up card grid space.

### Card Grid Layout

- **D-08:** **2-column CSS grid** on mobile (two cards side-by-side). `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))` — naturally expands to 3-4 columns on tablet, 4-5 on desktop. No explicit breakpoints needed.
- **D-09:** Cards are **grouped by tier** with section labels:
  - **STATUS** — Radarr, Sonarr, Lidarr, Bazarr (Phase 3)
  - **ACTIVITY** — SABnzbd (Phase 3)
  - **RICH DATA** — Pi-hole, Plex, NAS (Phase 4); UniFi (Phase 5)
  - **SMART HOME** — Nest, Ring (Phase 8)
  Phase 2 renders the section structure with representative mock cards for each tier.
- **D-10:** Status-tier card face: service icon + service name + status dot. **No timestamp at rest.** A stale-data indicator (last-poll time) appears only when last poll was >5 minutes ago. Implemented as a conditional dim overlay or small timestamp badge.
- **D-11:** Card border traces: **staggered continuous loop** — all cards trace on infinite loop with per-card phase offset (e.g., 0s, 0.3s, 0.6s stagger) so traces feel independent. No event trigger required.

### Typography

- **D-12:** **Monospace throughout** — all text uses a monospace font (system monospace stack or a single loaded mono font like JetBrains Mono / IBM Plex Mono). Reinforces the Tron/terminal aesthetic. Values, labels, names, section headers — all mono.

### Now Playing Banner

- **D-13:** Fixed **bottom strip** — `position: fixed; bottom: 0` — sits at the bottom of the viewport, above the browser's home indicator on iOS.
- **D-14:** **Hidden completely when no active Plex streams** (zero height, no placeholder). Fades in when a stream starts. Card grid gets the full viewport when idle.
- **D-15:** **Collapsed state:** stream count + scrolling ticker of first stream title. Example: `▶ 2 streams  Succession S4E3 • sambo...`
- **D-16:** **Tap to expand:** banner slides upward into a drawer showing all active streams. Each stream row shows: username/player, title + season/episode, playback progress bar, stream quality + transcode vs direct-play indicator.
- **D-17:** Tap again (or tap outside) to collapse back to the strip. Smooth slide animation.
- **D-18:** Phase 2 renders the banner with mock stream data (2 mock streams) to validate the expand/collapse interaction and 60fps scroll.

### Detail View Navigation

- **D-19:** **React Router** for client-side routing. URL pattern: `/services/:serviceId` (e.g., `/services/radarr`, `/services/plex`).
- **D-20:** Tapping a service card navigates to its detail page. Browser back returns to dashboard at the same scroll position (React Router's scroll restoration or manual scroll-position save).
- **D-21:** Phase 2 detail view content: service name, status dot, and labeled **mock metric slots** (e.g., "Last checked: —", "Response time: —", with mock values). Phase 3/4/5 replace mock slots with real components per service.
- **D-22:** The dashboard route is `/` (or `/dashboard`). Settings at `/settings` (stub in Phase 2). Logs at `/logs` (stub in Phase 2).

### SSE Data Pipeline

- **D-23:** SSE event type: `dashboard-update`. Payload is a **full snapshot** of all service states on every event. No delta/merge logic on the client — full replace.
- **D-24:** Snapshot shape (TypeScript type defined in `packages/shared/src/types.ts`):
  ```ts
  interface DashboardSnapshot {
    services: ServiceStatus[]
    nas: NasStatus
    streams: PlexStream[]
    timestamp: string // ISO 8601
  }
  interface ServiceStatus {
    id: string          // e.g. 'radarr'
    name: string
    tier: 'status' | 'activity' | 'rich'
    status: 'online' | 'offline' | 'warning' | 'stale'
    lastPollAt: string  // ISO 8601
    metrics?: Record<string, unknown> // populated by Phase 3+
  }
  interface NasStatus {
    cpu: number    // percent
    ram: number    // percent
    volumes: { name: string; usedPercent: number; tempC?: number }[]
  }
  interface PlexStream {
    user: string
    title: string
    year?: number
    season?: number
    episode?: number
    progressPercent: number
    quality: string       // e.g. '1080p'
    transcode: boolean    // true = transcoding, false = direct play
  }
  ```
- **D-25:** Backend mock data generator fires a `dashboard-update` SSE event every **5 seconds** in Phase 2. Mock data varies slightly per tick (e.g., CPU jitter) to prove live updates are reaching the browser.
- **D-26:** SSE endpoint: `GET /api/sse` — standard EventSource URL. Frontend uses the native `EventSource` API (no library). Fastify handles the SSE connection lifecycle.

### Claude's Discretion

- Exact CSS animation keyframe curves and timing values (easing, duration, opacity range)
- Icon set choice for service icons (lucide-react, heroicons, or custom SVGs)
- Exact monospace font — system stack first, fallback to a loaded font if system mono looks poor
- Mock data values and variation logic for the 5-second tick
- Color values for section label headers (dim blue or Tron Blue with lower opacity)
- Whether to use Framer Motion for card entrance animations and banner slide, or pure CSS transitions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §DASH-01 through DASH-08 — all eight dashboard requirements this phase must satisfy

### Project Context
- `.planning/PROJECT.md` §Requirements (Dashboard — Core) — vision-level description of the Tron/Grid aesthetic
- `.planning/PROJECT.md` §Key Decisions — stack locked (Node.js 22, Fastify, React, Vite, SSE, Drizzle, monospace)
- `.planning/PROJECT.md` §Constraints — must run on ARM NAS, mobile-first, local-only

### Prior Phase Context
- `.planning/phases/01-infrastructure-foundation/01-CONTEXT.md` — decisions D-23 (Fastify serves static), D-16 (service URLs/keys NOT in .env), SSE chosen over WebSocket

### Technology Stack Reference
- `CLAUDE.md` §Technology Stack — full stack table including Framer Motion 11.x, CSS animation variant guidance
- `CLAUDE.md` §Stack Patterns by Variant — CSS-only animation pattern (chosen), and when to upgrade to Three.js

### Existing Code
- `packages/frontend/src/App.tsx` — current placeholder (Tron Blue color + monospace already applied)
- `packages/backend/src/index.ts` — Fastify server structure, static serving pattern
- `packages/shared/src/types.ts` — empty, Phase 2 populates this with `DashboardSnapshot` and related types

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `App.tsx`: Already sets `background: '#0a0a0f'` (correct near-black), `color: '#00c8ff'` (Tron Blue), `fontFamily: 'monospace'` — consistent with D-12
- `packages/backend/src/index.ts`: Fastify static serving pattern already established — SSE endpoint will be added alongside `/health`
- `packages/shared/src/types.ts`: Empty export ready for `DashboardSnapshot` types

### Established Patterns
- Fastify route registration via plugin (`await fastify.register(...)`) — SSE route follows same pattern
- SQLite accessed via `getDb()` from `db.ts` — mock data generator can optionally log SSE ticks to DB
- No component library installed — Phase 2 introduces one or builds from scratch

### Integration Points
- Phase 2 adds React Router (new dependency) — routing must work with Fastify's SPA catch-all already in place
- Phase 3 replaces mock `ServiceStatus[]` with real adapter data — type contract in `shared/types.ts` must be stable
- Phase 4 wires the NAS header strip to real Synology DSM API — header component must accept `NasStatus | null` prop
- Phase 7 links the Logs icon in the top bar to the real log viewer page

</code_context>

<specifics>
## Specific Ideas and References

- **Tautulli** is the reference for the Now Playing banner expanded view — user is familiar with that layout (stream rows with user, title, progress, quality/transcode)
- **Animation intensity setting** — user wants a runtime toggle for grid pulse speed/intensity. Phase 2 creates the setting key in the Settings stub; Phase 3 persists it in SQLite config
- **NAS in header, not a card** — this is a deliberate departure from the requirements language ("NAS card" in REQUIREMENTS.md). The NAS global status is always-visible in the header strip; the clickable NAS detail card (for per-disk/fan drill-down) will still exist in the grid as part of Phase 4

</specifics>

<deferred>
## Deferred Ideas

- **Drag-to-reorder cards** — mentioned as a v2 feature in REQUIREMENTS.md (DASH-V2-02). Not Phase 2.
- **WebGL/Three.js grid upgrade** — CSS-only chosen for Phase 2. If CSS looks flat, upgrade in a later polish phase.
- **Mobile PWA / home screen install** — v2 feature (DASH-V2-03). Not Phase 2.
- **Sparkline trend charts on cards** — v2 feature (DASH-V2-01). Cards are metric-slot placeholders in Phase 2.

</deferred>

---

*Phase: 02-core-ui-shell*
*Context gathered: 2026-04-02*
