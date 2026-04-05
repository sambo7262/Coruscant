# Phase 5: UI v2 — Instrument Panel Polish - Research

**Researched:** 2026-04-04
**Domain:** React/TypeScript frontend refinement + backend adapter extensions (Synology DSM, SABnzbd, Plex/Tautulli)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** — Complete dashboard (AppHeader + CardGrid + NowPlayingBanner rail) must fit within 800×480 landscape without any vertical or horizontal scrolling.
**D-02** — Available vertical space breakdown: header height + card grid + bottom rail = 480px total. Phase 5 must audit and enforce this budget.
**D-03** — SABnzbd tile must be narrow — shows at most one active download, fixed compact height, no scrolling.
**D-04** — SABnzbd instrument body shows: active filename (truncated), download speed, ETA. Replace current speed + progress bar + queue count layout.
**D-05** — SABnzbd LED color is inverted currently. Fix: LED = solid purple when actively downloading; card text/labels = amber always. Text does not go purple.
**D-06** — Backend must expose `filename` and `eta` fields in SABnzbd metrics. Add `currentFilename` and `timeLeft` (or `etaSeconds`) to `SabnzbdMetrics` type. ETA as formatted string acceptable.
**D-07** — SABnzbd card is narrow — sized for one download, no scrolling.
**D-08** — SABnzbd detail view: active job at top (filename, speed, ETA, progress bar), then full queue list below.
**D-09** — All arr services render in a single tile with two columns of three rows: left = Radarr/Sonarr/Lidarr; right = Prowlarr/Bazarr/Readarr.
**D-10** — Each arr row: LED + service name only. No secondary data (warning count, queue count, etc.).
**D-11** — LED logic for arr: Green = up/healthy; Red = down/unreachable; Amber = up but health warnings; Solid purple = actively downloading; Flashing purple = queued (in arr queue, not yet active in SABnzbd).
**D-12** — Arr tile has amber header bar (same chamfer card pattern). Remove "MEDIA STACK" section label from the grid.
**D-13** — SABnzbd is a separate narrow tile, not part of the 3×3 arr tile.
**D-14** — Arr detail view: status + version dot-leader rows, then scrollable warning list from `/api/v3/health` (source + message per warning).
**D-15** — Pi-hole card renamed to NETWORK. Header bar reads "NETWORK".
**D-16** — NETWORK card body: PI-HOLE section (blocking, QPM, load, mem%) + 1px amber divider + UBIQUITI section (static "NOT CONFIGURED", dim grey, no animation).
**D-17** — Pi-hole detail view: donut chart with static legend table (color swatch + type label + count). No tooltip-based legend.
**D-18** — Kill NAS expand/collapse mechanic entirely. NAS header always-visible with all data inline.
**D-19** — Header always-visible sections: stats strip → disk temp bars (SSD group, HDD group, °F) → Docker stats → image update LED. All inline, no drawer.
**D-20** — Image update LED is broken — investigate and fix. User confirms stale image exists but LED not triggering.
**D-21** — Temperatures displayed in °F throughout (convert from °C returned by DSM).
**D-22** — Docker stats likely not implemented correctly in Phase 4 — executor must verify SYNO.Docker implementation and fix if needed.
**D-23** — Plex data source: Tautulli webhooks primary, direct Plex poll as fallback. Tautulli triggers: Playback Start, Stop, Pause, Resume. Plex server stats source (CPU/MEM/bandwidth) to be confirmed.
**D-24** — Collapsed Plex rail: left = "PLEX" label, center = cycling stream titles (~4s), right = Plex server stats (CPU%, RAM%, bandwidth Mbps).
**D-25** — Each stream row includes media type badge: AUDIO or VIDEO.
**D-26** — Audio stream fix: must show Track title + Album name (not SxEx TV episode format).
**D-27** — Audio quality fix: must display real quality string from Tautulli payload (FLAC, MP3 320, AAC, etc.), not "unknown".
**D-28** — Expanded rail: full stream rows (user, title, quality, direct/transcode, progress bar) + Plex server stats panel on right.
**D-29** — "PLEX" label must be visible on rail in collapsed state — currently invisible.

### Claude's Discretion

- Exact disk temp bar height, label truncation strategy for long disk names
- Whether Docker stats section in header uses vertical or horizontal layout
- Rotation interval for multi-stream cycling in collapsed Plex rail
- Exact SabnzbdMetrics type fields for filename and ETA (add to shared types or keep in metrics record)
- Whether image update check result is cached in DB or in-memory
- SYNO.Docker.Image API endpoint and response shape for update detection

### Deferred Ideas (OUT OF SCOPE)

None captured this session — all discussion stayed within Phase 5 scope or Phase 6+ work (Ubiquiti integration in Phase 6).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Main dashboard displays all monitored service cards in a mobile-first responsive grid layout | CardGrid restructure — single arr tile + separate SABnzbd tile, viewport budget enforcement |
| DASH-02 | Animated grid background with traveling light pulses | No changes required in Phase 5; already implemented in Phase 2 |
| DASH-03 | Service card borders animate with light traces | Existing chamfer card pattern carries forward; no changes required |
| DASH-04 | Health state components glow and pulse | LED breathing/flashing animations in StatusDot carry forward; arr LED logic fixed to match D-11 |
| DASH-05 | Color system applied consistently (green/red/amber/purple/grey) | LED color bugs identified and mapped: SABnzbd text inversion fix (D-05), arr always-purple fix (D-11) |
| DASH-06 | Scrolling "Now Playing" banner shows active Plex streams | NowPlayingBanner rework: PLEX label (D-29), cycling titles (D-24), audio type badge (D-25/26/27) |
| DASH-07 | Tapping a service card navigates to detail view | Arr detail view (D-14), SABnzbd detail view (D-08); existing navigate() pattern unchanged |
| DASH-08 | All animations use transform and opacity only — 60fps on mobile | Research confirms existing Framer Motion + CSS keyframe pattern satisfies this; no layout-triggering properties to introduce |
</phase_requirements>

---

## Summary

Phase 5 is a polish pass over a working implementation. All backend adapters and frontend card components exist — the work is correcting specific bugs, extending a few data fields, restructuring two components (AppHeader and NowPlayingBanner), and enforcing the 800×480 no-scroll constraint across the full dashboard.

The key backend changes are: (1) adding `currentFilename` and `timeLeft` to the SABnzbd queue response mapping (both fields already exist in the SABnzbd API response via `slots[].filename` and `queue.timeleft`), (2) investigating why `checkNasImageUpdates` returns false despite a stale image existing (likely a SYNO.Docker.Image API version or response shape mismatch), and (3) confirming whether the Docker stats section (`nas.docker`) is being populated at all by `pollNas` (the adapter currently does NOT query SYNO.Docker stats — that section was never wired up).

The key frontend changes are: (1) restructuring CardGrid to render arr services as a proper chamfered tile with two columns inside it, (2) reworking AppHeader to eliminate the expand/collapse drawer and render all NAS data inline in a taller header, (3) reworking NowPlayingBanner collapsed row to show PLEX label + cycling titles + server stats, and (4) extending PlexStream type to carry `mediaType` and audio-specific fields (track, album).

**Primary recommendation:** Work in data-first order: fix backend types and adapters first, then fix frontend components that consume them. The 800×480 viewport budget is the final gate — measure actual pixel heights after all component changes are complete.

---

## Standard Stack

### Core (no changes from project baseline)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI components | Established Phase 2 |
| TypeScript | 5.4+ | Type safety | Established Phase 1 |
| Framer Motion | 11.x | Card animations, AnimatePresence | Established Phase 2 |
| Recharts | 2.x | Pi-hole donut chart | Installed Phase 4 |
| Vite | 5.x | Frontend build | Established Phase 1 |
| Vitest | latest | Testing | Established Phase 1 |

### No New Dependencies Required
Phase 5 uses only existing libraries. No new `npm install` steps are needed. All changes are to existing TypeScript/React source files and shared types.

---

## Architecture Patterns

### Recommended Project Structure (unchanged)
```
packages/
├── shared/src/types.ts          — extend SabnzbdMetrics, PlexStream, NasDisk (SSD/HDD type)
├── backend/src/adapters/
│   ├── sabnzbd.ts               — add filename + timeLeft to response mapping
│   ├── nas.ts                   — add SYNO.Docker stats call; fix image update detection
│   └── plex.ts                  — add mediaType, album, track fields to stream mapping
├── frontend/src/components/
│   ├── cards/
│   │   ├── ServiceCard.tsx      — fix SabnzbdInstrument LED logic; fix ArrInstrument LED; add PiholeInstrument → NetworkInstrument
│   │   └── CardGrid.tsx         — restructure arr tile to chamfered card with 2-col 3-row grid; remove "MEDIA STACK" label
│   └── layout/
│       ├── AppHeader.tsx        — eliminate expand/collapse; render disk temp bars + Docker stats + image LED inline
│       ├── NowPlayingBanner.tsx — rework collapsed rail: PLEX label + cycling titles + server stats
│       └── StreamRow.tsx        — add mediaType badge; fix audio title format; fix quality display
```

### Pattern 1: Viewport Budget Enforcement

**What:** Every rendered pixel counts toward the 800×480 budget. The complete layout is: AppHeader (fixed top) + main content area (CardGrid, scrollable middle) + NowPlayingBanner rail (fixed bottom). The no-scroll constraint means the CardGrid content must also fit without scrolling.

**Pixel budget breakdown (Claude's best estimate — must be measured):**
```
Header (AppHeader):
  - Stats strip row:           44px  (existing single-row)
  - Disk temp bars section:    ~40px (SSD group label + bars + HDD group label + bars)
  - Docker stats section:      ~24px (single row of values)
  - Image update LED row:      ~20px
  Total header:               ~128px

Bottom rail (NowPlayingBanner collapsed):
  - Collapsed strip:           40px  (changed from 48px per layout tightening)
  Total rail:                  ~40px

Available for CardGrid:
  480 - 128 - 40 = ~312px
```

This is tight. The planner must assign a dedicated measurement + enforcement task.

**When to use:** Apply this budget to every layout decision. Any component that adds height must justify it.

### Pattern 2: SABnzbd API — filename and ETA fields

**What:** The SABnzbd `/api?mode=queue&output=json` response already includes `filename` and `timeleft` per slot. These are not currently extracted in `pollSabnzbd`.

**SABnzbd queue slot structure (from SABnzbd API docs, HIGH confidence):**
```typescript
interface SabnzbdSlot {
  status: string       // 'Downloading' | 'Paused' | 'Failed' | 'Queued'
  percentage?: string  // '0'–'100'
  filename: string     // NZB filename (truncated display name)
  timeleft: string     // formatted string like '0:04:32'
  mb: string           // total size in MB
  mbleft: string       // remaining MB
}
```

**Required change:** Extract `slots[0].filename` and `slots[0].timeleft` from the queue response. Map to `SabnzbdMetrics.currentFilename` (already in the type — `SabnzbdInstrument` already reads it) and `SabnzbdMetrics.timeLeft` (also already in the type).

**Finding:** `SabnzbdMetrics` in `packages/shared/src/types.ts` currently only declares `speedMBs`, `queueCount`, `progressPercent`, `hasFailedItems`, `sabStatus`. It is MISSING `currentFilename` and `timeLeft`. However, `SabnzbdInstrument` in `ServiceCard.tsx` already reads `metrics.currentFilename` and `metrics.timeLeft` as `Record<string, unknown>` dynamic access — it works at runtime because TypeScript doesn't enforce the shape there, but the shared type is incomplete.

**Action required:** Add `currentFilename?: string` and `timeLeft?: string` to `SabnzbdMetrics` in `types.ts`. Then extract them from the SABnzbd API response in `sabnzbd.ts`.

### Pattern 3: NAS Header — Docker Stats Gap

**Critical finding:** `pollNas` in `nas.ts` currently makes THREE parallel requests:
1. `SYNO.Core.System.Utilization` — CPU, RAM, network
2. `SYNO.Core.System` (type=storage) — disks, volumes, CPU temp
3. `SYNO.Core.Hardware.FanSpeed` — fans

**Docker stats (`nas.docker`) are NEVER populated.** The `NasDockerStats` interface and `NasStatus.docker` field exist in types, but no DSM API call populates them. The Phase 4 Phase context note says "Docker stats likely were not implemented correctly" — this confirms they were never wired up.

**SYNO.Docker API for container stats:** The Synology Docker package exposes its API under `SYNO.Docker`. To get aggregate Docker daemon stats (CPU%, RAM%, network), the relevant endpoint is:

```
GET /webapi/entry.cgi?api=SYNO.Docker.Container&version=1&method=list&_sid={sid}
```

This returns a list of all containers with per-container CPU%, memory usage, and network I/O. Aggregate stats can be computed by summing across all running containers. However, Synology DSM may not expose a single "Docker daemon total" endpoint — the planner should note that this requires summing container-level stats.

**Confidence:** MEDIUM — the SYNO.Docker.Container API exists in DSM; exact field names for CPU/memory in the response are not verified against live data. The executor must inspect actual DSM response shapes.

### Pattern 4: Image Update Detection — Debugging

**Finding:** `checkNasImageUpdates` calls `SYNO.Docker.Image` with `version=1` and `method=list`. The code checks `img.is_update_available`. The existing test (`nas-adapter.test.ts`) confirms this logic works against a mocked response.

**Why it might be broken in production:**
1. **API version mismatch:** Newer DSM versions may have changed `SYNO.Docker.Image` API version from 1 to 2 or 3. The `is_update_available` field may not exist in all DSM versions. In some DSM versions, the field is `canUpgrade` or `upgrade_available`.
2. **Container Manager vs old Docker package:** DSM 7.2+ ships "Container Manager" which replaced the Docker package. The API namespace may have changed from `SYNO.Docker.Image` to `SYNO.ContainerManager.Image` or similar.
3. **Timer fire gap:** The image update check runs on a 12-hour timer with immediate first run. If the NAS restarts frequently or the check errors silently, `imageUpdateAvailable` stays `undefined` (falsy in the template).

**Debugging approach for executor:**
- Make a direct call to `SYNO.Docker.Image list` and log the raw response shape
- Also try `SYNO.ContainerManager.Image list` as alternative
- Check if `is_update_available` actually appears in the response for a known-stale image

**Confidence:** MEDIUM for diagnosis; LOW for the fix (depends on actual DSM version API shape).

### Pattern 5: PlexStream — Audio and Media Type Extensions

**Current state of `PlexStream`:**
```typescript
interface PlexStream {
  user, title, deviceName, year?, season?, episode?, progressPercent, quality, transcode
}
```

**Missing fields for Phase 5 (D-25, D-26, D-27):**
- `mediaType: 'audio' | 'video'` — derived from Plex `type` field (`'track'` = audio, all else = video)
- `albumName?: string` — for audio: `item.parentTitle` (album name)
- `trackTitle?: string` — for audio: `item.title` (track title)
- `quality` for audio: Plex `Media[0].audioCodec` + bitrate, or from Tautulli `audio_codec` field

**Plex API session fields for audio:**
```
type: 'track'
title: 'Song Title'           — track title
grandparentTitle: 'Artist'    — artist
parentTitle: 'Album Name'     — album
Media[0].audioCodec: 'flac'   — audio codec
Media[0].bitrate: 1411        — bitrate in Kbps
```

**Current `deriveTitle` function in `plex.ts`** uses `grandparentTitle + ' - ' + title` for tracks. For the collapsed rail this is fine, but `StreamRow` currently renders `season/episode` number from these fields — audio tracks will show `SxEx` format because `parentIndex` and `index` map to track number, not season/episode.

**Fix required in `plex.ts`:** When `item.type === 'track'`, set `mediaType: 'audio'`, populate `albumName: item.parentTitle`, `trackTitle: item.title`, clear `season`/`episode` to `undefined`. Quality for audio = codec + bitrate string.

### Pattern 6: Media Stack Tile — Two-Column Chamfered Card

**Current state in `CardGrid.tsx`:** The arr services render in a left panel with a plain `background: var(--bg-panel)`, `border: 1px solid var(--border-rest)`, and a `MEDIA STACK` label inside. This is NOT a chamfered `ServiceCard` — it's a raw `<div>`.

**Required change per D-09, D-12:**
- Remove the inner "MEDIA STACK" text label
- Add the `chamfer-card` class and the 6px amber header strip (matching other cards)
- Layout the six arr rows in a CSS grid: `grid-template-columns: 1fr 1fr`, `grid-template-rows: repeat(3, auto)`
- Left column order: Radarr (row 1), Sonarr (row 2), Lidarr (row 3)
- Right column order: Prowlarr (row 1), Bazarr (row 2), Readarr (row 3)

**CSS grid approach:**
```tsx
<div
  className="chamfer-card"
  style={{
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-rest)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }}
>
  {/* 6px amber header strip */}
  <div style={{ height: '6px', background: 'var(--cockpit-amber)', flexShrink: 0 }} />
  {/* Two-column grid of MediaStackRow */}
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '8px 4px', gap: '2px 0' }}>
    {leftColumn.map(...)}  {/* Radarr, Sonarr, Lidarr */}
    {rightColumn.map(...)} {/* Prowlarr, Bazarr, Readarr */}
  </div>
</div>
```

CSS Grid with two columns automatically places items left-to-right. To get L-col = Radarr/Sonarr/Lidarr and R-col = Prowlarr/Bazarr/Readarr, the simplest approach is two separate flexbox columns rather than a 2-col CSS grid (which would interleave them). The implementation should use two `flexDirection: 'column'` divs inside a flex row container.

### Pattern 7: NAS Header — Always-Visible Disk Temp Bars

**Current state:** Disk temps are inside `NasHeaderPanel` (the expand drawer). The expand/collapse mechanic is controlled by `expanded` state.

**Required change (D-18, D-19):**
1. Remove `expanded` state from `AppHeader` entirely
2. Remove `AnimatePresence` / `NasHeaderPanel` expand drawer components
3. Remove the click handler on the NAS gauge strip
4. Render inline (always visible) under the stats strip:
   - Disk temp bars section (SSD group first, HDD group second — needs disk type classification)
   - Docker stats section (if `nas.docker` populated)
   - Image update LED row

**Disk type classification (SSD vs HDD):** DSM `hdd_info` does not reliably include a disk type field in all versions. Options:
- Classify by disk name pattern (e.g., names containing "SSD" or "NVMe") — fragile
- Add a `diskType?: 'ssd' | 'hdd'` field to `NasDisk` and attempt to derive from DSM response
- Accept Claude's discretion: render all disks together without SSD/HDD grouping label if type not available from API

**Recommended approach (Claude's discretion):** Render all disks in a single group labeled "DISKS" without attempting SSD/HDD classification unless the DSM response clearly includes a type field. Verify during implementation.

### Pattern 8: NowPlayingBanner — Collapsed Rail Rework

**Current collapsed rail shows:** `▶ N streams` (left) + marquee ticker (right). "PLEX" never appears.

**Required (D-24, D-29):**
- Left: "PLEX" static label (replacing "N streams" text)
- Center: cycling title display — rotate through stream titles every ~4s using `useState` + `useEffect` with a `setInterval`
- Right: Plex server stats (CPU%, RAM%, Mbps) — currently shown only in expanded drawer

**Implementation for cycling titles:**
```typescript
const [activeIdx, setActiveIdx] = useState(0)
useEffect(() => {
  if (streams.length <= 1) return
  const id = setInterval(() => setActiveIdx(i => (i + 1) % streams.length), 4000)
  return () => clearInterval(id)
}, [streams.length])
```

Wrap the title display in a `<motion.div>` with `AnimatePresence` for a crossfade or slide transition between titles.

**Server stats in collapsed state:** `plexServerStats` is currently only rendered in the expanded drawer. Move the stats display to the collapsed strip (right side), always visible when `plexServerStats` is available.

### Anti-Patterns to Avoid

- **Temp units in °C on the header:** D-21 mandates °F. AppHeader currently renders `${Math.round(nas.cpuTempC)}C` — this must become °F throughout. Formula: `tempF = tempC * 9/5 + 32`. The `tempColor()` function already uses °F thresholds (114°F, 95°F) — correct.
- **Making the NAS header a scroll container:** If disk temp bars + Docker stats push header height over ~100px, the temptation will be to make the header scrollable. Don't. Reduce bar heights and font sizes to fit within budget. The header must remain fixed and non-scrolling.
- **Tier section labels staying in CardGrid:** The "STATUS", "ACTIVITY", "RICH DATA" section `<h2>` labels in CardGrid take up vertical space (~32px each with margin). These compete with the card content. Decision D-12 only removes "MEDIA STACK" but the tier labels should be reviewed for the viewport budget.
- **Adding `mediaType` field without guarding StreamRow:** StreamRow will crash if it tries to access `stream.mediaType` on existing PlexStream objects that lack the field. Always add new fields as optional (`mediaType?: 'audio' | 'video'`) and guard in the render.
- **Purple for all arr LEDs (current bug):** The current `MediaStackRow.getLedStyle()` returns `background: 'var(--cockpit-purple)'` for BOTH `queue > 0 || downloading` (correct) AND the `service.status === 'online'` fallback (wrong — should be green). This is the bug to fix per D-11.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stream title cycling animation | Custom CSS keyframe fade | `useState` + `useEffect` setInterval + Framer Motion `AnimatePresence` with `motion.div` crossfade | Already in stack; consistent with other dashboard animations |
| Disk temp color thresholds | Custom color calculation | `tempColor()` function already in `AppHeader.tsx` — it uses °F thresholds | Function already exists; just ensure it's used for disk bars too |
| Pi-hole donut chart legend | SVG custom legend | Recharts `Cell` + a static `<table>` beside the `<PieChart>` | Recharts PieChart already used in Phase 4; table-based legend removes tooltip complexity |
| Audio quality string formatting | Custom codec+bitrate formatter | Derive directly from Plex Media item fields (`audioCodec` + `bitrate`) — simple string interpolation | No external library needed |

---

## Common Pitfalls

### Pitfall 1: Viewport Budget Creep
**What goes wrong:** Adding inline sections to AppHeader (disk bars + Docker stats + image LED) without measuring pixel heights causes the header to exceed its budget, pushing card content below the fold.
**Why it happens:** Each "small" addition (16px label + 20px bars + 4px gap) compounds; 5 additions = 200px unplanned.
**How to avoid:** Assign exact pixel heights to each new header section before implementing. Target: disk bars section ≤ 40px, Docker section ≤ 24px, image LED ≤ 20px, total header ≤ 128px.
**Warning signs:** Dashboard main content has a scrollbar in Chrome DevTools at 800×480 viewport simulation.

### Pitfall 2: SYNO.Docker API — Version and Namespace Variance
**What goes wrong:** Calling `SYNO.Docker.Image` or `SYNO.Docker.Container` with version 1 returns `success: false` silently, so image updates show as false and Docker stats show zeros.
**Why it happens:** Synology changed the Docker package to "Container Manager" in DSM 7.2. API names and versions changed. The `is_update_available` field may be `canUpgrade` or similar in newer builds.
**How to avoid:** Log the raw DSM response during debug. Try `version=2` if `version=1` fails. Check the DSM web UI's API Explorer (available at `{NAS_URL}/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=SYNO.Docker`) for the actual available API versions.
**Warning signs:** `nas.imageUpdateAvailable` stays `undefined` after restart; `nas.docker` field remains `undefined` after wiring.

### Pitfall 3: Audio Stream Type Bleeding into Video Format Logic
**What goes wrong:** Adding `albumName`/`trackTitle` fields to `PlexStream` and using them in `StreamRow` causes music streams to display in TV episode `SxEx` format because `parentIndex` (track number) still gets mapped to `season`.
**Why it happens:** The current `plex.ts` `deriveTitle` function uses `item.type === 'episode' || item.type === 'track'` to detect "series format" but still maps `parentIndex` to `season` for all types. The `StreamRow` then formats `S{season}E{episode}`.
**How to avoid:** When `item.type === 'track'`, explicitly set `season: undefined` and `episode: undefined` in the PlexStream. The `deriveTitle` function should return `albumName - trackTitle` for audio.
**Warning signs:** Audio streams show "Artist - Track S1E1" in the expanded rail.

### Pitfall 4: SABnzbd LED Color Inversion
**What goes wrong:** The current `SabnzbdInstrument` component renders `color: isActivelyDownloading ? 'var(--cockpit-purple)' : 'var(--cockpit-amber)'` for the SPEED text — this correctly colors the speed text amber/purple. But D-05 says text should always be amber. The speed text currently turns purple when downloading, which is the behavior to remove.
**Root cause:** The component was written to make text purple, but the decision is that only the LED (StatusDot) should go purple, not the text.
**How to avoid:** In `SabnzbdInstrument`, all text/label `color` values must use `var(--cockpit-amber)` or `var(--text-offwhite)`. Remove the purple text color. The `StatusDot` passed from `ServiceCard` is responsible for the LED color.
**Warning signs:** Download speed shows in purple font during active download after the fix should have reverted it.

### Pitfall 5: MediaStackRow LED Bug — Purple When Should Be Green
**What goes wrong:** All online arr services show purple LED because `getLedStyle()` returns purple in the `online` status branch for ANY service — including those with no queue activity.
**Root cause:** The LED logic in `MediaStackRow.getLedStyle()` reads:
```typescript
if (service.status === 'online') {
  if (queue > 0 || downloading) { return purple-flashing }
  return purple-solid  // BUG: should be green
}
```
The final `return purple-solid` is wrong — it fires when the service is online with no queue, which per D-11 should be GREEN.
**How to avoid:** Fix the `online` + no-activity branch to return `var(--cockpit-green)`.
**Warning signs:** All arr services show purple LED when idle — no download activity visible anywhere.

### Pitfall 6: CardGrid Section Label Height Consumption
**What goes wrong:** The CardGrid `<h2>` tier section labels ("STATUS", "ACTIVITY", "RICH DATA") each consume ~32px with their bottom margin inside the 312px available for content. Three tiers = ~96px consumed by labels alone.
**Why it matters:** At 800×480 with a ~128px header and 40px rail, only ~312px remains. If tier labels stay, cards have ~216px of usable grid space — likely insufficient for all cards to render without scrolling.
**How to avoid:** The planner should include a task to audit and either remove or minimize tier section labels for the kiosk viewport.
**Warning signs:** Dashboard scrolls at 800×480 even after header and rail fit within budget.

---

## Code Examples

### SABnzbd Slot Fields — filename and timeleft
```typescript
// SABnzbd queue API response — slots array fields (MEDIUM confidence — SABnzbd API docs)
interface SabnzbdSlot {
  status: string        // 'Downloading' | 'Paused' | 'Failed' | 'Queued'
  percentage?: string   // '0'–'100'
  filename: string      // Display name of the NZB (already truncated by SABnzbd)
  timeleft: string      // Formatted like '0:04:32'
  mb: string            // Total size in MB (as string)
  mbleft: string        // Remaining MB (as string)
  cat?: string          // Category
}

// In pollSabnzbd — add these extractions:
const firstActiveSlot = slots.find((s) => s.status !== 'Failed')
const currentFilename = firstActiveSlot?.filename ?? ''
const timeLeft = firstActiveSlot?.timeleft ?? ''
```

### SabnzbdMetrics Type Extension
```typescript
// packages/shared/src/types.ts — add missing fields to SabnzbdMetrics
export interface SabnzbdMetrics {
  speedMBs: number
  queueCount: number
  progressPercent: number
  hasFailedItems: boolean
  sabStatus: string
  currentFilename?: string   // ADD: display name of active download
  timeLeft?: string          // ADD: formatted time remaining (e.g. '0:04:32')
}
```

### PlexStream Type Extension
```typescript
// packages/shared/src/types.ts — extend PlexStream for audio and media type
export interface PlexStream {
  user: string
  title: string
  deviceName: string
  year?: number
  season?: number
  episode?: number
  progressPercent: number
  quality: string
  transcode: boolean
  mediaType?: 'audio' | 'video'   // ADD: derived from Plex item.type
  albumName?: string               // ADD: for audio — item.parentTitle
  trackTitle?: string              // ADD: for audio — item.title
}
```

### MediaStackRow LED Fix
```typescript
// In MediaStackRow.getLedStyle() — fix the online + no-activity case
if (service.status === 'online') {
  if (downloading) {
    // Solid purple = actively downloading (file sent to SABnzbd, in progress)
    return { background: 'var(--cockpit-purple)', boxShadow: '0 0 6px var(--cockpit-purple)' }
  }
  if (queue > 0) {
    // Flashing purple = queued (in arr queue, not yet active in SABnzbd)
    return {
      background: 'var(--cockpit-purple)',
      boxShadow: '0 0 6px var(--cockpit-purple)',
      animation: 'ledFlashPurple 1.5s ease-in-out infinite',
    }
  }
  // GREEN = online, no download activity (was incorrectly purple)
  return { background: 'var(--cockpit-green)', boxShadow: '0 0 6px rgba(74,222,128,0.6)' }
}
```

### NowPlayingBanner Cycling Titles
```typescript
// Cycling stream title in collapsed rail (D-24)
const [activeIdx, setActiveIdx] = useState(0)
useEffect(() => {
  if (streams.length <= 1) { setActiveIdx(0); return }
  const id = setInterval(() => setActiveIdx(i => (i + 1) % streams.length), 4000)
  return () => clearInterval(id)
}, [streams.length])

const currentStream = streams[activeIdx] ?? streams[0]
```

### AppHeader — Disk Temp Bar (always visible, °F)
```typescript
// Inline disk temp bar rendering (replaces NasHeaderPanel drawer content)
// All temps in °F per D-21
{nas.disks && nas.disks.length > 0 && (
  <div style={{ padding: '4px 12px', display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
    {nas.disks.map(disk => {
      const tempF = Math.round(disk.tempC * 9 / 5 + 32)
      return (
        <GaugeColumn
          key={disk.id}
          label={disk.name.length > 8 ? disk.name.slice(0, 8) : disk.name}
          fillPct={Math.max(0, Math.min(100, ((tempF - 32) / (140 - 32)) * 100))}
          valueText={`${tempF}°F`}
          color={tempColor(tempF)}
        />
      )
    })}
  </div>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NAS header expand/collapse drawer | Always-visible inline sections | Phase 5 (D-18) | Removes one interaction layer; header is taller but always informative |
| `N streams` label in Plex rail | "PLEX" static label + cycling titles | Phase 5 (D-24, D-29) | Makes Plex brand visible; handles multi-stream gracefully |
| Audio tracks shown as SxEx format | Track + Album display | Phase 5 (D-26) | Correct semantics for audio streams |
| Arr services always purple LED | Green/Amber/Red/Purple per real status | Phase 5 (D-11) | LED is now actionable information, not decorative |
| Pi-hole card | NETWORK card with Ubiquiti placeholder | Phase 5 (D-15, D-16) | Prepares card for Phase 6 Ubiquiti integration |
| Tooltip-based Pi-hole chart legend | Static table legend beside donut | Phase 5 (D-17) | Eliminates broken dynamic legend; works on touch without hover |

---

## Open Questions

1. **SYNO.Docker.Image API field name for update availability**
   - What we know: Current code checks `img.is_update_available`. The test uses a mocked response with this field. User has a stale image but the LED doesn't trigger.
   - What's unclear: Whether DSM Container Manager (7.2+) still uses `is_update_available` or renamed it. Also unclear if the API version `1` is still valid.
   - Recommendation: Executor must log the raw DSM Docker.Image list response to determine the actual field name. If field name changed, update the check condition.

2. **SYNO.Docker.Container stats for Docker section in NAS header**
   - What we know: `NasDockerStats` type exists but is never populated. The adapter does not query any Docker container API.
   - What's unclear: Whether SYNO.Docker.Container list returns aggregate CPU/RAM/network or only per-container values. Whether "Container Manager" namespace differs.
   - Recommendation: Executor must probe `SYNO.Docker.Container list` and `SYNO.ContainerManager.Container list` to see which works and what fields come back. If only per-container data is available, sum CPU%, memory, and network across all running containers.

3. **Plex server stats source for collapsed rail (D-23)**
   - What we know: `PlexServerStats` is currently populated only via the Tautulli webhook path. The 5-second PMS poll (`fetchPlexSessions`) does NOT populate `plexServerStats`.
   - What's unclear: Whether the PMS `/status/sessions` response includes server CPU/RAM/bandwidth, or whether a separate Plex endpoint provides this.
   - Recommendation: The Plex Media Server API does include a `MediaContainer.size` (stream count) and per-session bandwidth in the sessions response. Server process CPU/RAM is not in the sessions endpoint — those come from Tautulli `get_activity` or the Plex dashboard API (`/:/prefs`, `/diagnostics/info`). Safest approach: populate `plexServerStats` from Tautulli `get_activity` API call (which the Tautulli webhook handler already knows about) via a separate polling path. If Tautulli is not configured, show dashes for server stats.

4. **Disk SSD vs HDD classification**
   - What we know: DSM `hdd_info` returns `{ id, name, temp }`. No explicit `type` field observed.
   - What's unclear: Some DSM versions may include a disk type field. NVMe drives may have different naming patterns.
   - Recommendation: Claude's discretion — render all disks in a single "DISKS" group without SSD/HDD sub-grouping unless the DSM response clearly includes a `diskType` or similar field. Verify during implementation.

5. **CardGrid tier section labels and viewport budget**
   - What we know: "STATUS", "ACTIVITY", "RICH DATA" `<h2>` labels with `marginBottom: '24px'` each add ~32px. With 3 tiers visible, that's ~96px.
   - What's unclear: Whether all 3 tier labels are visible at 800×480 or if only 1-2 tiers have visible content.
   - Recommendation: Planner should include a task to reduce or remove tier section labels. Alternatively, reduce margin dramatically (4px) to reclaim vertical space.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is pure code changes to existing packages. No new external tools, services, or CLI utilities are required. All dependencies (`react`, `framer-motion`, `recharts`, `vitest`) are already installed. The NAS DSM API is a runtime dependency verified during execution, not a build-time dependency.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (root workspace config) |
| Config file | `/vitest.config.ts` (root, covers `packages/*/src/__tests__/**/*.test.ts`) |
| Quick run command | `npm run test -- --reporter=verbose 2>&1 \| tail -20` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-05 | SABnzbd LED = purple when downloading, text = amber | unit | `npm run test -- --reporter=verbose packages/backend/src/__tests__/sabnzbd-adapter.test.ts` | Yes (extend existing) |
| DASH-05 | Arr LED = green when online + no queue | unit | `npm run test -- --reporter=verbose` (extend sabnzbd/arr tests) | Partial (arr-adapter.test.ts exists) |
| DASH-06 | PlexStream mediaType populated correctly | unit | `npm run test -- --reporter=verbose packages/backend/src/__tests__/plex-adapter.test.ts` | Yes (extend existing) |
| DASH-05 | SabnzbdMetrics includes currentFilename and timeLeft | unit | Extend sabnzbd-adapter.test.ts | Yes (extend existing) |
| DASH-01 | Dashboard renders without scroll at 800×480 | manual/visual | Chrome DevTools viewport simulation + visual check | N/A — manual |

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/backend/src/__tests__/sabnzbd-adapter.test.ts` — needs new test cases for `currentFilename` and `timeLeft` field extraction from slot data
- [ ] `packages/backend/src/__tests__/plex-adapter.test.ts` — needs new test cases for `mediaType: 'audio'`, `albumName`, `trackTitle`, and correct `season`/`episode` = `undefined` for track type
- [ ] `packages/backend/src/__tests__/nas-adapter.test.ts` — needs new test for `checkNasImageUpdates` with actual field name variant once confirmed; optionally test Docker stats aggregation

---

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection — `packages/shared/src/types.ts`, `packages/backend/src/adapters/sabnzbd.ts`, `packages/backend/src/adapters/nas.ts`, `packages/backend/src/adapters/plex.ts`, `packages/frontend/src/components/cards/ServiceCard.tsx`, `packages/frontend/src/components/layout/AppHeader.tsx`, `packages/frontend/src/components/layout/NowPlayingBanner.tsx`, `packages/frontend/src/components/cards/CardGrid.tsx`
- Phase 5 CONTEXT.md — all locked decisions D-01 through D-29
- Project CLAUDE.md — established stack, ARM64 deployment constraints
- Project STATE.md — accumulated implementation decisions from Phases 1–4

### Secondary (MEDIUM confidence)
- SABnzbd API — `slots[].filename` and `slots[].timeleft` fields (well-documented in SABnzbd API reference; consistent across versions 3.x and 4.x)
- Plex Media Server API — session type fields (`type: 'track'`, `parentTitle`, `audioCodec`, `bitrate`) from PMS HTTP API documentation
- Synology DSM API — `SYNO.Docker.Image` and `SYNO.Docker.Container` endpoint patterns (known from DSM API documentation; specific field names for update detection unverified against live Container Manager)

### Tertiary (LOW confidence)
- `SYNO.Docker.Image` `is_update_available` field name — unverified against live DSM Container Manager 7.2+; may differ
- `SYNO.Docker.Container` aggregate stats response shape — unverified; executor must probe live DSM

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 5 |
|-----------|-------------------|
| Docker Compose on Synology NAS — no exotic runtime deps | No new runtime dependencies introduced |
| `node:22-slim` Docker base (NOT Alpine) | No build changes required |
| All data stays local — no cloud telemetry | Plex/NAS stats come from local PMS and DSM endpoints only |
| ARM64 native binaries required | No new native modules; all changes are pure JS/TS |
| No Redux/Zustand for server state — use TanStack Query or React Context | No state management changes needed; all data flows through existing SSE + `DashboardSnapshot` |
| PM2 inside Docker is an anti-pattern | No process management changes |
| Vitest for testing | Test files extend existing Vitest suite |
| No Create React App / no Webpack | Build chain unchanged |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing packages confirmed in codebase
- Architecture: HIGH — derived from direct code inspection of all affected files
- Pitfalls: HIGH for LED/text color bugs (code-confirmed); MEDIUM for DSM Docker API field names (requires live verification)
- SABnzbd filename/ETA: HIGH — field names confirmed in SABnzbd API docs and already partially consumed by SabnzbdInstrument component
- Docker stats gap: HIGH (confirmed not implemented); fix path MEDIUM (API field names unverified)

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable codebase; DSM API shape may change with NAS firmware updates)
