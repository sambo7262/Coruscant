# Phase 22: NAS Process Monitor - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Tap the NAS CPU metric when elevated to open a dropdown panel showing top processes by CPU usage. Each process has a human-readable label from a static lookup table (e.g., ffmpeg → "Plex transcoding") and a usage bar. Process data fetched on demand from DSM API — no continuous polling, no external API calls, no LLM dependency.

</domain>

<decisions>
## Implementation Decisions

### Architecture (NAS-01, NAS-02)
- **D-01:** No AI/LLM dependency. Process names are translated via a static `Record<string, string>` lookup table mapping known DSM process names to plain-English descriptions. Unknown processes fall back to the raw process name.
- **D-02:** Process data fetched on demand when the panel opens — not continuously polled. Backend endpoint returns top processes sorted by CPU %. Frontend calls this endpoint only when user taps the CPU metric.
- **D-03:** DSM API `SYNO.Core.System.Process` (or equivalent utilization endpoint) provides the process list. Reuse the existing DSM session/auth from the NAS adapter.

### Static Label Table (NAS-01)
- **D-04:** Label table covers known Synology processes:
  - `ffmpeg` → "Plex transcoding"
  - `Plex Media` → "Plex media server"
  - `smbd` → "Network file sharing (SMB)"
  - `synoindexd` → "File indexing"
  - `synoscgi` → "DSM web interface"
  - `dockerd` → "Docker engine"
  - `containerd` → "Docker container runtime"
  - `nginx` → "Web server / reverse proxy"
  - `postgres` → "Database (PostgreSQL)"
  - `node` → "Node.js application"
  - `python` → "Python script"
  - `rsync` → "File sync / backup"
  - `sshd` → "SSH connection"
  - `synophotod` → "Synology Photos indexing"
  - `synoconfd` → "Synology system config"
  - Table is extensible — add entries as new processes are observed.

### UI Panel (NAS-01)
- **D-05:** Full-width dropdown panel — same pattern as WeatherForecastPanel and DockerUpdatePanel. Opens below the NAS CPU area on the dashboard.
- **D-06:** Each process row shows: human-readable label (or raw name), CPU %, and a horizontal usage bar. Top 5 processes by CPU %.
- **D-07:** Panel header shows total CPU load (e.g., "NAS LOAD — CPU 73%").
- **D-08:** Framer Motion AnimatePresence slide-down animation — consistent with other panels.

### Tap Affordance (NAS-01)
- **D-09:** CPU metric on the NAS tile shows a visual tap affordance when CPU is elevated (threshold TBD by Claude — something reasonable like >30%). When CPU is normal, no affordance — metric looks like a regular display value.

### Claude's Discretion
- **D-10:** CPU threshold for showing tap affordance (suggested ~30%)
- **D-11:** Usage bar styling (solid fill, gradient, segmented) within cockpit aesthetic
- **D-12:** Whether to show process runtime/memory alongside CPU %
- **D-13:** Stale/loading states for the on-demand fetch
- **D-14:** Responsive layout for iPhone portrait/landscape

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### NAS adapter (DSM API integration)
- `packages/backend/src/adapters/nas.ts` — Existing DSM auth, session management, `SYNO.Core.System.Utilization` calls; extend with process list endpoint
- `packages/shared/src/types.ts` — `NasStatus` interface at line 47; may need new process type

### UI pattern analogs (tap-to-expand dropdown)
- `packages/frontend/src/components/layout/WeatherForecastPanel.tsx` — Most recent panel implementation; copy structure
- `packages/frontend/src/components/layout/DockerUpdatePanel.tsx` — Original panel pattern
- `packages/frontend/src/components/layout/AppHeader.tsx` — Panel state management, mutual exclusion pattern

### NAS tile (tap target)
- `packages/frontend/src/components/cards/ServiceCard.tsx` — NAS tile rendering, where CPU metric is displayed
- `packages/frontend/src/components/cards/CardGrid.tsx` — Grid layout containing NAS tile

### Viewport responsiveness
- `packages/frontend/src/styles/viewport-iphone.css` — iPhone overrides
- `packages/frontend/src/styles/globals.css` — Panel CSS patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **WeatherForecastPanel / DockerUpdatePanel** — Full-width dropdown with Framer Motion, tap-to-toggle, backdrop dismiss. Direct structural analog.
- **NAS adapter DSM session** — Auth flow, `makeUrl()` helper, session management already handles `SYNO.Core.System.*` APIs.
- **AppHeader panel state** — `panelOpen`, `forecastOpen` pattern for mutual exclusion. New `processMonitorOpen` state follows same pattern.

### Established Patterns
- **On-demand fetch** — Unlike polls, this is a one-shot REST call triggered by user tap. Pattern exists in Docker image update checks.
- **Tap affordance** — Pi health severity styling changes the title bar color. Similar visual cue needed for CPU metric.

### Integration Points
- NAS tile CPU metric → tap handler to open panel
- New backend endpoint (`/api/nas/processes` or similar) → fetches from DSM, applies label lookup, returns sorted list
- AppHeader or NAS tile area → panel rendering with AnimatePresence

</code_context>

<specifics>
## Specific Ideas

- User explicitly rejected AI/LLM approach in favor of static label lookup — no external dependencies
- User wants to see what's driving NAS CPU at a glance — same use case as DSM Resource Monitor but surfaced on the dashboard
- Labels should be plain English, not raw process names — the whole point is human readability
- Unknown processes show raw name as fallback — table doesn't need to be exhaustive

</specifics>

<deferred>
## Deferred Ideas

- Docker container-level CPU breakdown (mapping PID → container name via `docker top`)
- Process kill/restart from dashboard (explicitly out of scope per REQUIREMENTS.md)
- Historical process CPU trends (would need metrics_history extension)

</deferred>

---

*Phase: 22-nas-process-monitor*
*Context gathered: 2026-05-03*
