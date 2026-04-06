---
phase: quick
plan: 260406-bko
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/frontend/src/components/cards/ServiceCard.tsx
  - packages/frontend/src/components/cards/CardGrid.tsx
  - packages/frontend/src/components/layout/NowPlayingBanner.tsx
autonomous: true
requirements: [UAT-R5]
must_haves:
  truths:
    - "Disk LED row 2 (odd remaining disks) is centered under the row above"
    - "NAS tile shows CPU/RAM/HD as thick horizontal bars spanning tile width"
    - "IMG OK shows as 'No Update Available' (green/grey), alert shows 'Update Available' (amber)"
    - "Plex server stats (CPU, RAM, bandwidth) appear in the bottom rail"
    - "Network bars (TX, RX, CLIENTS) are vertical bars filling space under ONLINE"
    - "SABnzbd bar in download section is 12-16px thick with amber glow"
    - "Download section shows large 22px title + large progress bar using full tile height"
    - "Docker stats and NAS labels are 22px matching media label standard"
  artifacts:
    - path: "packages/frontend/src/components/cards/ServiceCard.tsx"
      provides: "NAS tile horizontal bars, disk LED centering, IMG label rename, Docker label sizing, network vertical bars"
    - path: "packages/frontend/src/components/cards/CardGrid.tsx"
      provides: "Download section large title + thick bar + full tile height"
    - path: "packages/frontend/src/components/layout/NowPlayingBanner.tsx"
      provides: "Plex server stats in bottom rail"
  key_links:
    - from: "NowPlayingBanner.tsx"
      to: "plexServerStats prop"
      via: "plexServerStats already passed from App.tsx"
      pattern: "plexServerStats\\."
---

<objective>
Phase 8 UAT round 5 visual polish: 10 specific UI fixes across NAS tile, Plex rail, Network tile, and Download section.

Purpose: Address remaining UAT feedback to match the intended cockpit instrument panel aesthetic.
Output: Updated ServiceCard.tsx, CardGrid.tsx, NowPlayingBanner.tsx with all 10 fixes applied.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/frontend/src/components/cards/ServiceCard.tsx
@packages/frontend/src/components/cards/CardGrid.tsx
@packages/frontend/src/components/layout/NowPlayingBanner.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: NAS tile overhaul — horizontal bars, disk LED centering, IMG labels, Docker label sizing</name>
  <files>packages/frontend/src/components/cards/ServiceCard.tsx</files>
  <action>
  In NasTileInstrument component (line ~192):

  1. **Disk LED row 2 centering (item 1):** In the disk LED grid (line ~200-231), the last row uses `justifyContent: row.length < 4 ? 'center' : 'flex-start'`. This is already `'center'` for partial rows. Verify it works — if disks are 5, row 2 has 1 LED that should be centered. The current logic uses `row.length < 4` which is correct. However, the user reports it's right-justified. Check if the parent `div` at line 197 (`display: 'flex', flexDirection: 'column'`) needs `alignItems: 'center'` to center the inner row div itself (the flex row div has a width set by the 4-LED row above). Add `alignItems: 'center'` to the outer column container wrapping the rows so partial rows center within the column.

  2. **CPU/RAM/HD horizontal bars (items 2-3):** Replace the CENTER col (lines 235-264) which currently renders vertical `NasGaugeColumn` components. Instead, render THREE stacked horizontal bars spanning the column width:
     - Each bar: 14px height, full width of the center column, with amber glow (`boxShadow: '0 0 6px ${color}'`), `borderRadius: '3px'`, background track `'rgba(232,160,32,0.15)'`.
     - Layout per bar: a row with label on the left (10px font, mono, uppercase), bar in the middle (flex:1), value on the right (12px font, mono).
     - Labels: `CPU`, `RAM`, `HD` (for volume). Use `getBarColor()` for fill color (green/amber/red thresholds).
     - For volumes: map `/volume1` to label `HD`, other volumes to `V2`, `V3`, etc. If multiple volumes, stack additional bars.
     - The center column should use `display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center'`.

  3. **IMG label rename (item 4):** In the RIGHT col Docker stats section (lines 278-289):
     - Change `'IMG UPDATE'` to `'Update Available'`
     - Change `'IMG OK'` to `'No Update Available'`
     - Keep amber dot + amber text for update-available state
     - Keep grey dot (#444) + grey text for no-update state
     - If `nasStatus.imageUpdateCount` exists and > 0, append ` (${count})` to the label

  4. **Docker stats label sizing (items 5, 10):** In the RIGHT col (lines 270-291):
     - Change Docker CPU/RAM `fontSize` from `'16px'` to `'22px'` to match media label standard.
     - Change the `'Docker'` section header from `fontSize: '9px'` to `fontSize: '11px'`.
     - The image update label text: change from `fontSize: '8px'` to `fontSize: '10px'`.
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit --project packages/frontend/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>NAS tile shows centered disk LED row 2, three thick horizontal CPU/RAM/HD bars, renamed IMG labels, and 22px Docker stats labels</done>
</task>

<task type="auto">
  <name>Task 2: Plex rail stats, Network vertical bars, Download section large title/bar</name>
  <files>packages/frontend/src/components/layout/NowPlayingBanner.tsx, packages/frontend/src/components/cards/ServiceCard.tsx, packages/frontend/src/components/cards/CardGrid.tsx</files>
  <action>
  **NowPlayingBanner.tsx — Plex stats restore (item 6):**
  The `plexServerStats` prop is already passed but the three comments say "server stats shown in Plex tile -- not duplicated here". The user wants them restored in the rail. In the collapsed strip (the 40px bar, line ~128), after the cycling stream title div and before the closing `</div>`, add a stats group:
  ```
  {plexServerStats && (
    <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
      {plexServerStats.processCpuPercent != null && (
        <span style={{ fontSize: '11px', color: '#4ADE80', fontFamily: 'var(--font-mono)', fontWeight: 600, textShadow: '0 0 6px #4ADE80' }}>
          CPU {plexServerStats.processCpuPercent.toFixed(1)}%
        </span>
      )}
      {plexServerStats.processRamPercent != null && (
        <span style={{ fontSize: '11px', color: '#00c8ff', fontFamily: 'var(--font-mono)', fontWeight: 600, textShadow: '0 0 6px #00c8ff' }}>
          RAM {plexServerStats.processRamPercent.toFixed(1)}%
        </span>
      )}
      {plexServerStats.bandwidthMbps != null && (
        <span style={{ fontSize: '11px', color: '#C8C8C8', fontFamily: 'var(--font-mono)', fontWeight: 600, textShadow: '0 0 6px rgba(200,200,200,0.4)' }}>
          {plexServerStats.bandwidthMbps.toFixed(1)}M
        </span>
      )}
    </div>
  )}
  ```
  Also add the same stats block in the idle rail (the `!hasStreams` return block, after the "NO ACTIVE STREAMS" span). Remove the three "server stats shown in Plex tile" comments.

  **ServiceCard.tsx — Network vertical bars (item 7):**
  In `NetworkInstrument`, the RIGHT (Ubiquiti) column currently shows a horizontal CLIENTS bar + horizontal TX/RX ThroughputBars. Replace the layout after the ONLINE status text with three VERTICAL bars side by side:
  - Layout: `display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'flex-end', flex: 1, paddingTop: '8px'`
  - Each vertical bar: container is `display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1`
    - Bar track: `width: '16px', height: '80px'` (or use `flex: 1` with `minHeight: '60px'`), `background: '#222'`, `borderRadius: '3px'`, `position: 'relative'`, `overflow: 'hidden'`
    - Fill: `position: 'absolute', bottom: 0, left: 0, right: 0`, height = percentage of peak, `borderRadius: '3px'`, `transition: 'height 0.3s ease'`, `boxShadow: '0 0 6px ${color}'`
    - Label below bar: `fontSize: '8px'`, mono font, uppercase
  - Bar 1: UP (TX) — color `#FF3B3B`, value `um.wanTxMbps`, peak `um.peakTxMbps`
  - Bar 2: DOWN (RX) — color `#00c8ff`, value `um.wanRxMbps`, peak `um.peakRxMbps`  
  - Bar 3: CLIENTS — color `#4ADE80`, value `um.clientCount`, peak `um.peakClients`
  - Remove the old horizontal CLIENTS bar section (lines 631-651) and the two horizontal ThroughputBar calls (lines 653-655).

  **CardGrid.tsx — Download section (items 8-9):**
  In the `DownloadActivity` component:
  - Change the "DOWNLOADS" sub-label from `fontSize: '9px'` to `fontSize: '22px'`, color to `'var(--cockpit-amber)'` with full opacity, `fontWeight: 600`.
  - For active arr download rows: change `activeTitle` font size from `9px` to `22px`, `fontWeight: 600`, add `textShadow: '0 0 8px var(--cockpit-purple)'`, color `'var(--cockpit-purple)'`.
  - For the arr download count badge: increase from `9px` to `14px`.
  - SABnzbd progress bar (line 78): change `height: '3px'` to `height: '16px'`, add `borderRadius: '3px'`, add `boxShadow: '0 0 6px var(--cockpit-amber)'` on the fill div. Change the SAB label from `fontSize: '8px'` to `fontSize: '11px'`.
  - Add `minHeight: '120px'` to the DownloadActivity outer container div so it uses vertical space even when content is sparse. Add `display: 'flex', flexDirection: 'column', justifyContent: 'flex-start'` to the outer div.
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit --project packages/frontend/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>Plex stats visible in bottom rail (idle and active states), Network shows 3 vertical bars under ONLINE, Download section has 22px titles and 16px thick bars using full tile height</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit --project packages/frontend/tsconfig.json` passes with no errors
- `npm run build --workspace=packages/frontend` completes successfully
- Visual check: all 10 items render correctly on the dashboard
</verification>

<success_criteria>
1. Disk LED row 2 is centered (not right-justified)
2. NAS tile shows 3 thick horizontal bars for CPU/RAM/HD
3. IMG labels read "No Update Available" / "Update Available"
4. Docker stats text is 22px
5. Plex CPU/RAM/bandwidth stats appear in bottom rail
6. Network bars are vertical under ONLINE
7. SABnzbd bar is 16px thick with glow
8. Download titles are 22px bold with purple glow
9. Download section uses full tile height
10. All NAS/Docker labels match 22px media standard
</success_criteria>

<output>
After completion, create `.planning/quick/260406-bko-phase-8-uat-round-5-disk-led-row-2-cente/260406-bko-SUMMARY.md`
</output>
