---
phase: 07-notifications-pushover-inbox
plan: 02
subsystem: ui
tags: [react, sse, animation, css-keyframes, settings, webhook]

# Dependency graph
requires:
  - phase: 07-01
    provides: SSE arr-event emission, ArrWebhookEvent shared type, backend webhook routes for all 7 arr services
provides:
  - SSE arr-event consumption in frontend (useDashboardSSE hook extended with lastArrEvent)
  - arrFlash CSS keyframe animation for 10-second colored label flash
  - AppHeader ticker overlay (SERVICE > EVENT > TITLE) covering center+right columns
  - MediaStackRow flash glow on webhook events (amber/purple/red/green per event type)
  - Settings NOTIFICATIONS tab with copy-able webhook URLs for all 7 arr services
affects: [phase-08, phase-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lastArrEvent prop chain: App.tsx -> DashboardPage -> CardGrid -> MediaStackRow (no context, explicit prop threading)"
    - "useRef for flash/ticker timers — prevents stale closure cleanup from clearing active timers on unrelated re-renders"
    - "Ticker overlay uses CSS grid column spanning (gridColumn: '2 / 4') to cover center+right without affecting left column"
    - "EVENT_COLORS map defined at module level, shared between AppHeader and ServiceCard for consistency"

key-files:
  created: []
  modified:
    - packages/frontend/src/hooks/useDashboardSSE.ts
    - packages/frontend/src/globals.css
    - packages/frontend/src/App.tsx
    - packages/frontend/src/components/layout/AppHeader.tsx
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/pages/DashboardPage.tsx
    - packages/frontend/src/components/cards/CardGrid.tsx
    - packages/frontend/src/pages/SettingsPage.tsx

key-decisions:
  - "useRef for flash/ticker timers — prevents cleanup from clearing timer on unrelated re-renders (post-approval fix c4a97a1)"
  - "Ticker overlay uses gridColumn '2 / 4' span — CORUSCANT title in column 1 always remains visible per D-12"
  - "Webhook URLs in Settings use configured base URL or placeholder http://<coruscant-ip>:1688 — NOT window.location per D-18"
  - "SABnzbd excluded from flash — receives burst poll signal instead; only arr services (radarr/sonarr/lidarr/bazarr/prowlarr/readarr) flash"

patterns-established:
  - "Flash/ticker state is ephemeral — lives only in React state; page refresh clears all (D-02 requirement honored)"
  - "Timer refs pattern: useRef<ReturnType<typeof setTimeout>>(null) + clearTimeout in useEffect cleanup"

requirements-completed: [NOTIF-01, CFG-02]

# Metrics
duration: ~45min
completed: 2026-04-05
---

# Phase 07 Plan 02: Frontend Arr Event Signaling Summary

**SSE arr-event hook, 10-second card flash + AppHeader ticker overlay, and Settings NOTIFICATIONS tab with copy-able webhook URLs wired end-to-end from backend to UI**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-05
- **Completed:** 2026-04-05
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify — APPROVED)
- **Files modified:** 8

## Accomplishments

- Extended `useDashboardSSE` to listen for `arr-event` SSE messages and expose `lastArrEvent` state
- Wired `lastArrEvent` prop chain through App.tsx -> DashboardPage -> CardGrid -> MediaStackRow
- AppHeader ticker overlay shows `SERVICE > EVENT > TITLE` in amber for 10 seconds covering center+right columns; CORUSCANT title always visible in left column
- MediaStackRow label box flashes with event-typed glow border (amber=grab, purple=import, red=health, green=update) for 10 seconds using `@keyframes arrFlash`
- Settings NOTIFICATIONS tab lists all 7 arr services with copy-able webhook URLs (base URL from config or placeholder per D-18)
- Post-approval fix: timer refs replaced useState timers to prevent cleanup race on unrelated re-renders

## Task Commits

Each task was committed atomically:

1. **Task 1: SSE hook + CSS keyframe + AppHeader ticker + MediaStackRow flash** - `61a73fd` (feat)
2. **Task 2: Settings Notifications tab with webhook URLs and copy buttons** - `424c3b7` (feat)
3. **Task 3: Visual verification checkpoint** - APPROVED by user (UAT passed)
4. **Post-approval fix: use ref for flash/ticker timers** - `c4a97a1` (fix)

**Plan metadata:** (committed with this summary)

## Files Created/Modified

- `packages/frontend/src/hooks/useDashboardSSE.ts` - Added `arr-event` SSE listener, `lastArrEvent` state, updated return value
- `packages/frontend/src/globals.css` - Added `@keyframes arrFlash` (0-80% opacity 1, 100% opacity 0)
- `packages/frontend/src/App.tsx` - Destructures and threads `lastArrEvent` to AppHeader and DashboardPage
- `packages/frontend/src/components/layout/AppHeader.tsx` - Ticker overlay with `buildTickerText`, `EVENT_COLORS`, `aria-live="polite"`, border color shift on active event
- `packages/frontend/src/components/cards/ServiceCard.tsx` - MediaStackRow flash glow with `flashColor` state, `EVENT_COLORS`, arrFlash animation; SABnzbd excluded from flash
- `packages/frontend/src/pages/DashboardPage.tsx` - Accepts and passes `lastArrEvent` prop to CardGrid
- `packages/frontend/src/components/cards/CardGrid.tsx` - Accepts and passes `lastArrEvent` prop to MediaStackRow instances
- `packages/frontend/src/pages/SettingsPage.tsx` - NOTIFICATIONS tab with 7 arr service webhook rows, COPY URL / COPIED toggle, `navigator.clipboard.writeText`, `aria-label` on each button

## Decisions Made

- **Timer refs instead of state** — flash and ticker timers stored in `useRef` rather than as state variables. Prevents stale closure cleanup from clearing a newly-set timer when an unrelated prop change triggers a re-render and runs the previous effect's cleanup. Committed as post-approval fix `c4a97a1`.
- **Ticker column span** — `gridColumn: '2 / 4'` covers AppHeader center and right columns. Left column (CORUSCANT title) is unaffected, satisfying D-12.
- **Webhook URL source** — URLs in NOTIFICATIONS tab derive from the stored base URL config key, falling back to `http://<coruscant-ip>:1688` placeholder. `window.location` explicitly avoided per D-18 because the browsing device address differs from the NAS LAN address.
- **SABnzbd excluded from flash** — SABnzbd responds to grab events via burst poll interval change (implemented in Plan 01). Flash is reserved for arr services only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Timer cleanup race on flash/ticker state**
- **Found during:** Post-approval UAT observation
- **Issue:** Using `useState` for timer IDs meant that when an unrelated re-render triggered useEffect cleanup, the cleanup function called `clearTimeout` on a stale captured value, potentially clearing a newly-active timer for a different event
- **Fix:** Replaced `useState<number | null>` timer IDs with `useRef<ReturnType<typeof setTimeout>>(null)` in both AppHeader ticker and ServiceCard flash effects
- **Files modified:** `packages/frontend/src/components/layout/AppHeader.tsx`, `packages/frontend/src/components/cards/ServiceCard.tsx`
- **Verification:** Flash and ticker persist for full 10 seconds even when other SSE dashboard-update events arrive during the window
- **Committed in:** `c4a97a1`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix. No scope creep.

## Issues Encountered

None beyond the timer ref fix documented above.

## User Setup Required

None — webhook URLs are now visible in Settings > NOTIFICATIONS tab. User pastes the displayed URL into each arr app's Connections settings. No new environment variables required.

## Next Phase Readiness

- Phase 07 is now fully complete (both plans executed and verified)
- Phase 08 (Logging, Polish + Performance) can begin — run `/gsd:discuss-phase 8` before planning per ROADMAP note
- All 7 arr webhook endpoints operational at `/api/webhooks/{service}`
- SABnzbd burst poll (1s on grab, 10s on import/queue-empty) implemented in Plan 01 and verified

---
*Phase: 07-notifications-pushover-inbox*
*Completed: 2026-04-05*
