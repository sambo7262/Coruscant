---
phase: quick
plan: 260406-are
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/frontend/src/components/cards/ServiceCard.tsx
  - packages/frontend/src/components/cards/CardGrid.tsx
autonomous: true
---

<objective>
Phase 8 UAT round 4 polish: NAS tile disk LED centering and sizing, CPU/RAM/volume vertical centering, volume label rename, Docker stats sizing + image update LED restoration, Media+Network tile height expansion with label scaling, network speed bars (not numbers), thick SABnzbd bar, arr download title-only display.

Purpose: Fix visual polish issues identified in UAT round 4 to bring the dashboard to production-ready appearance.
Output: Updated ServiceCard.tsx and CardGrid.tsx with all 12 visual fixes applied.
</objective>

<context>
@packages/frontend/src/components/cards/ServiceCard.tsx
@packages/frontend/src/components/cards/CardGrid.tsx
@packages/frontend/src/App.tsx
@packages/frontend/src/pages/DashboardPage.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: NAS tile polish — disk LEDs, CPU/RAM centering, volume label, Docker stats</name>
  <files>packages/frontend/src/components/cards/ServiceCard.tsx</files>
  <action>
In `NasTileInstrument` component and related NAS rendering in ServiceCard.tsx, make these changes:

**1. Disk LED bottom-row centering (line ~203):**
Change the `justifyContent` logic for partial rows. Currently `row.length < 4 ? 'center' : 'flex-start'`. This only centers when the last row has fewer than 4 items. The issue is it left-aligns odd-count bottom rows. Keep this logic — it already does `'center'` for partial rows. Verify the centering is correct by checking that partial rows (e.g., 5 disks = row of 4 + row of 1) center the bottom row under the full row. The current code already has `justifyContent: row.length < 4 ? 'center' : 'flex-start'` which should work. If the user sees left-alignment, the issue may be that the parent container constrains width. Wrap the disk LED grid in a container with `width: '100%'` and add `alignItems: 'center'` to the parent div.

**2. Disk LED group vertical centering (line ~197):**
On the LEFT col container div (the one wrapping all disk rows), add `display: 'flex'`, `flexDirection: 'column'`, `justifyContent: 'center'`, `height: '100%'` so the disk group is vertically centered within the grid cell. Also change the grid container's `alignItems` from `'flex-start'` to `'stretch'` (line ~194) so all three columns have equal height for centering to work.

**3. Disk LED size increase (line ~215-218):**
Increase disk LED dot from `width: '10px', height: '10px'` to `width: '14px', height: '14px'`. Increase the temp font from `fontSize: '9px'` to `fontSize: '10px'`. Increase the disk label (D1, D2...) from `fontSize: '7px'` to `fontSize: '8px'`. Increase gap between LEDs from `gap: '6px'` to `gap: '8px'`.

**4. CPU/RAM/Volume bars vertical centering (line ~234):**
On the CENTER col div, change `alignItems: 'flex-end'` to `alignItems: 'center'` and add `justifyContent: 'center'`, `height: '100%'` so the bar group is vertically centered in its grid cell.

**5. Volume label rename (line ~253):**
Change `vol.name.slice(0, 8)` to: `vol.name === '/volume1' ? 'HD' : vol.name.replace(/^\/volume/, 'V').slice(0, 4)`. This maps `/volume1` to `HD` and `/volume2` to `V2`, etc.

**6. Docker stats font size increase (lines ~268-274):**
Change Docker section label from `fontSize: '8px'` to `fontSize: '9px'`. Change CPU and RAM text from `fontSize: '10px'` to `fontSize: '16px'`. Add `lineHeight: 1.2` to the CPU/RAM spans. Change the "Docker" label to be more prominent.

**7. Docker image update LED restoration (lines ~275-280):**
The current code only shows the UPDATE LED when `nasStatus.imageUpdateAvailable === true`. Modify this to ALWAYS show an image update indicator in the Docker section:
- When `nasStatus.imageUpdateAvailable === true`: amber LED (8px dot, `#E8A020` background + glow) with "IMG UPDATE" label in amber.
- When `nasStatus.imageUpdateAvailable` is false or undefined: grey LED (8px dot, `#444` background, no glow) with "IMG OK" label in grey (#444).
Remove the conditional `nasStatus.imageUpdateAvailable === true` wrapper so the LED always renders. The RIGHT col (Docker stats) div should also get `justifyContent: 'center'`, `height: '100%'` for vertical centering.
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit -p packages/frontend/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>NAS tile shows: centered bottom-row disk LEDs, vertically centered disk group, larger 14px LEDs, vertically centered CPU/RAM/volume bars, "HD" volume label, larger Docker stats text (16px), always-visible image update LED with IMG UPDATE/IMG OK label.</done>
</task>

<task type="auto">
  <name>Task 2: Media+Network tile height, network speed bars, SABnzbd bar, arr title-only</name>
  <files>packages/frontend/src/components/cards/CardGrid.tsx, packages/frontend/src/components/cards/ServiceCard.tsx</files>
  <action>
**8. Media + Network tile height expansion (CardGrid.tsx line ~165):**
On the Row 2 grid container div, add `flex: 1` so it expands to fill remaining vertical space below the NAS tile. Change the outer container (line ~151) from `display: 'flex', flexDirection: 'column'` — it already is flex column. Add `height: 'calc(100vh - 52px - 40px)'` (52px header + 40px Plex banner) or use `flex: 1` with a parent that has full height. The simplest approach: on the outer div (line ~151), add `minHeight: 'calc(100vh - 52px - 40px)'` so the flex column fills the viewport. The Row 2 grid div gets `flex: 1` so it stretches. The Media tile already has `display: 'flex', flexDirection: 'column'` — the inner content areas should get `flex: 1`. The Network (pihole) ServiceCard also needs to stretch — it already uses `alignItems: 'stretch'` on the grid. On the ServiceCard for pihole, change `minHeight` from `'130px'` to `undefined` (remove minHeight) and ensure the card's flex column fills available space.

**9. Label/text size increase in Media + Network tiles:**
In the MEDIA tile header (CardGrid.tsx line ~181): increase `fontSize` from `'9px'` to `'10px'`.
In MediaStackRow (ServiceCard.tsx line ~1065-1069): increase service label `fontSize` from `'12px'` to `'14px'`. Increase LED dot from `width: '8px', height: '8px'` to `width: '10px', height: '10px'`.
In NetworkInstrument (ServiceCard.tsx): increase Pi-hole section label from `fontSize: '8px'` to `fontSize: '9px'`, increase the BLOCKING/QPM large text from `fontSize: '20px'` to `fontSize: '22px'`, increase UBIQUITI label similarly.
In the DOWNLOADS sub-label (CardGrid.tsx line ~45): increase from `fontSize: '8px'` to `fontSize: '9px'`.

**10. Network speed bars instead of numbers:**
The NetworkInstrument Ubiquiti section already has ThroughputBar for TX/RX (lines ~644-660). These ARE bars. The user says "currently showing numbers" — this may mean the WAN speed is shown as plain text somewhere else, or ThroughputBar is not rendering. Check: the ThroughputBar component (lines ~525-542) renders a bar AND a number. The bars are 12px tall which is good. The current implementation already shows bars. If the user wants bars WITHOUT the trailing number, remove the trailing `<span>` that shows the `{display}` value from ThroughputBar. BUT more likely the user wants the bars to be more prominent. Increase ThroughputBar height from `12px` to `16px`. Keep the number label but make it smaller or remove if redundant. Actually, re-reading the requirement: "should be shown as thick bars, NOT as plain numbers" — remove the trailing number span from ThroughputBar entirely so only the bar + label (TX/RX) shows. The bar itself communicates speed visually.

**11. SABnzbd thick download bar:**
In the SabnzbdInstrument component (ServiceCard.tsx lines ~504-518), the progress bar is already `height: '16px'` which is thick. Add `boxShadow: '0 0 6px var(--cockpit-amber)'` to the inner fill div for glow styling (currently missing glow). Also in the DownloadActivity SABnzbd row (CardGrid.tsx lines ~90-101), increase bar height from `'3px'` to `'12px'` and add `boxShadow: '0 0 6px var(--cockpit-amber)'` to the fill, and increase border-radius from `'2px'` to `'3px'`.

**12. Arr download shows title, not progress bar (CardGrid.tsx lines ~56-81):**
In the DownloadActivity `activeArr.map` block, remove the progress bar div entirely. Instead, show just the title and count. Replace the progress bar + quality span with:
- `activeTitle` text (already extracted on line 61) displayed as the main content, truncated with ellipsis
- A count badge `x{count}` after it
- No progress bar div at all
The layout should be: `[activeTitle] [x{count}]` in a single flex row with gap, no bar.
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit -p packages/frontend/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>Media and Network tiles expand to fill vertical space. Labels are sized up proportionally. Network speed shows thick bars only (no trailing numbers). SABnzbd bar is 12-16px with glow. Arr downloads show title text instead of progress bar.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit -p packages/frontend/tsconfig.json` passes with no errors
- Visual inspection on 800x480 viewport confirms: NAS disk LEDs centered and larger, Docker stats fill space with IMG UPDATE/OK LED, Media+Network tiles fill vertical space, network shows bars not numbers, arr downloads show titles
</verification>

<success_criteria>
All 12 UAT items addressed: disk LED centering/sizing, CPU/RAM centering, HD label, Docker stats sizing, image update LED, tile height expansion, label sizing, network speed bars, SABnzbd thick bar, arr title-only display. TypeScript compiles without errors.
</success_criteria>

<output>
After completion, create `.planning/quick/260406-are-phase-8-uat-round-4-nas-tile-polish-disk/260406-are-SUMMARY.md`
</output>
