---
status: fixing
trigger: "Two symptoms after quick task 260405-byq changed fetchPlexSessions return type from PlexStream[] to { streams, totalBandwidthKbps } and added fetchPlexServerStats. (1) plexServerStats block never renders before a session starts (idle state). (2) ~5 seconds after a Plex session began, the entire UI went blank — a React render crash."
created: 2026-04-05T00:00:00Z
updated: 2026-04-05T02:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — plexServerStats arrives as a truthy object but a numeric field is JSON null at runtime. Browser error: "Cannot read properties of null (reading 'toFixed')". Backend code uses ?? 0 which coerces null correctly, but Tautulli may send fields the ?? guard doesn't reach (e.g. non-standard payload shapes) OR a future code path could introduce null. All three .toFixed() call sites in NowPlayingBanner lack defensive null guards; the fix is to apply (field ?? 0).toFixed() at all six render sites (idle rail + collapsed strip + expanded drawer).
test: Applied (field ?? 0).toFixed() to all 9 .toFixed() call sites across three sections.
expecting: null.toFixed() can no longer throw; crash is eliminated.
next_action: Verify fix compiles, run tests, commit.

## Symptoms

expected: plexServerStats (CPU%/RAM%/BW) shows at all times when Plex is configured, even with no active streams. Streams render correctly when a session is active. UI never goes blank.
actual: (1) No plexServerStats visible before session. (2) UI went fully blank ~5s after session started.
errors: No browser console output provided. Blank screen matches React render tree crash (uncaught TypeError during render, no error boundary) OR Tautulli race causing plexServerStats to disappear causing a startling visual that felt like a blank.
reproduction: Start a Plex stream. Wait ~5s. UI goes blank.
started: Immediately after quick task 260405-byq was merged (today). Prior to that the direct PMS poll only returned streams, never plexServerStats.

## Eliminated

- hypothesis: poll-manager.ts doPollPlex incorrectly destructures fetchPlexSessions return value
  evidence: Lines 177-178 correctly destructure { streams, totalBandwidthKbps } and pass both to fetchPlexServerStats and updatePlexState. No issue here.
  timestamp: 2026-04-05T00:00:00Z

- hypothesis: NowPlayingBanner renders plexServerStats without guard (direct .toFixed() crash on undefined)
  evidence: Both render sites (collapsed strip and expanded drawer) are behind {plexServerStats && (...)} guard. Cannot crash from undefined plexServerStats.
  timestamp: 2026-04-05T00:00:00Z

- hypothesis: fetchPlexServerStats returns NaN values that crash .toFixed()
  evidence: Math.round returns NaN when inputs are NaN, but NaN.toFixed() returns "NaN" string — does NOT throw.
  timestamp: 2026-04-05T00:00:00Z

- hypothesis: StreamRow crashes on missing mediaType field from Tautulli webhook
  evidence: mediaType is optional in the PlexStream interface. StreamRow evaluates stream.mediaType === 'audio' which returns false safely when undefined. No crash.
  timestamp: 2026-04-05T00:00:00Z

- hypothesis: fetchPlexSessions return type change broke a caller that still treats it as PlexStream[]
  evidence: Only caller is poll-manager.ts doPollPlex at line 177, which correctly destructures the object. Tautulli webhook does not call fetchPlexSessions. No missed callers.
  timestamp: 2026-04-05T00:00:00Z

- hypothesis: onBroadcast listeners cause SSE double-send or crash
  evidence: onBroadcast is defined but never called by any route. SSE route uses its own setInterval. broadcastSnapshot() has empty listeners array — no-op.
  timestamp: 2026-04-05T00:00:00Z

## Evidence

- timestamp: 2026-04-05T02:00:00Z
  checked: all backend code paths producing plexServerStats (fetchPlexServerStats, tautulli-webhook, poll-manager)
  found: No backend code path produces null for processCpuPercent/processRamPercent/bandwidthMbps. All use Math.round() or ?? 0 guards. Browser error "Cannot read properties of null (reading 'toFixed')" confirmed from console. The object passes the {plexServerStats && ...} guard (truthy) but a numeric field is null at runtime — bypasses TypeScript enforcement because SSE data is raw JSON.parse with no runtime validation.
  implication: Source of null is likely Tautulli payload or a runtime JSON deserialization edge case not reproducible via static analysis. The fix is defensive null-coalescing at the render site — (field ?? 0).toFixed() — which prevents the crash regardless of where null originates.

- timestamp: 2026-04-05T00:00:00Z
  checked: packages/backend/src/adapters/plex.ts fetchPlexServerStats
  found: When /statistics/resources returns empty StatisticsResources array (idle state — common when no streams active), function returned undefined. This caused plexServerStats=undefined in every SSE snapshot during idle, making the stats block hidden in NowPlayingBanner.
  implication: Symptom 1 directly explained. PMS returns empty resources in idle state; this is expected PMS behavior. Fix: return zeroed PlexServerStats (not undefined) when PMS is reachable but has no entries.

- timestamp: 2026-04-05T00:00:00Z
  checked: packages/backend/src/poll-manager.ts updatePlexState + tautulli-webhook.ts
  found: updatePlexState unconditionally sets this.plexServerStats = serverStats. Tautulli webhook calls updatePlexState(streams, undefined) because standard Tautulli playback events don't include plex_server_cpu/plex_server_ram fields. So every Tautulli event overwrote plexServerStats to undefined, even if the PMS poll had just set real stats.
  implication: ~5s after session start: (1) Tautulli fires → plexServerStats=undefined. (2) SSE tick sends snapshot with plexServerStats=undefined → stats block disappears from NowPlayingBanner. (3) 5s later PMS poll fires → plexServerStats=real value. This cycling undefined/defined is the "blank" behavior at ~5s. Fix: updatePlexState only overwrites plexServerStats when the incoming value is defined.

- timestamp: 2026-04-05T00:00:00Z
  checked: NowPlayingBanner idle rail (lines 33-62 before fix)
  found: Idle rail rendered a centered "NO ACTIVE STREAMS" label with no plexServerStats display at all. Even after fixing fetchPlexServerStats to return zeroed stats in idle, the idle rail had no place to render them.
  implication: Idle rail needed to be updated to show stats in the right-side slot (same pattern as active-stream collapsed strip). Fix: restructure idle rail to left (PLEX label) + center (NO ACTIVE STREAMS) + right (stats block, conditionally shown when plexServerStats defined).

## Resolution

root_cause: TWO bugs introduced by quick task 260405-byq:

BUG 1 — Symptom 1 (plexServerStats never shows in idle state):
fetchPlexServerStats returned undefined when /statistics/resources returned an empty StatisticsResources array (PMS idle state). This is the common case when no streams are active — PMS simply has no resource measurement to report. Since plexServerStats=undefined, NowPlayingBanner's {plexServerStats && (...)} guards never rendered the stats block. Fix: return { processCpuPercent: 0, processRamPercent: 0, bandwidthMbps } (zeroed CPU/RAM, computed BW) when PMS is reachable but returns empty entries, instead of undefined. Also updated the NowPlayingBanner idle rail to render the stats in a right-slot (matching the active-stream layout pattern).

BUG 2 — Symptom 2 (blank/disappearing UI ~5s after session starts):
updatePlexState(streams, serverStats) unconditionally wrote this.plexServerStats = serverStats. Tautulli webhook calls updatePlexState with serverStats=undefined (standard payloads don't include plex_server_cpu/plex_server_ram). So every Tautulli event erased whatever plexServerStats the PMS poll had set. Race: Tautulli fires near session start → plexServerStats=undefined → SSE tick sends undefined → stats disappear. Fix: updatePlexState only overwrites plexServerStats when serverStats !== undefined, preserving the last PMS-polled value across Tautulli events.

fix:
1. packages/backend/src/adapters/plex.ts — fetchPlexServerStats: return { processCpuPercent: 0, processRamPercent: 0, bandwidthMbps } (zeroed) when entries array is empty (reachable PMS, idle state), instead of undefined. Moved bandwidthMbps computation before the entries check so it's available for the zeroed return.
2. packages/backend/src/poll-manager.ts — updatePlexState: wrapped plexServerStats assignment in `if (serverStats !== undefined)` guard. Tautulli events no longer clobber PMS-polled stats.
3. packages/frontend/src/components/layout/NowPlayingBanner.tsx — Idle rail: restructured from centered single label to left/center/right layout matching the active-stream strip. PLEX label on left, NO ACTIVE STREAMS in center, plexServerStats in right slot (dimmed color, same guard as active strip).
4. packages/frontend/src/components/layout/NowPlayingBanner.tsx — All 9 .toFixed() call sites across idle rail, collapsed strip, and expanded drawer now use (field ?? 0).toFixed() to defensively handle JSON null values that bypass TypeScript type enforcement at runtime.
5. packages/backend/src/__tests__/plex-adapter.test.ts — Updated two tests that expected undefined on empty/missing StatisticsResources to expect zeroed stats object instead.

verification: 100 tests pass (12 test files). Backend TypeScript compiles clean. Frontend Vite build succeeds.
files_changed:
  - packages/backend/src/adapters/plex.ts
  - packages/backend/src/poll-manager.ts
  - packages/frontend/src/components/layout/NowPlayingBanner.tsx
  - packages/backend/src/__tests__/plex-adapter.test.ts
