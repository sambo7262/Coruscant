---
phase: quick
plan: 260406-gbd
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/frontend/src/components/cards/ServiceCard.tsx
  - packages/frontend/src/components/cards/CardGrid.tsx
  - packages/frontend/src/components/layout/NowPlayingBanner.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "NAS volume bars show HD, HD2, HD3 labels by array index — never the DSM volume name"
    - "Long download titles truncate with ellipsis instead of overflowing"
    - "Plex rail text descenders (g, y, p) are fully visible, not clipped"
  artifacts:
    - path: "packages/frontend/src/components/cards/ServiceCard.tsx"
      provides: "Index-based volume label, volumeLabel helper deleted"
    - path: "packages/frontend/src/components/cards/CardGrid.tsx"
      provides: "Download title overflow protection"
    - path: "packages/frontend/src/components/layout/NowPlayingBanner.tsx"
      provides: "Plex rail descender fix"
  key_links: []
---

<objective>
Fix three UAT round 9 visual issues: replace volumeLabel() with index-based HD labels, add download title overflow protection, and fix Plex rail descender clipping.

Purpose: Close remaining visual polish items from UAT.
Output: Three files patched with targeted CSS/logic fixes.
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
  <name>Task 1: Replace volumeLabel() with index-based HD labels and fix download title overflow</name>
  <files>packages/frontend/src/components/cards/ServiceCard.tsx, packages/frontend/src/components/cards/CardGrid.tsx</files>
  <action>
**ServiceCard.tsx — volume label fix:**

1. Delete the entire `volumeLabel()` function (lines 202-215 — the JSDoc comment, the function body, everything).

2. In `NasTileInstrument`, find the volume bar mapping at ~line 270:
```
...nasStatus.volumes.map((vol: NasVolume) => ({
  label: volumeLabel(vol.name),
```
Replace with index-based labeling:
```
...nasStatus.volumes.map((vol: NasVolume, idx: number) => ({
  label: idx === 0 ? 'HD' : `HD${idx + 1}`,
```
This is the ONLY place volumes are labeled. The `volumeLabel` import/call is removed entirely.

**CardGrid.tsx — download title overflow:**

The download title span is at ~line 88 inside `DownloadActivity`. It already has `overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'` — but it's missing a width constraint. The parent is a flex column, so the span can grow unbounded.

Add `maxWidth: '100%'` and `display: 'block'` to the existing style object on the `<span>` at line 88 (the one with `fontSize: '22px', fontWeight: 600, color: 'var(--cockpit-purple)'`). The span needs to be a block-level element for text-overflow to work — inline elements ignore it.

The full style should include these properties (keep all existing ones):
```
display: 'block',
maxWidth: '100%',
overflow: 'hidden',
textOverflow: 'ellipsis',
whiteSpace: 'nowrap',
```
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit -p packages/frontend/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>volumeLabel() function deleted; volumes use index-based HD/HD2/HD3 labels; download title truncates with ellipsis on overflow</done>
</task>

<task type="auto">
  <name>Task 2: Fix Plex rail descender clipping</name>
  <files>packages/frontend/src/components/layout/NowPlayingBanner.tsx</files>
  <action>
The cycling stream title container (collapsed strip) has `height: '20px'` at ~line 178. With 22px font, descenders on g/y/p are clipped.

1. In the collapsed strip's title container div (~line 172-180), change `height: '20px'` to `height: '28px'`. This gives enough room for 22px text with descenders.

2. The inner `motion.span` has `position: 'absolute'` with no explicit height — it inherits from the container. No change needed there, but verify the `alignItems: 'center'` on the container keeps it vertically centered.

This is the only place the rail title is rendered in the collapsed state. The idle state (NO ACTIVE STREAMS) at line 64 does not have a fixed-height wrapper, so it is not affected.
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npx tsc --noEmit -p packages/frontend/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>Plex rail collapsed strip title container is 28px tall — descenders on g/y/p fully visible</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes for frontend package
- No references to `volumeLabel` remain in ServiceCard.tsx
- Volume bars use index-based labels (grep for `idx === 0`)
- Download title span has `display: 'block'` and `maxWidth: '100%'`
- NowPlayingBanner title container height is 28px
</verification>

<success_criteria>
All three visual issues resolved: NAS volumes labeled HD/HD2/HD3 by index, download titles truncate cleanly, Plex rail descenders not clipped.
</success_criteria>

<output>
After completion, create `.planning/quick/260406-gbd-phase-8-uat-round-9-volu-hardcode-hd-by-/260406-gbd-SUMMARY.md`
</output>
