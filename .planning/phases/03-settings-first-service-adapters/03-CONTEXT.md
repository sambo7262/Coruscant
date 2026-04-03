# Phase 3: Settings + First Service Adapters — Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Settings UI that persists service configurations (base URL + API key) to SQLite, and wire up live polling adapters for Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, Readarr (status cards) and SABnzbd (activity card) so the dashboard shows real data instead of mock data.

Phase ends when:
- User can enter and save credentials for each service via the Settings page
- Dashboard cards for all seven arr services + SABnzbd show live data from real API polls
- Settings and credentials survive a container restart
- "Test Connection" validates credentials immediately on demand

No notification thresholds, no Pi-hole/Plex/NAS/UniFi integrations — those are Phase 4+.

**UI note:** The arr services (Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, Readarr) will eventually be collapsed into a grouped section in the dashboard UI. That UI grouping is deferred to a future phase — Phase 3 adds all six to config/settings and wires their adapters. The dashboard currently shows individual cards for each.

</domain>

<decisions>
## Implementation Decisions

### Settings Page Layout

- **D-01:** Settings page uses a **tabbed layout** — a horizontal tab bar listing each service by name (RADARR, SONARR, LIDARR, BAZARR, PROWLARR, READARR, SABNZBD). Clicking a tab shows that service's config panel.
- **D-02:** Tab bar overflows horizontally with horizontal scroll when tabs don't fit the viewport. No wrapping to two rows, no dropdown fallback.
- **D-03:** Each tab shows a **status LED** (same cockpit LED design as dashboard cards) reflecting the current live state of that service: green = configured + online, red = configured + offline/unreachable, amber = configured + user action required (arr health warnings), grey = not yet configured.
- **D-04:** Each service tab panel contains: URL field, API key field (password-masked), show/hide eye icon toggle for the API key, TEST button, inline result line, and a SAVE button.
- **D-05:** **Save is per-tab** — each service's SAVE button saves only that service's config. Changes to Radarr don't affect Sonarr.
- **D-06:** After save, the backend's next poll cycle picks up the new credentials and pushes real data over SSE — no page refresh or restart required.
- **D-07:** The LED intensity slider from the Phase 2 stub is **removed**. The existing LED animations are finalized as-is.

### API Key Field

- **D-08:** API key inputs use `type="password"` so the value is masked on screen.
- **D-09:** An eye icon toggle (`👁`) next to the key field switches between `type="password"` and `type="text"` so the user can verify what they've entered.
- **D-10:** API keys are stored **encrypted in SQLite** using AES-256-GCM (Node.js `node:crypto` built-in — no external library). The encryption key seed lives in the `.env` file (D-17 from Phase 1 context).

### Test Connection

- **D-11:** The TEST button makes an immediate live request to the service's `/api/v3/health` (for arr services) or equivalent endpoint (SABnzbd queue check).
- **D-12:** During the in-flight request: TEST button is disabled and shows a `TESTING…` label (or brief spinner).
- **D-13:** Result appears **inline** directly below the TEST button, replacing any prior result. Format:
  - Success: `● CONNECTED  v3 · N warnings` (green LED dot)
  - Failure: `● FAILED: [error message]` (red LED dot, e.g., "timeout", "401 Unauthorized", "ECONNREFUSED")
- **D-14:** The inline result clears (disappears) when the user edits either field — forces a re-test after any change.

### Color Semantics (locked for all Phase 3 service cards)

These apply to both the Settings tab LEDs and the dashboard service cards:

- **Green** (`#4ADE80`) — service up and healthy; no action needed
- **Red** (`#FF3B3B`) — service down, offline, unreachable, timeout, or any connection failure (including 401/403 bad credentials); requires investigation
- **Amber** (`#E8A020`) — service is reachable but user action is required (e.g., arr `/api/v3/health` returned health warnings such as missing root folder, indexer errors, queue failures that need manual resolution)
- **Purple** (`#9B59B6` or equivalent) — active downloading (SABnzbd only, when queue has active downloads)
- **Grey** (`#666666`) — service not configured yet; no credentials saved

**Key constraint:** Amber is strictly for "user must do something" — never for connection failures or lack of activity.

### Unconfigured Card State

- **D-15:** A service card with no credentials saved renders as a normal instrument panel card (correct shape, service name, header bar) but with a **static grey LED** and the instrument body shows a dim `NOT CONFIGURED` label.
- **D-16:** Tapping/clicking a "NOT CONFIGURED" card on the dashboard **deep-links to Settings** with that service's tab pre-selected (e.g., `/settings?service=radarr`).

### SSE Data Pipeline Transition

- **D-17:** The mock snapshot generator (`generateMockSnapshot`) is **retired** in Phase 3. The SSE route switches to real poll data.
- **D-18:** For unconfigured services (no credentials), the `ServiceStatus` entry in the SSE snapshot uses `status: 'stale'` with an additional `configured: false` flag (or equivalent — exact shape is Claude's discretion). No mock data bleeds through.
- **D-19:** For configured services that fail to respond (any network error, timeout, 4xx/5xx), the card immediately shows **red/offline** on the next SSE push. No amber intermediate state for connection failures.
- **D-20:** Poll intervals: arr services (Radarr/Sonarr/Lidarr/Bazarr) poll every 30–60 seconds (SVCST-05). SABnzbd polls every 5–15 seconds (SVCACT-03). Exact values within those ranges are Claude's discretion.

### Claude's Discretion

- Exact Drizzle schema shape for service configurations (one row per service vs. key-value table — one row per service is natural)
- Encryption IV/tag storage approach within SQLite (AES-256-GCM requires storing IV + tag alongside ciphertext)
- Exact poll interval values within the spec ranges (30–60s for arr, 5–15s for SABnzbd)
- Shared base adapter pattern for the four arr services (they share the same `/api/v3/health` endpoint structure)
- Exact `ServiceStatus.metrics` shape for SABnzbd (speed, queue count, active item progress)
- Whether metrics shape gets typed in `packages/shared` or stays `Record<string, unknown>` for Phase 3
- Backend API route(s) for saving service config and triggering test connection
- React Router URL strategy for deep-linking Settings to a specific service tab (`/settings?service=radarr` or `/settings/radarr`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §CFG-01, CFG-03, CFG-04 — settings persistence requirements
- `.planning/REQUIREMENTS.md` §SVCST-01 through SVCST-05 — arr service status requirements
- `.planning/REQUIREMENTS.md` §SVCACT-01 through SVCACT-03 — SABnzbd activity requirements

### Prior Phase Context
- `.planning/phases/01-infrastructure-foundation/01-CONTEXT.md` — D-16, D-17 (service credentials in SQLite, encryption key in .env), D-18 (data path)
- `.planning/phases/02-core-ui-shell/02-CONTEXT.md` — full cockpit aesthetic decisions, color palette, LED design, card design, ArrInstrument and SabnzbdInstrument components

### Project Context
- `.planning/PROJECT.md` §Constraints — Docker/NAS, no cloud telemetry
- `.planning/STATE.md` §Decisions — stack decisions, SSE architecture, Phase 2 component names

No external API specs — arr `/api/v3/health` and SABnzbd queue API are well-documented; researcher should verify current endpoint formats.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/db.ts` — `createDb()`, `getDb()`, `initDb()` ready; migrations infrastructure wired; Phase 3 adds new tables to `schema.ts`
- `packages/backend/src/routes/sse.ts` — existing SSE route to refactor; replace `generateMockSnapshot()` with real poll aggregator
- `packages/frontend/src/pages/SettingsPage.tsx` — stub placeholder, ready for full implementation
- `packages/frontend/src/components/` — LED indicator components, card shapes, and instrument bodies from Phase 2 can be reused in the Settings tab LEDs
- `packages/shared/src/types.ts` — `ServiceStatus` has `metrics?: Record<string, unknown>` ready; `DashboardSnapshot` shape unchanged

### Established Patterns
- Cockpit aesthetic: amber `#E8A020` chrome, near-black `#0D0D0D` panels, chamfered card corners, JetBrains Mono throughout
- LED states defined in Phase 2 context (D-12): green/amber/red/grey with their animation timings
- SSE is unidirectional server-push; backend sends `DashboardSnapshot` on interval; frontend consumes via `useDashboardSSE` hook in `App.tsx`
- Framer Motion for animations; React Router for navigation

### Integration Points
- `packages/backend/src/schema.ts` — add `serviceConfig` table (url, encryptedApiKey, iv, tag, serviceName)
- `packages/backend/src/index.ts` — register new API routes (settings CRUD, test-connection)
- `packages/backend/src/routes/sse.ts` — swap mock generator for real poll aggregator
- `packages/frontend/src/App.tsx` — add route for `/settings` (and optional deep-link param)

</code_context>

<specifics>
## Specific Ideas

- Settings tab bar: instrument panel aesthetic — tabs styled as physical selector switches or panel labels, not browser-default tabs
- TEST button result line uses the same LED dot style as the dashboard card status indicators (10px circle + glow in status colour)
- API key eye-toggle should match the overall monospace/utilitarian input style — not a Material UI button
- "NOT CONFIGURED" label on grey cards should be dim and lowercase-leaning: `NOT CONFIGURED` in off-white at reduced opacity, centered in the instrument body area

</specifics>

<deferred>
## Deferred Ideas

### Arr UI Grouping
All six arr services (Radarr, Sonarr, Lidarr, Bazarr, Prowlarr, Readarr) will eventually be collapsed into a grouped/sectioned display in the dashboard rather than six separate cards. Deferred to a future UI phase — Phase 3 just adds them all to config and wires their adapters as individual cards.

</deferred>

---

*Phase: 03-settings-first-service-adapters*
*Context gathered: 2026-04-03*
