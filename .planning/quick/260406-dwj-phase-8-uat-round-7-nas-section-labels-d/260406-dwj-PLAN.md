---
phase: quick
plan: 260406-dwj
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/shared/src/types.ts
  - packages/backend/src/adapters/nas.ts
  - packages/frontend/src/components/cards/ServiceCard.tsx
  - packages/frontend/src/components/cards/CardGrid.tsx
  - packages/frontend/src/styles/globals.css
autonomous: true
requirements: []
must_haves:
  truths:
    - "NAS tile shows DISKS label centered above disk LED grid"
    - "NAS tile shows DOCKER label centered above Docker stats column"
    - "NAS tile shows NAS device name centered above CPU/RAM/HD bars"
    - "Volume label shows HD not VOLU"
    - "Network tile does not show LOAD stat"
    - "Network vertical bars show numerical value above each bar"
    - "Download section when active shows only title + SABnzbd bar + speed (no service tag, no arr bar)"
    - "Download section when idle shows only DOWNLOADS header"
    - "Prowlarr LED flashes amber when indexers are down"
  artifacts:
    - path: "packages/frontend/src/components/cards/ServiceCard.tsx"
      provides: "NAS labels, volume fix, network bar values, Prowlarr flash"
    - path: "packages/frontend/src/components/cards/CardGrid.tsx"
      provides: "Simplified download section"
  key_links:
    - from: "packages/backend/src/adapters/nas.ts"
      to: "packages/shared/src/types.ts"
      via: "NasStatus.name field"
      pattern: "name.*server"
---

<objective>
Phase 8 UAT round 7 polish: NAS section labels (DISKS, device name, DOCKER centered), persistent VOLU->HD bug fix, network tile LOAD removal + bar values, download section simplification, Prowlarr indexer-down flash LED.

Purpose: Address 9 specific UAT findings from round 7 visual review.
Output: Updated ServiceCard.tsx, CardGrid.tsx, types.ts, nas.ts, globals.css
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/frontend/src/components/cards/ServiceCard.tsx
@packages/frontend/src/components/cards/CardGrid.tsx
@packages/shared/src/types.ts
@packages/backend/src/adapters/nas.ts
@packages/frontend/src/styles/globals.css

<interfaces>
<!-- Volume name from DSM API is "volume1" (no leading slash), NOT "/volume1" -->
<!-- This is why the check vol.name === '/volume1' at line 241 always fails -->
<!-- Fallback vol.name.slice(0, 4) produces "volu" -> uppercase "VOLU" -->

From packages/shared/src/types.ts:
```typescript
export interface NasStatus {
  cpu: number
  ram: number
  networkMbpsUp: number
  networkMbpsDown: number
  cpuTempC?: number
  volumes: NasVolume[]
  disks?: NasDisk[]
  fans?: NasFan[]
  docker?: NasDockerStats
  imageUpdateAvailable?: boolean
  // NOTE: no `name` field yet — must be added
}

export interface NasVolume {
  name: string       // DSM returns "volume1" not "/volume1"
  usedPercent: number
  tempC?: number
  tempF?: number
}
```

From packages/backend/src/adapters/nas.ts (line 137-138):
```typescript
const volumes = (storageData?.vol_info ?? []).map((vol) => ({
  name: vol.name,  // passes through raw DSM name "volume1"
  usedPercent: ...
}))
```

From NasTileInstrument volume label logic (ServiceCard.tsx lines 240-243):
```typescript
label: vol.name === '/volume1' ? 'HD'                              // NEVER matches — vol.name is "volume1"
  : vol.name.startsWith('/volume') ? `HD${vol.name.replace(...)}` // NEVER matches
  : vol.name.slice(0, 4),                                         // Always hits → "volu" → "VOLU"
```

From NetworkInstrument (ServiceCard.tsx lines 604-611):
```typescript
// LOAD stat that must be removed:
<span>...</span>{load}</span>
<div>LOAD</div>
```

From MediaStackRow getLedStyle (ServiceCard.tsx lines 976-979):
```typescript
// Warning state is solid amber with NO animation — needs flash:
if (service.status === 'warning') {
  return { background: 'var(--cockpit-amber)', boxShadow: '0 0 6px rgba(232,160,32,0.6)' }
}
```

From globals.css:
```css
@keyframes ledPulseWarn {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1.0; }
}
/* ledFlashPurple is used but NOT defined — separate issue, not in scope */
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: NAS name field + volume label fix + NAS section labels + Prowlarr flash + network bar values + LOAD removal</name>
  <files>
    packages/shared/src/types.ts
    packages/backend/src/adapters/nas.ts
    packages/frontend/src/components/cards/ServiceCard.tsx
    packages/frontend/src/styles/globals.css
  </files>
  <action>
**1. Add `name` field to NasStatus (types.ts)**
Add `name?: string` to the NasStatus interface (optional — for backward compat).

**2. Populate NAS name from DSM API (nas.ts)**
In `pollNas()`, add a 4th parallel request to `SYNO.Core.System` with method `info` (no `type` param — returns general system info including `server_name`). Extract `server_name` from the response data and include it as `name` in the returned NasStatus object. If the call fails or returns no server_name, omit the field.

Alternatively, if `storageData` from the existing `SYNO.Core.System info type=storage` call already contains a `server_name` field, use that instead of adding a new request. Check the response structure first.

**3. Fix VOLU bug — ROOT CAUSE (ServiceCard.tsx, NasTileInstrument, ~line 240)**
The volume name from DSM is `"volume1"` (NO leading slash). The current check `vol.name === '/volume1'` never matches.

Replace the volume label logic (lines 240-243) with:
```typescript
label: vol.name === 'volume1' || vol.name === '/volume1' ? 'HD'
  : vol.name.match(/^\/?volume(\d+)$/) ? `HD${vol.name.match(/^\/?volume(\d+)$/)![1]}`
  : vol.name.length <= 4 ? vol.name
  : vol.name.slice(0, 4),
```
This handles both `volume1` and `/volume1` formats. The label "HD" is only 2 chars so no CSS truncation risk (the `maxWidth: '36px'` constraint on labels in NasGaugeColumn won't clip it).

**4. Add section labels to NasTileInstrument (ServiceCard.tsx)**
In the `NasTileInstrument` component:

- **LEFT col (disk LEDs):** Add a centered "DISKS" label at the top of the left column div, ABOVE the disk LED grid. Style: `fontSize: '9px', color: 'rgba(232,160,32,0.6)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '4px'`.

- **CENTER col (CPU/RAM/HD bars):** Add the NAS device name as a centered label at the top. Use `nasStatus.name ?? 'NAS'` as the text. Same label style as DISKS.

- **RIGHT col (Docker stats):** The existing "Docker" label at line 272 is left-aligned. Change it to be centered by adding `textAlign: 'center'` to its style. Also ensure the parent div aligns children centered.

The NasTileInstrument function currently receives only `nasStatus`. This is sufficient since `nasStatus.name` is being added.

**5. Remove LOAD from NetworkInstrument (ServiceCard.tsx)**
In the `NetworkInstrument` component's Pi-hole LEFT column (~lines 604-611), remove the LOAD stat block entirely (the `{load}` value span and its "LOAD" label div). Also remove the `load` variable declaration (~line 559).

**6. Add numerical values above network vertical bars (ServiceCard.tsx)**
In the `NetworkInstrument` component's Ubiquiti RIGHT column, the vertical bars section (~lines 641-668):

For each bar (UP, DOWN, CLIENTS), add a small text element ABOVE the vertical bar div showing the current value:
- UP bar: `{um!.wanTxMbps !== null ? um!.wanTxMbps.toFixed(1) : '0'} Mbps` — small centered text above
- DOWN bar: `{um!.wanRxMbps !== null ? um!.wanRxMbps.toFixed(1) : '0'} Mbps`
- CLIENTS bar: `{um!.clientCount}` (just the number)

Style each: `fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'rgba(200,200,200,0.5)', textAlign: 'center', whiteSpace: 'nowrap'`. Place inside the existing flex column for each bar, between the label and the bar div (or above both — whichever reads better). Since the column is `flexDirection: 'column'` with label at bottom, add the value text as the first child (top of column).

**7. Prowlarr LED flash for warning state (ServiceCard.tsx)**
In `MediaStackRow`'s `getLedStyle()` function (~line 976-979), add an `animation` to the warning state return:
```typescript
if (service.status === 'warning') {
  return {
    background: 'var(--cockpit-amber)',
    boxShadow: '0 0 6px rgba(232,160,32,0.6)',
    animation: 'ledPulseWarn 1s ease-in-out infinite',
  }
}
```
This uses the existing `ledPulseWarn` keyframe from globals.css. This affects ALL arr services with warning status (not just Prowlarr), which is correct — any arr service with health warnings should flash amber.

**8. Add missing `ledFlashPurple` keyframe (globals.css)**
The `ledFlashPurple` animation is referenced in ServiceCard.tsx line 990 but never defined in globals.css. Add it after the existing LED keyframes:
```css
/* Purple queue LED — flashing for arr queued state */
@keyframes ledFlashPurple {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 1.0; }
}
```
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit -p packages/shared/tsconfig.json && npx tsc --noEmit -p packages/backend/tsconfig.json && npx tsc --noEmit -p packages/frontend/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - NasStatus type has optional `name` field
    - NAS adapter populates `name` from DSM server_name
    - Volume label logic matches both "volume1" and "/volume1" -> "HD"
    - DISKS label centered above disk LED grid
    - NAS device name centered above CPU/RAM/HD bars
    - DOCKER label centered in right column
    - LOAD stat removed from network tile Pi-hole section
    - Numerical values displayed above each vertical network bar
    - Warning LED in MediaStackRow uses ledPulseWarn flash animation
    - ledFlashPurple keyframe defined in globals.css
  </done>
</task>

<task type="auto">
  <name>Task 2: Simplify download section — title + SABnzbd bar + speed only</name>
  <files>packages/frontend/src/components/cards/CardGrid.tsx</files>
  <action>
Rewrite the `DownloadActivity` component in CardGrid.tsx:

**When active (hasAnyActivity = true):**
Show ONLY:
1. The title of what's downloading — use the first active arr service's `activeTitle` if available, otherwise the SABnzbd `currentFilename`. Style: `fontSize: '22px', fontWeight: 600, color: 'var(--cockpit-purple)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 0 8px var(--cockpit-purple)'`.
2. The SABnzbd download bar (thick amber, 12px height with glow) — keep existing SAB bar markup.
3. The download speed text: `{sabSpeedMBs.toFixed(1)} MB/s` — small amber mono text.

Remove:
- The per-arr service rows (the `activeArr.map()` block that renders service name tags and arr-specific progress bars — lines 50-73)
- The "SAB" label prefix on the SABnzbd bar row
- Any arr-specific download progress bar

The simplified active layout:
```
[Download title — 22px purple, bold]
[SABnzbd progress bar — 12px amber with glow]
[speed text — right-aligned, small amber]
```

**When idle (hasAnyActivity = false):**
Show ONLY the "DOWNLOADS" sub-label header. Remove any idle-state content beyond that header. The existing DOWNLOADS header (line 45) is fine. Just ensure nothing renders below it when idle.

Keep the divider line at the top.
Keep the DOWNLOADS header always visible.

Implementation details:
- Derive `activeTitle` from the first entry in `activeArr` that has a non-empty `activeTitle` metric. If none, fall back to SABnzbd's `currentFilename` metric. If neither, use empty string (don't show title line).
- The SABnzbd bar and speed should render as a single row with the bar taking flex:1 and speed text on the right.
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit -p packages/frontend/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>
    - Active download shows: title (22px purple) + SABnzbd bar (amber) + speed
    - No "RADARR" or service name tags visible
    - No per-arr progress bars
    - Idle state shows only "DOWNLOADS" header
    - TypeScript compiles cleanly
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes for all three packages (shared, backend, frontend)
2. Visual check: NAS tile shows DISKS / device-name / DOCKER section labels
3. Visual check: Volume bar shows "HD" not "VOLU"
4. Visual check: Network tile has no LOAD stat; vertical bars show values above
5. Visual check: Download section shows title + bar + speed only when active
6. Visual check: Prowlarr LED flashes amber when indexers are down (warning state)
</verification>

<success_criteria>
All 9 UAT items resolved: NAS section labels (DISKS, name, DOCKER centered), VOLU->HD fix, LOAD removal, bar values, download simplification, Prowlarr flash. TypeScript compiles cleanly across all packages.
</success_criteria>

<output>
After completion, create `.planning/quick/260406-dwj-phase-8-uat-round-7-nas-section-labels-d/260406-dwj-SUMMARY.md`
</output>
