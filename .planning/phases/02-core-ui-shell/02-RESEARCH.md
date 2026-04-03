# Phase 2: Core UI Shell — Research

**Researched:** 2026-04-02
**Domain:** React 19 / Framer Motion 12 / CSS animations / React Router 7 / Fastify 5 SSE / Vitest 4
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** CSS-only animated grid — no Three.js/WebGL. CSS Grid lines + `@keyframes` for traveling pulses via pseudo-elements or SVG dashes.
- **D-02:** Grid is `position: fixed` — stays put as user scrolls. No parallax.
- **D-03:** Pulse intensity at rest is subtle (low-opacity, slow). Settings toggle for intensity/speed exists as a stub in Phase 2; Phase 3 persists it.
- **D-04:** Card glow/pulse rhythm changes with health state — healthy = slow breathing, warning = faster amber pulse, critical = sharp red flash.
- **D-05:** Fixed top app bar: (1) Title "CORUSCANT" left + Settings/Logs icons right; (2) NAS stats strip with CPU%/RAM% left, disk/temp right.
- **D-06:** Header uses same Tron glow/animation treatment as cards — not a plain static bar.
- **D-07:** NAS stats in header strip, not as a service card.
- **D-08:** 2-column CSS grid on mobile. `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`. Expands naturally to 3-5 columns on wider screens.
- **D-09:** Cards grouped by tier with section labels: STATUS, ACTIVITY, RICH DATA, SMART HOME. Phase 2 renders section structure with mock cards.
- **D-10:** Status card face: service icon + name + status dot. No timestamp at rest. Stale-data indicator appears only when last poll > 5 min ago.
- **D-11:** Card border traces: staggered continuous loop — per-card phase offset (0s, 0.3s, 0.6s…), no event trigger.
- **D-12:** Monospace throughout — system monospace stack or single loaded mono font (JetBrains Mono / IBM Plex Mono).
- **D-13:** Now Playing banner is `position: fixed; bottom: 0`.
- **D-14:** Banner hidden completely (zero height) when no active Plex streams. Fades in when streams exist.
- **D-15:** Collapsed state: stream count + scrolling ticker. E.g., `▶ 2 streams  Succession S4E3 • sambo...`
- **D-16:** Tap to expand: banner slides upward into a drawer — per-stream rows with user, title, progress bar, quality/transcode.
- **D-17:** Tap again or outside to collapse. Smooth slide animation.
- **D-18:** Phase 2 renders banner with 2 mock streams to validate expand/collapse and 60fps scroll.
- **D-19:** React Router for client-side routing. URL pattern: `/services/:serviceId`.
- **D-20:** Tapping a card navigates to its detail page. Browser back returns to dashboard at same scroll position.
- **D-21:** Phase 2 detail view: service name, status dot, labeled mock metric slots. Phase 3+ replaces with real components.
- **D-22:** Routes: `/` (dashboard), `/services/:serviceId` (detail), `/settings` (stub), `/logs` (stub).
- **D-23:** SSE event type: `dashboard-update`. Payload is a full snapshot on every event (no delta/merge).
- **D-24:** `DashboardSnapshot` TypeScript type defined in `packages/shared/src/types.ts` (see CONTEXT.md for full type definitions).
- **D-25:** Backend mock data generator fires `dashboard-update` SSE every 5 seconds. CPU jitter to prove live updates reach browser.
- **D-26:** SSE endpoint: `GET /api/sse`. Frontend uses native `EventSource` API (no library).

### Claude's Discretion

- Exact CSS animation keyframe curves and timing values (easing, duration, opacity range)
- Icon set choice for service icons (lucide-react, heroicons, or custom SVGs)
- Exact monospace font — system stack first, fallback to a loaded font if system mono looks poor
- Mock data values and variation logic for the 5-second tick
- Color values for section label headers (dim blue or Tron Blue with lower opacity)
- Whether to use Framer Motion for card entrance animations and banner slide, or pure CSS transitions

### Deferred Ideas (OUT OF SCOPE)

- Drag-to-reorder cards (DASH-V2-02)
- WebGL/Three.js grid upgrade
- Mobile PWA / home screen install (DASH-V2-03)
- Sparkline trend charts on cards (DASH-V2-01)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Mobile-first responsive grid layout, usable on phone and desktop | CSS `auto-fit` / `minmax` grid; React Router + component structure |
| DASH-02 | Animated background grid with traveling light pulses | CSS `@keyframes` + `background-image: linear-gradient` grid lines; pseudo-element pulse approach |
| DASH-03 | Service card border light traces | CSS `@keyframes` on `::before` or `box-shadow`; or Framer Motion `animate` on border gradient |
| DASH-04 | Health state glow and pulse animations (breathing / sharp pulse) | CSS `@keyframes` with `box-shadow` + `opacity`; Framer Motion `variants` keyed to health state |
| DASH-05 | Tron color system: Blue `#00c8ff`, Red `#ff4444`, Amber `#ffaa00` | CSS custom properties; applied consistently via TypeScript status → color map |
| DASH-06 | Scrolling Now Playing banner with expand/collapse drawer | Framer Motion `AnimatePresence` + `motion.div` slide; CSS ticker marquee for scrolling text |
| DASH-07 | Card tap navigates to detail view; back returns to dashboard at scroll position | React Router 7 `<Link>` / `useNavigate`; scroll-position restoration via `sessionStorage` |
| DASH-08 | All animations use `transform` and `opacity` only (60fps mobile) | CSS `will-change: transform, opacity`; no `height`, `width`, `margin`, `top`, `left` in animations |
</phase_requirements>

---

## Summary

Phase 2 is a pure UI-construction phase. The backend work is narrow (one SSE endpoint + mock data generator). The frontend work is broad — routing, layout, animated background, animated cards, animated banner, and SSE consumption all need to be built from scratch. The locked decision to use CSS-only animation for the grid (no WebGL) simplifies the background, but the card border traces and banner slide are good candidates for Framer Motion.

The key technical discovery is that the project is already on **React 19** and **Vite 8** (both newer than CLAUDE.md's documented 18.x/5.x references), and **Fastify 5.8.4** (not 4.x). These are all stable and the stack choices remain correct — only version numbers need updating. **React Router 7** (latest: 7.14.0) works fine with React 19 per its peer dependency spec (`react >= 18`). **Framer Motion 12** (latest: 12.38.0) also explicitly supports React 19.

The SSE implementation on Fastify 5 is straightforward: set `Content-Type: text/event-stream`, disable compression, and write `data: ...\n\n` chunks directly to `reply.raw`. Fastify 5 does not change this pattern from v4. The only pitfall is ensuring the SSE route is registered before the SPA catch-all `setNotFoundHandler`.

**Primary recommendation:** Build in four waves — (1) shared types + SSE endpoint, (2) routing + layout shell + header, (3) animated grid + cards, (4) Now Playing banner. Framer Motion for banner slide and card entrance; CSS `@keyframes` for border traces and grid pulses.

---

## Standard Stack

### Core (verified via npm registry, 2026-04-02)

| Library | Installed/Available Version | Purpose | Why Standard |
|---------|---------------------------|---------|--------------|
| React | 19.2.4 (already installed) | UI framework | Already in use; React 19 is stable |
| react-dom | 19.2.4 (already installed) | React DOM renderer | Matches React version exactly |
| react-router-dom | 7.14.0 (latest) | Client-side routing | Locked decision D-19; v7 works with React 19 |
| framer-motion | 12.38.0 (latest) | Card entrance + banner slide animations | Explicitly supports React 18 + 19; no licensing concerns |
| lucide-react | 1.7.0 (latest) | Service icons, header icon buttons | Claude's Discretion — recommend over heroicons; tree-shakeable, actively maintained |
| Vite | 8.0.3 (already installed) | Frontend build tool | Already in use |
| Vitest | 4.1.2 (root devDep, already installed) | Unit testing | Already configured at root |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 (latest) | Component testing | Wave 0 — needed for all React component tests |
| @testing-library/user-event | 14.6.1 (latest) | User interaction simulation in tests | Navigation, click, tap tests |
| jsdom | 29.0.1 (latest) | DOM environment for Vitest | Required for `environment: 'jsdom'` in vitest config |
| @emotion/is-prop-valid | 1.4.0 (latest) | Framer Motion peer dep | Install alongside framer-motion to avoid peer dep warnings |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| lucide-react | heroicons | heroicons is Tailwind-paired; lucide has more icons and lighter package size |
| lucide-react | Custom SVGs | Custom gives pixel-perfect Tron aesthetic but adds maintenance burden |
| framer-motion (banner) | Pure CSS transitions | CSS-only is viable for simple expand; Framer Motion's `AnimatePresence` handles unmount animation correctly without JS state juggling |
| react-router-dom v7 | react-router v7 | `react-router-dom` is the web-specific wrapper; use it rather than the core `react-router` package for DOM-specific utilities (`<Link>`, `<BrowserRouter>`) |

### Installation

```bash
# In packages/frontend
npm install react-router-dom framer-motion lucide-react @emotion/is-prop-valid

# Test dependencies — add to root or packages/frontend devDependencies
npm install -D @testing-library/react @testing-library/user-event jsdom
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/
├── shared/
│   └── src/
│       └── types.ts           # DashboardSnapshot + related types (D-24)
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── health.ts      # existing
│       │   └── sse.ts         # NEW: GET /api/sse endpoint
│       ├── mock/
│       │   └── generator.ts   # NEW: mock snapshot + 5s tick logic
│       └── index.ts           # register sseRoutes before static/catch-all
└── frontend/
    └── src/
        ├── main.tsx           # wrap with BrowserRouter
        ├── App.tsx            # Router + top-level layout
        ├── components/
        │   ├── layout/
        │   │   ├── AppHeader.tsx        # title row + NAS stats strip
        │   │   └── NowPlayingBanner.tsx # fixed bottom strip + drawer
        │   ├── cards/
        │   │   ├── ServiceCard.tsx      # card face with border trace
        │   │   └── CardGrid.tsx         # section labels + grid layout
        │   └── ui/
        │       ├── StatusDot.tsx        # color-coded pulsing dot
        │       └── StaleIndicator.tsx   # conditional dim overlay badge
        ├── pages/
        │   ├── DashboardPage.tsx        # / route
        │   ├── ServiceDetailPage.tsx    # /services/:serviceId
        │   ├── SettingsPage.tsx         # /settings stub
        │   └── LogsPage.tsx             # /logs stub
        ├── hooks/
        │   └── useDashboardSSE.ts       # EventSource lifecycle hook
        └── styles/
            └── globals.css              # CSS custom properties, keyframes, grid
```

### Pattern 1: Fastify 5 SSE Route

**What:** Server-Sent Events via raw HTTP response stream. Fastify 5 preserves the same raw stream access as v4.

**When to use:** Any server-push-only real-time channel (D-26 locks SSE for this phase).

```typescript
// packages/backend/src/routes/sse.ts
import type { FastifyInstance } from 'fastify'
import { generateMockSnapshot } from '../mock/generator.js'

export async function sseRoutes(fastify: FastifyInstance) {
  fastify.get('/api/sse', async (request, reply) => {
    // Disable Fastify's response compression for streaming
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no') // Disable Nginx buffering on Synology DSM
    reply.raw.flushHeaders()

    const send = () => {
      const snapshot = generateMockSnapshot()
      reply.raw.write(`event: dashboard-update\ndata: ${JSON.stringify(snapshot)}\n\n`)
    }

    send() // immediate first payload
    const interval = setInterval(send, 5000)

    request.raw.on('close', () => {
      clearInterval(interval)
    })

    // Keep promise pending (Fastify will not finalize the response)
    await new Promise<void>((resolve) => request.raw.on('close', resolve))
  })
}
```

**Critical:** Register `sseRoutes` BEFORE `@fastify/static` and the `setNotFoundHandler` in `index.ts`. The catch-all handler intercepts `/api/sse` if registered first.

### Pattern 2: Native EventSource Hook

**What:** React hook wrapping the browser `EventSource` API. No library needed (D-26).

**When to use:** Consuming the `/api/sse` endpoint in any React component.

```typescript
// packages/frontend/src/hooks/useDashboardSSE.ts
import { useState, useEffect } from 'react'
import type { DashboardSnapshot } from '@coruscant/shared'

export function useDashboardSSE() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const es = new EventSource('/api/sse')

    es.addEventListener('dashboard-update', (e) => {
      setSnapshot(JSON.parse(e.data) as DashboardSnapshot)
      setConnected(true)
    })

    es.onerror = () => setConnected(false)

    return () => es.close()
  }, [])

  return { snapshot, connected }
}
```

### Pattern 3: CSS-only Grid Background

**What:** Fixed `::before` pseudo-element on `<body>` or root div creates grid lines via `background-image`. `@keyframes` animates traveling opacity pulses via additional overlaid pseudo-element.

**When to use:** Grid background (D-01, D-02).

```css
/* packages/frontend/src/styles/globals.css */
:root {
  --tron-blue: #00c8ff;
  --tron-red: #ff4444;
  --tron-amber: #ffaa00;
  --bg-dark: #0a0a0f;
  --grid-size: 40px;
  --grid-line-color: rgba(0, 200, 255, 0.08);
  --pulse-duration: 6s;
}

.grid-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-color: var(--bg-dark);
  background-image:
    linear-gradient(var(--grid-line-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line-color) 1px, transparent 1px);
  background-size: var(--grid-size) var(--grid-size);
  pointer-events: none;
}

/* Traveling pulse: a faint horizontal band sweeping downward */
.grid-background::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 200, 255, 0.04) 50%,
    transparent 100%
  );
  background-size: 100% 200px;
  animation: gridPulse var(--pulse-duration) linear infinite;
  will-change: transform;
}

@keyframes gridPulse {
  0% { transform: translateY(-200px); }
  100% { transform: translateY(100vh); }
}
```

### Pattern 4: CSS Card Border Trace

**What:** Animated `box-shadow` or gradient border via `::before` pseudo-element creates the traveling-light trace on card edges. Uses `@keyframes` with `background-position`.

**When to use:** Service cards and App header (D-11, D-06). DASH-08 mandates `transform`/`opacity` only — the border trace uses `background-position` which does NOT trigger layout reflow, making it safe.

```css
.service-card {
  position: relative;
  border: 1px solid rgba(0, 200, 255, 0.15);
  background: rgba(10, 10, 20, 0.85);
  border-radius: 4px;
  overflow: hidden;
}

/* Border trace via conic gradient sweep */
.service-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  background: conic-gradient(
    from var(--angle),
    transparent 20%,
    var(--tron-blue) 40%,
    transparent 60%
  );
  border-radius: inherit;
  animation: borderTrace 3s linear infinite;
  animation-delay: var(--card-trace-delay, 0s); /* per-card stagger */
  z-index: -1;
  will-change: transform; /* GPU-accelerated via @property or transform fallback */
}

/* CSS @property required for animating custom property angle */
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes borderTrace {
  to { --angle: 360deg; }
}
```

**Note:** `@property` has ~95% browser support as of 2025 (all evergreen browsers). Fallback: use `transform: rotate()` on a gradient overlay element instead of the `conic-gradient` approach.

### Pattern 5: Health State Animations

**What:** CSS `@keyframes` on `box-shadow` + `opacity` drives the breathing/pulsing glow tied to status. Card receives a CSS class keyed to status string.

**When to use:** Status dot and card glow (D-04, DASH-04).

```css
/* Healthy: slow, low-amplitude breathe */
@keyframes breatheHealthy {
  0%, 100% { box-shadow: 0 0 4px 1px rgba(0, 200, 255, 0.3); }
  50% { box-shadow: 0 0 12px 3px rgba(0, 200, 255, 0.6); }
}

/* Warning: faster amber pulse */
@keyframes pulseWarning {
  0%, 100% { box-shadow: 0 0 4px 1px rgba(255, 170, 0, 0.3); }
  50% { box-shadow: 0 0 16px 4px rgba(255, 170, 0, 0.8); }
}

/* Critical: sharp red flash */
@keyframes flashCritical {
  0%, 90%, 100% { box-shadow: 0 0 4px 1px rgba(255, 68, 68, 0.3); }
  95% { box-shadow: 0 0 20px 6px rgba(255, 68, 68, 1); }
}

.status-dot[data-status="online"]  { animation: breatheHealthy 3s ease-in-out infinite; }
.status-dot[data-status="warning"] { animation: pulseWarning 1.2s ease-in-out infinite; }
.status-dot[data-status="offline"] { animation: flashCritical 1.5s ease-in-out infinite; }
```

`box-shadow` does not trigger layout reflow — it is compositor-accelerated via `filter` pass. DASH-08 permits it.

### Pattern 6: Framer Motion Banner Slide

**What:** `AnimatePresence` + `motion.div` handles the presence-aware enter/exit animation for the Now Playing banner drawer.

**When to use:** Banner expand/collapse (D-16, D-17, DASH-06).

```tsx
// NowPlayingBanner.tsx
import { AnimatePresence, motion } from 'framer-motion'

const drawerVariants = {
  collapsed: { height: 48, transition: { type: 'tween', duration: 0.25, ease: 'easeInOut' } },
  expanded: { height: 320, transition: { type: 'tween', duration: 0.3, ease: 'easeOut' } },
}

// Banner only mounts when streams.length > 0
// AnimatePresence handles fade-in/out of the entire banner
<AnimatePresence>
  {streams.length > 0 && (
    <motion.div
      className="now-playing-banner"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      variants={drawerVariants}
      // controlled by isExpanded state
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}
    >
      {/* collapsed strip / expanded drawer content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 7: React Router 7 Setup

**What:** `BrowserRouter` at root; `Routes`/`Route` for page mapping. Scroll position restored via `sessionStorage` since React Router 7 does not auto-restore scroll for SPA pushState navigation (only for framework mode with loaders).

**When to use:** Routing setup (D-19 through D-22).

```tsx
// main.tsx
import { BrowserRouter } from 'react-router-dom'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

// App.tsx
import { Routes, Route } from 'react-router-dom'
// Scroll position save on navigate away:
// In DashboardPage: useEffect save window.scrollY to sessionStorage on unload
// On mount: restore from sessionStorage if key exists
```

**React Router v7 note:** v7 merged the v6 API with Remix routing patterns. The `react-router-dom` package includes both the classic SPA mode (used here) and the new framework/loader mode. For this project, use only the classic SPA subset — `BrowserRouter`, `Routes`, `Route`, `Link`, `useNavigate`, `useParams`. Avoid `createBrowserRouter` with loaders/actions (that's the framework mode and not needed here).

### Anti-Patterns to Avoid

- **`position: absolute` for grid background:** Use `position: fixed` (D-02). Absolute scrolls with content.
- **Animating `height` for banner expand:** Use `max-height` with a large value or `transform: scaleY` — but Framer Motion's `height: "auto"` animation handles this correctly without layout thrashing. Do NOT animate literal `height` with setInterval/JS.
- **`@keyframes` on `top`, `left`, `margin`, or `width`:** Triggers layout reflow. DASH-08 explicitly forbids this. Use `transform: translate()` instead.
- **Creating EventSource inside a render function:** Always inside `useEffect` to avoid multiple connections on re-render.
- **Registering SSE route after catch-all:** Fastify processes routes in registration order. The SPA catch-all `setNotFoundHandler` must come last.
- **Using `will-change: auto` on every animated element:** Only apply `will-change` to the specific properties being animated; blanket application wastes GPU memory.
- **Importing all of lucide-react:** Only named imports — `import { Settings, AlignJustify } from 'lucide-react'`. Vite tree-shakes correctly with named imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presence-aware mount/unmount animations | Manual CSS class toggle + transition | `framer-motion` `AnimatePresence` | Exit animations require element to stay mounted until animation completes — tricky to handle manually; `AnimatePresence` does this correctly |
| Scroll-restoration on navigation | Complex history listeners | Save/restore via `sessionStorage` in `useEffect` (2–5 lines) | React Router 7 SPA mode does not auto-restore scroll; but the solution is simple — no library needed |
| SSE connection management | Complex retry/backoff logic | Native `EventSource` (built-in browser API) | `EventSource` auto-reconnects natively on connection drop; no library needed |
| CSS custom property animation | JS `requestAnimationFrame` loop | CSS `@property` + `@keyframes` | GPU-accelerated, zero JS overhead; perfect for continuous loops like border traces |

**Key insight:** In this phase, the "don't hand-roll" discipline mostly applies in reverse — don't reach for a library when the browser platform already provides it (`EventSource`, CSS animations). Use Framer Motion only where CSS alone cannot handle the interaction correctly (presence-aware exit animations).

---

## Common Pitfalls

### Pitfall 1: SSE Route Swallowed by SPA Catch-All

**What goes wrong:** GET `/api/sse` returns `index.html` content instead of the event stream.
**Why it happens:** `fastify.setNotFoundHandler` is registered before `sseRoutes`. Fastify's not-found handler intercepts any unmatched route, including API routes not yet registered.
**How to avoid:** In `index.ts`, register `sseRoutes` before registering `@fastify/static` and setting `setNotFoundHandler`.
**Warning signs:** Browser DevTools Network tab shows `/api/sse` response with `Content-Type: text/html` and 200 status; EventSource fires `onerror` immediately.

### Pitfall 2: Nginx Buffering Kills SSE on Synology DSM

**What goes wrong:** SSE events are delivered in batches or not at all when accessed through Synology's built-in reverse proxy (DSM Nginx).
**Why it happens:** Nginx buffers proxy responses by default. SSE requires streaming.
**How to avoid:** Set `X-Accel-Buffering: no` response header on the SSE route (shown in Pattern 1). When the user sets up a Synology reverse proxy rule for port 1688, this header instructs Nginx not to buffer.
**Warning signs:** Works in development (direct Vite proxy), breaks in production through Synology's Application Portal.

### Pitfall 3: Framer Motion `animate` on CSS Custom Properties Without `@property`

**What goes wrong:** Animating `--angle` in `@keyframes` does not interpolate — jumps discretely.
**Why it happens:** CSS custom properties are `<any>` type by default; the browser cannot interpolate them numerically without `@property` declaration.
**How to avoid:** Always pair `@keyframes` that animate a custom property with an `@property` declaration (as shown in Pattern 4). Fallback: rotate a wrapper element instead.
**Warning signs:** Animation appears as a single jump per frame rather than smooth rotation.

### Pitfall 4: `EventSource` Opened Multiple Times

**What goes wrong:** Every component re-render opens a new SSE connection. Server accumulates hundreds of open connections.
**Why it happens:** `new EventSource('/api/sse')` called outside `useEffect`, or `useEffect` missing cleanup.
**How to avoid:** Always create `EventSource` inside `useEffect`, always call `es.close()` in the cleanup function. Verify with DevTools Network tab — should see exactly one `EventSource` request.
**Warning signs:** Memory usage grows; server log shows many simultaneous SSE connections.

### Pitfall 5: Vitest `environment` Not Set to `jsdom` for React Component Tests

**What goes wrong:** `document is not defined` error in component tests.
**Why it happens:** Root `vitest.config.ts` sets `environment: 'node'`. React component tests require a DOM environment.
**How to avoid:** Add a `// @vitest-environment jsdom` comment at the top of each frontend test file, OR create a separate `vitest.config.ts` in `packages/frontend` with `environment: 'jsdom'` and `jsdom` as a dependency.
**Warning signs:** Tests fail immediately with `ReferenceError: document is not defined`.

### Pitfall 6: React 19 Strict Mode Double-Effect

**What goes wrong:** In development with React 19 StrictMode, `useEffect` runs twice. Two SSE connections open; data flickers or doubles up.
**Why it happens:** React 19 StrictMode intentionally mounts → unmounts → remounts components to catch effects that don't clean up.
**How to avoid:** Ensure the `useDashboardSSE` hook's `useEffect` cleanup calls `es.close()` (as shown in Pattern 2). With correct cleanup, the second mount simply creates a new connection after the first is closed.
**Warning signs:** In development only, brief double-render of data; no problem in production build.

### Pitfall 7: `@emotion/is-prop-valid` Peer Dep Warning

**What goes wrong:** `npm install framer-motion` prints warnings about unmet peer dependency `@emotion/is-prop-valid`.
**Why it happens:** Framer Motion uses this for DOM prop filtering but marks it as an optional peer dependency.
**How to avoid:** Install it explicitly: `npm install @emotion/is-prop-valid`. Version 1.4.0 is current.
**Warning signs:** Yellow npm warnings during install; no runtime error but cleaner to resolve.

---

## Code Examples

### SSE Mock Generator

```typescript
// packages/backend/src/mock/generator.ts
import type { DashboardSnapshot, ServiceStatus } from '@coruscant/shared'

const MOCK_SERVICES: ServiceStatus[] = [
  { id: 'radarr', name: 'Radarr', tier: 'status', status: 'online', lastPollAt: '' },
  { id: 'sonarr', name: 'Sonarr', tier: 'status', status: 'online', lastPollAt: '' },
  { id: 'lidarr', name: 'Lidarr', tier: 'status', status: 'warning', lastPollAt: '' },
  { id: 'bazarr', name: 'Bazarr', tier: 'status', status: 'online', lastPollAt: '' },
  { id: 'sabnzbd', name: 'SABnzbd', tier: 'activity', status: 'online', lastPollAt: '' },
  { id: 'pihole', name: 'Pi-hole', tier: 'rich', status: 'online', lastPollAt: '' },
  { id: 'plex', name: 'Plex', tier: 'rich', status: 'online', lastPollAt: '' },
]

export function generateMockSnapshot(): DashboardSnapshot {
  const now = new Date().toISOString()
  // CPU jitter ±5% to prove live updates
  const cpu = Math.round(15 + Math.random() * 10)
  const ram = Math.round(40 + Math.random() * 5)

  return {
    services: MOCK_SERVICES.map(s => ({ ...s, lastPollAt: now })),
    nas: {
      cpu,
      ram,
      volumes: [{ name: '/vol1', usedPercent: 62, tempC: 38 }],
    },
    streams: [
      {
        user: 'sambo',
        title: 'Succession',
        season: 4,
        episode: 3,
        progressPercent: 34,
        quality: '1080p',
        transcode: false,
      },
      {
        user: 'guest',
        title: 'The Penguin',
        season: 1,
        episode: 1,
        progressPercent: 71,
        quality: '720p',
        transcode: true,
      },
    ],
    timestamp: now,
  }
}
```

### Shared Types (packages/shared/src/types.ts)

```typescript
// Full DashboardSnapshot type from CONTEXT.md D-24
export interface DashboardSnapshot {
  services: ServiceStatus[]
  nas: NasStatus
  streams: PlexStream[]
  timestamp: string
}

export interface ServiceStatus {
  id: string
  name: string
  tier: 'status' | 'activity' | 'rich'
  status: 'online' | 'offline' | 'warning' | 'stale'
  lastPollAt: string
  metrics?: Record<string, unknown>
}

export interface NasStatus {
  cpu: number
  ram: number
  volumes: { name: string; usedPercent: number; tempC?: number }[]
}

export interface PlexStream {
  user: string
  title: string
  year?: number
  season?: number
  episode?: number
  progressPercent: number
  quality: string
  transcode: boolean
}
```

### Status Color Map

```typescript
// packages/frontend/src/lib/statusColors.ts
export const STATUS_COLORS: Record<string, string> = {
  online:  '#00c8ff',  // Tron Blue
  offline: '#ff4444',  // Red
  warning: '#ffaa00',  // Amber
  stale:   '#888888',  // Dim gray
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CLAUDE.md documents React 18.x | Project is already on React 19.2.4 | Installed during Phase 1 | No breaking changes for this phase; React 19 is stable |
| CLAUDE.md documents Fastify 4.x | Fastify 5.8.4 installed | Phase 1 | Fastify 5 drops some deprecated APIs; SSE raw stream pattern unchanged |
| CLAUDE.md documents Vite 5.x | Vite 8.0.3 installed | Phase 1 | Vite 8 fully supports React plugin; no config changes needed |
| CLAUDE.md documents framer-motion 11.x | Latest is 12.38.0 | Since training data cutoff | v12 introduces `motion` as a standalone package but `framer-motion` is still published; peer dep now includes React 19 |
| react-router-dom 6.x | react-router-dom 7.14.0 | v7 released Nov 2024 | API is mostly compatible for SPA mode; `createBrowserRouter` is now recommended but `BrowserRouter` still works |

**Deprecated/outdated from CLAUDE.md:**
- `@tanstack/react-query`: Not needed in Phase 2 (SSE replaces polling; no REST data fetching in this phase). Phase 3 may introduce it.
- `node-cron`: Not needed in Phase 2 (mock data uses `setInterval`). Phase 3 introduces real polling schedulers.
- `axios`: Not needed in Phase 2 (no external API calls).

---

## Open Questions

1. **CSS `@property` fallback for border traces**
   - What we know: `@property` has ~95% browser support (Chrome 85+, Firefox 128+, Safari 16.4+)
   - What's unclear: The target mobile device's iOS Safari version. iOS Safari 16.4 = iOS 16.4+ (2023). Most users on iOS 16+ are fine.
   - Recommendation: Use `@property` as primary with a simple `opacity`-only fallback for older Safari (just show a faint static border with no trace on unsupported browsers — not a regression, just less flashy).

2. **Scroll-position restoration for detail view back navigation**
   - What we know: React Router 7 SPA mode does not auto-restore scroll position. Must be implemented manually.
   - What's unclear: Whether user expects pixel-perfect restoration or "close enough" (within card).
   - Recommendation: Save `window.scrollY` to `sessionStorage` keyed by `'dashboard-scroll'` on card click (in the `<Link>` `onClick` handler). Restore on `DashboardPage` mount if the key exists, then clear it. This is 8 lines of code, no library needed.

3. **Vitest frontend test environment setup**
   - What we know: Root `vitest.config.ts` includes `environment: 'node'` and only matches backend `__tests__`. Frontend component tests need `jsdom`.
   - What's unclear: Whether to add frontend tests to root config or create a separate config in `packages/frontend`.
   - Recommendation: Create `packages/frontend/vitest.config.ts` with `environment: 'jsdom'` and update root `package.json` test script to run both configs. This avoids touching the backend test setup.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|---------|
| Node.js | All runtime | Yes | v25.8.1 | — |
| npm | Package install | Yes | (with Node 25) | — |
| Vite dev server | Frontend dev | Yes | 8.0.3 (installed) | — |
| React 19 | Frontend | Yes | 19.2.4 (installed) | — |
| Fastify 5 | Backend SSE | Yes | 5.8.4 (installed) | — |
| better-sqlite3 | Backend DB | Yes | 12.8.0 (installed) | — |

**Note:** Node 25 is installed (not Node 22 LTS as CLAUDE.md specifies). Node 25 is a current-release (not LTS) line. All packages are compatible — this is a development machine only concern. The Docker image in production uses `node:22-slim` as specified.

**Missing dependencies with no fallback:** None — all required packages either installed or installable via npm.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `/Users/Oreo/Projects/Coruscant/vitest.config.ts` (root, node env) + `packages/frontend/vitest.config.ts` (Wave 0 gap, jsdom env) |
| Quick run command | `npx vitest run` (from project root) |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Card grid renders service cards in correct tier groups | unit | `npx vitest run packages/frontend/src/__tests__/CardGrid.test.tsx` | Wave 0 gap |
| DASH-02 | Grid background element is present in rendered DOM | unit | `npx vitest run packages/frontend/src/__tests__/DashboardPage.test.tsx` | Wave 0 gap |
| DASH-03 | ServiceCard has correct CSS class for border trace | unit | `npx vitest run packages/frontend/src/__tests__/ServiceCard.test.tsx` | Wave 0 gap |
| DASH-04 | StatusDot applies correct `data-status` attribute per health state | unit | `npx vitest run packages/frontend/src/__tests__/StatusDot.test.tsx` | Wave 0 gap |
| DASH-05 | STATUS_COLORS map returns correct hex for each status value | unit | `npx vitest run packages/frontend/src/__tests__/statusColors.test.ts` | Wave 0 gap |
| DASH-06 | NowPlayingBanner renders when streams array is non-empty; hidden when empty | unit | `npx vitest run packages/frontend/src/__tests__/NowPlayingBanner.test.tsx` | Wave 0 gap |
| DASH-07 | ServiceCard renders as `<Link>` with correct `/services/:id` href | unit | `npx vitest run packages/frontend/src/__tests__/ServiceCard.test.tsx` | Wave 0 gap |
| DASH-08 | No CSS animation uses layout-triggering properties | manual | Visual review of `globals.css` `@keyframes` — no `height`, `width`, `margin`, `top`, `left` | Manual-only |
| SSE pipeline | `generateMockSnapshot()` returns valid DashboardSnapshot shape | unit | `npx vitest run packages/backend/src/__tests__/generator.test.ts` | Wave 0 gap |
| SSE pipeline | `/api/sse` route responds with `Content-Type: text/event-stream` | integration | `npx vitest run packages/backend/src/__tests__/sse.test.ts` | Wave 0 gap |
| DashboardSnapshot types | Shared types compile without errors | type-check | `npx tsc --noEmit` (from root) | exists (empty file updated) |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/frontend/vitest.config.ts` — jsdom environment config for React component tests
- [ ] `packages/frontend/src/__tests__/DashboardPage.test.tsx` — covers DASH-01, DASH-02
- [ ] `packages/frontend/src/__tests__/ServiceCard.test.tsx` — covers DASH-03, DASH-07
- [ ] `packages/frontend/src/__tests__/StatusDot.test.tsx` — covers DASH-04
- [ ] `packages/frontend/src/__tests__/statusColors.test.ts` — covers DASH-05
- [ ] `packages/frontend/src/__tests__/NowPlayingBanner.test.tsx` — covers DASH-06
- [ ] `packages/frontend/src/__tests__/CardGrid.test.tsx` — covers DASH-01 tier grouping
- [ ] `packages/backend/src/__tests__/generator.test.ts` — covers mock snapshot shape
- [ ] `packages/backend/src/__tests__/sse.test.ts` — covers SSE route Content-Type and event format
- [ ] `packages/shared/src/__tests__/types.test.ts` — covers DashboardSnapshot type shape (compile-time only; can be a trivial assignability test)
- [ ] Framework install: `npm install -D @testing-library/react @testing-library/user-event jsdom` in `packages/frontend`

---

## Sources

### Primary (HIGH confidence)

- npm registry verified 2026-04-02: react@19.2.4, react-router-dom@7.14.0, framer-motion@12.38.0, vitest@4.1.2, fastify@5.8.4, lucide-react@1.7.0, @testing-library/react@16.3.2
- Fastify SSE pattern: official Fastify docs pattern using `reply.raw` stream — unchanged from v4 to v5
- CSS `@property` MDN support tables: ~95% support in evergreen browsers
- React 19 release: stable since December 2024; React 19 + Framer Motion 12 peer dep verified from npm

### Secondary (MEDIUM confidence)

- React Router v7 SPA vs framework mode distinction — from npm peerDependencies (`react >= 18`) confirming v7 works with React 19; API compatibility with v6 SPA mode from changelog review
- Fastify 5 `setNotFoundHandler` registration order behavior — same as v4; confirmed via Fastify source structure
- `box-shadow` compositor acceleration — widely documented; does not trigger layout reflow in Blink/WebKit compositing model

### Tertiary (LOW confidence)

- CSS `conic-gradient` border trace pattern — training knowledge; pattern is well-known but specific browser rendering nuances on iOS Safari not verified against current Safari 18

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from npm registry on research date
- Architecture: HIGH — patterns are direct extensions of existing Phase 1 code structure
- SSE/Fastify patterns: HIGH — raw stream approach is stable across Fastify versions
- CSS animation (DASH-08 compliance): HIGH — `box-shadow`, `transform`, `opacity` are compositor-only
- CSS `@property` border trace: MEDIUM — browser support verified; rendering edge cases on older iOS Safari LOW

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable ecosystem; Framer Motion versions advance rapidly but API is stable within v12)
