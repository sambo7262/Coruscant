---
phase: quick
plan: 260403-eh1
subsystem: frontend-ui
tags: [color-semantics, status-led, arr, sabnzbd, css-tokens]
dependency_graph:
  requires: []
  provides: [cockpit-purple-token, arr-download-purple-led, sabnzbd-purple-bar]
  affects: [ServiceCard.tsx, globals.css, ServiceDetailPage.tsx]
tech_stack:
  added: []
  patterns: [css-custom-property, conditional-style-derivation]
key_files:
  created: []
  modified:
    - packages/frontend/src/styles/globals.css
    - packages/frontend/src/components/cards/ServiceCard.tsx
    - packages/frontend/src/pages/ServiceDetailPage.tsx
decisions:
  - Purple (#8B5CF6) chosen as download-activity color — distinct from amber/green/red health palette at small LED sizes
  - isDownloading boolean derived from queueCount > 0 || progressPercent > 0 for SABnzbd
  - ArrInstrument LED status text stays "ONLINE" when downloading — LED color communicates activity, text confirms health
  - [!] ATTENTION REQUIRED replaces ⚠ emoji for mono-font rendering consistency on Pi touchscreen
metrics:
  duration: "~2m14s"
  completed: "2026-04-03"
  tasks: 3
  files: 3
---

# Quick 260403-eh1: Arr/SABnzbd Status Color Semantics Summary

**One-liner:** Purple download state (#8B5CF6) added to ArrInstrument LED + bar and SabnzbdInstrument bar — visually distinguishes "healthy AND working" from "healthy AND idle" at a glance.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add --cockpit-purple token and arrDownloadPulsePurple keyframe | 9cc0f43 | globals.css |
| 2 | Apply purple download semantics in ArrInstrument and SabnzbdInstrument | 4fed9f7 | ServiceCard.tsx |
| 3 | Verify and update ServiceDetailPage.tsx attention header | 51880c0 | ServiceDetailPage.tsx |

## What Was Built

**globals.css:**
- `--cockpit-purple: #8B5CF6` added to `:root` after `--cockpit-grey`
- `@keyframes arrDownloadPulsePurple` keyframe added with independent 0.65→1.0 opacity range

**ServiceCard.tsx — ArrInstrument:**
- LED color logic extended to four states: online+downloading=purple, online=green, warning=amber, else=red
- Download bar background changed from `var(--cockpit-amber)` to `var(--cockpit-purple)`
- Download bar track changed from `rgba(232,160,32,0.15)` to `rgba(139,92,246,0.15)`
- Download bar animation changed from `arrDownloadPulse` to `arrDownloadPulsePurple`
- Download label `color` changed from amber to purple

**ServiceCard.tsx — SabnzbdInstrument:**
- `isDownloading` boolean derived: `queueCount > 0 || progressPercent > 0`
- Progress bar background, track background, and speed label color all respond to `isDownloading`
- QUEUED count span stays `#C8C8C8` (neutral count label, not state color)

**ServiceDetailPage.tsx — ArrDetailView:**
- Attention header changed from `⚠ Attention Required` to `[!] ATTENTION REQUIRED`
- Attention section colors confirmed correct and unchanged: amber border/bg, amber manual-import, red failed items

## Deviations from Plan

None — plan executed exactly as written.

## Known Issues (Pre-existing, Out of Scope)

The frontend Vite production build fails with `Unexpected token` in `src/App.js` — this is a pre-existing issue caused by compiled `.js` artifacts in the source tree conflicting with Vite's resolver. This was present before this quick task and is unrelated to the changes made here.

TypeScript also has a pre-existing `TS2882` error on the CSS side-effect import in `main.tsx` — also unrelated and pre-existing.

Neither issue was introduced by this task. Both are logged here for awareness.

## Self-Check: PASSED

Files modified exist and contain expected tokens:
- `packages/frontend/src/styles/globals.css` — `--cockpit-purple` at line 8, `arrDownloadPulsePurple` at line 124
- `packages/frontend/src/components/cards/ServiceCard.tsx` — `cockpit-purple` at lines 97, 159, 167, 240, 263; `isDownloading` at line 227
- `packages/frontend/src/pages/ServiceDetailPage.tsx` — `[!] ATTENTION REQUIRED` at line 119

Commits verified: 9cc0f43, 4fed9f7, 51880c0 all present in git log.
