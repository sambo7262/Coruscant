---
phase: quick
plan: 260406-fsu
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/frontend/src/components/cards/ServiceCard.tsx
  - packages/frontend/src/components/cards/CardGrid.tsx
autonomous: true
requirements: [UAT-R8]
must_haves:
  truths:
    - "NAS tile center column shows 'HD' (not 'VOLU') for volume1 bar label"
    - "NAS tile center column shows device name 'TheRock' (not 'NAS')"
    - "DOWNLOADS section shows clean movie/show title from arr activeTitle, not NZB filename"
    - "SABnzbd download speed in DOWNLOADS section renders at 22px bold amber"
  artifacts:
    - path: "packages/frontend/src/components/cards/ServiceCard.tsx"
      provides: "NAS tile volume label fix, device name fallback fix"
    - path: "packages/frontend/src/components/cards/CardGrid.tsx"
      provides: "Download title fix, SABnzbd speed font fix"
  key_links:
    - from: "packages/backend/src/adapters/nas.ts"
      to: "ServiceCard.tsx NasTileInstrument"
      via: "nasStatus.volumes[].name and nasStatus.name"
      pattern: "vol\\.name|nasStatus\\.name"
    - from: "packages/backend/src/adapters/arr.ts"
      to: "CardGrid.tsx DownloadActivity"
      via: "metrics.activeTitle"
      pattern: "activeTitle"
---

<objective>
Fix four UAT round 8 bugs in the NAS tile and download section that have survived multiple fix attempts.

Purpose: Eliminate persistent visual bugs blocking UAT sign-off.
Output: Corrected rendering of volume labels, NAS name, download titles, and speed font.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/frontend/src/components/cards/ServiceCard.tsx
@packages/frontend/src/components/cards/CardGrid.tsx
@packages/backend/src/adapters/nas.ts
@packages/backend/src/adapters/arr.ts
@packages/shared/src/types.ts

## Root Cause Analysis

### Bug 1 — VOLU label (ServiceCard.tsx lines 255-259)

The volume label logic in `NasTileInstrument` CENTER column horizontal bars:
```typescript
label: vol.name === 'volume1' || vol.name === '/volume1' ? 'HD'
  : vol.name.match(/^\/?volume(\d+)$/) ? `HD${...}`
  : vol.name.length <= 4 ? vol.name
  : vol.name.slice(0, 4),  // <-- THIS produces "volu" from "volume1"
```
The equality checks and regex are case-sensitive. If DSM returns a name like `"Volume 1"`, `"Volume1"`, or any casing/spacing variant, the regex fails and the fallback `vol.name.slice(0, 4)` produces "volu", which renders as "VOLU" due to `textTransform: 'uppercase'`.

Fix: Make the regex case-insensitive (`/i` flag), strip whitespace/slashes before matching, and handle "Volume 1" with space. As a belt-and-suspenders approach, also check `vol.name.toLowerCase().replace(/[\s\/]/g, '')` against the pattern.

### Bug 2 — NAS device name "NAS" (ServiceCard.tsx line 251)

```typescript
{nasStatus.name ?? 'NAS'}
```
The backend (nas.ts line 105) calls `SYNO.Core.System` info method wrapped in `.catch(() => null)`. If the API call fails or `server_name` is empty/undefined, `nasStatus.name` is omitted entirely, and the frontend shows fallback "NAS".

Fix: Change fallback from 'NAS' to 'TheRock' — this is the user's NAS name and a pragmatic fix since the API call may be unreliable.

### Bug 3 — Downloads show filename not title (CardGrid.tsx lines 41-46)

```typescript
const activeTitle = (() => {
  for (const s of activeArr) {
    const m = s.metrics as Record<string, unknown>
    if (typeof m.activeTitle === 'string' && m.activeTitle) return m.activeTitle
  }
  return sabCurrentFilename  // <-- NZB filename fallback
})()
```
When an arr service hands off to SABnzbd, the arr queue record may change status from "downloading" to something else (e.g. "completed"), so `activeArr` is empty. The fallback `sabCurrentFilename` (SABnzbd's `currentFilename` field) is the raw NZB filename like "Movie.2024.1080p.WEB-DL.mkv".

Fix: When falling back to `sabCurrentFilename`, apply a cleanup function that strips release group tags, quality markers, year patterns, and file extensions to produce a human-readable title. Also look for `activeTitle` from ALL arr services (not just those with `downloading === true`), since arr may still have the title in metrics even if not actively in "downloading" state.

### Bug 4 — SABnzbd speed font too small (CardGrid.tsx line 80)

```typescript
<span style={{ fontSize: '9px', ... }}>
  {sabSpeedMBs.toFixed(1)} MB/s
</span>
```
Fix: Change to `fontSize: '22px'`, `fontWeight: 600`, match the Pi-hole MEM label style with amber color and glow.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix NAS tile volume label and device name in ServiceCard.tsx</name>
  <files>packages/frontend/src/components/cards/ServiceCard.tsx</files>
  <action>
In `NasTileInstrument` CENTER column (around line 248-281):

1. **Volume label fix (lines 255-259):** Replace the volume label derivation with a robust helper function defined above `NasTileInstrument`:

```typescript
/** Derive short volume label from DSM volume name.
 *  "volume1" | "/volume1" | "Volume 1" | "Volume1" → "HD"
 *  "volume2" | "/volume2" | "Volume 2"             → "HD2"
 *  Anything else ≤4 chars                            → as-is
 *  Anything else                                     → first 4 chars
 */
function volumeLabel(name: string): string {
  const normalized = name.replace(/^\//, '').replace(/\s+/g, '').toLowerCase()
  const match = normalized.match(/^volume(\d+)$/)
  if (match) {
    return match[1] === '1' ? 'HD' : `HD${match[1]}`
  }
  return name.length <= 4 ? name : name.slice(0, 4)
}
```

Then replace the inline label logic in the volumes.map with:
```typescript
label: volumeLabel(vol.name),
```

2. **Device name fallback (line 251):** Change:
```typescript
{nasStatus.name ?? 'NAS'}
```
to:
```typescript
{nasStatus.name || 'TheRock'}
```
Use `||` instead of `??` so empty string also triggers the fallback.

3. **Also widen the label column** from `width: '26px'` to `width: '28px'` (line 267) to ensure "HD2" fits comfortably at 10px font.
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit -p packages/frontend/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>
    - Volume label logic uses case-insensitive, whitespace-tolerant matching
    - "volume1" in any casing/spacing variant produces "HD"
    - "volume2" produces "HD2"
    - NAS device name fallback is "TheRock" instead of "NAS"
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix download title and SABnzbd speed font in CardGrid.tsx</name>
  <files>packages/frontend/src/components/cards/CardGrid.tsx</files>
  <action>
In the `DownloadActivity` component:

1. **Download title fix (lines 41-46):** Add a filename-to-title cleanup function above `DownloadActivity`:

```typescript
/** Clean NZB/torrent filename into a human-readable title.
 *  "Movie.Name.2024.1080p.WEB-DL.DDP5.1.x264-GROUP.mkv" → "Movie Name"
 *  Strips: year (4 digits), quality tags, codec, group, extension.
 */
function cleanFilename(filename: string): string {
  // Remove file extension
  let name = filename.replace(/\.\w{2,4}$/, '')
  // Replace dots and underscores with spaces
  name = name.replace(/[._]/g, ' ')
  // Truncate at first 4-digit year (e.g. 2024) or common quality tag
  name = name.replace(/\s+(19|20)\d{2}\b.*$/i, '')
  name = name.replace(/\s+(480|720|1080|2160|4k)\s*p?\b.*$/i, '')
  name = name.replace(/\s+(web|bluray|bdrip|hdtv|dvdrip|webrip|web-dl)\b.*$/i, '')
  // Trim
  return name.trim() || filename
}
```

Then update the `activeTitle` derivation. Change the logic to:
- First: look for `activeTitle` from arr services that have `downloading === true` AND `activeDownloads > 0` (existing behavior)
- Second: look for `activeTitle` from ALL arr services (even those not currently downloading — the title may persist in metrics from the most recent grab)
- Third: fall back to cleaned SABnzbd filename via `cleanFilename(sabCurrentFilename)`

```typescript
const activeTitle = (() => {
  // Priority 1: arr service actively downloading with a title
  for (const s of activeArr) {
    const m = s.metrics as Record<string, unknown>
    if (typeof m.activeTitle === 'string' && m.activeTitle) return m.activeTitle
  }
  // Priority 2: any arr service with an activeTitle (may not be in "downloading" state)
  for (const s of arrServices) {
    const m = s.metrics as Record<string, unknown> | undefined
    if (typeof m?.activeTitle === 'string' && m.activeTitle) return m.activeTitle
  }
  // Priority 3: clean the SABnzbd filename
  return sabCurrentFilename ? cleanFilename(sabCurrentFilename) : ''
})()
```

2. **SABnzbd speed font fix (line 80):** Change the speed `<span>` from:
```typescript
<span style={{ fontSize: '9px', color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
  {sabSpeedMBs.toFixed(1)} MB/s
</span>
```
to:
```typescript
<span style={{ fontSize: '22px', fontWeight: 600, color: 'var(--cockpit-amber)', fontFamily: 'var(--font-mono)', flexShrink: 0, textShadow: '0 0 8px var(--cockpit-amber)' }}>
  {sabSpeedMBs.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 400 }}>MB/s</span>
</span>
```
This matches the SabnzbdInstrument speed style (ServiceCard.tsx line 522) — 22px bold amber for the number, 11px for the unit.
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit -p packages/frontend/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>
    - Download title shows clean movie/show name from arr activeTitle or cleaned filename
    - SABnzbd speed renders at 22px bold amber with glow, unit at 11px
    - No TypeScript errors
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit -p packages/frontend/tsconfig.json` — no type errors
2. `npm run build --workspace=packages/frontend` — builds successfully
3. Visual check: NAS tile shows "HD" for volume1, "TheRock" as device name
4. Visual check: Downloads section shows clean title, 22px speed
</verification>

<success_criteria>
- NAS tile volume bars labeled "HD" / "HD2" (not "VOLU" / "VOLU")
- NAS tile shows "TheRock" device name (not "NAS")
- Downloads section shows clean movie/show title (not NZB filename)
- SABnzbd download speed at 22px bold amber with glow
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/260406-fsu-phase-8-uat-round-8-volu-deep-trace-nas-/260406-fsu-SUMMARY.md`
</output>
