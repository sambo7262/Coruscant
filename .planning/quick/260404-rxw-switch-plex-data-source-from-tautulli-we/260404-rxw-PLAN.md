---
phase: quick
plan: 260404-rxw
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/backend/src/adapters/plex.ts
  - packages/backend/src/poll-manager.ts
  - packages/shared/src/types.ts
  - packages/backend/src/__tests__/plex-adapter.test.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Plex streams update every 5 seconds via direct polling (not webhook)"
    - "Movie titles show as bare title; TV/music show as 'grandparentTitle - title'"
    - "TranscodeSession present → transcode: true; absent → transcode: false (Direct Play)"
    - "Player.title maps to deviceName on PlexStream"
    - "Empty or missing Metadata array returns [] (idle state shown)"
    - "Old Tautulli webhook route still accepts POST without error"
  artifacts:
    - path: "packages/backend/src/adapters/plex.ts"
      provides: "fetchPlexSessions(baseUrl, token) → PlexStream[]"
    - path: "packages/backend/src/__tests__/plex-adapter.test.ts"
      provides: "Unit tests covering session parsing, idle state, transcode flag"
  key_links:
    - from: "packages/backend/src/poll-manager.ts"
      to: "packages/backend/src/adapters/plex.ts"
      via: "5-second setInterval calling fetchPlexSessions"
    - from: "packages/backend/src/poll-manager.ts"
      to: "broadcastSnapshot()"
      via: "called after each fetchPlexSessions result"
---

<objective>
Replace the Tautulli-webhook-only Plex data path with a direct 5-second poll of the Plex Media Server `/status/sessions` endpoint.

Purpose: Tautulli webhooks require Tautulli to be running and configured correctly. Direct polling of PMS is simpler, lower-latency, and doesn't depend on a secondary service.
Output: `packages/backend/src/adapters/plex.ts` (new), updated `poll-manager.ts` (plex reload path), updated `types.ts` if needed, unit tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

@packages/shared/src/types.ts
@packages/backend/src/poll-manager.ts
@packages/backend/src/adapters/sabnzbd.ts
@packages/backend/src/__tests__/sabnzbd-adapter.test.ts
</context>

<interfaces>
<!-- Key types the executor needs. Do not re-derive from codebase. -->

From packages/shared/src/types.ts:
```typescript
export interface PlexStream {
  user: string
  title: string
  deviceName: string        // Player.title from Plex API
  year?: number
  season?: number
  episode?: number
  progressPercent: number
  quality: string           // e.g. '1080p'
  transcode: boolean        // true = transcoding, false = direct play
}
```

From packages/backend/src/poll-manager.ts — plex reload branch (lines 156-171):
```typescript
// Current behavior: marks plex configured, no interval started
if (serviceId === 'plex') {
  this.state.set(serviceId, { ..., status: 'stale', configured: true })
  this.broadcastSnapshot()
  return
}
```

Adapter pattern (from sabnzbd.ts):
```typescript
export async function pollX(baseUrl: string, apiKey: string): Promise<ServiceStatus>
// - axios.get with { timeout: TIMEOUT_MS }
// - try/catch: offline ServiceStatus on any error
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create Plex adapter + unit tests</name>
  <files>packages/backend/src/adapters/plex.ts, packages/backend/src/__tests__/plex-adapter.test.ts</files>
  <behavior>
    - fetchPlexSessions('http://plex:32400', 'TOKEN') with active movie → returns PlexStream[] with title=movie title, transcode=false
    - fetchPlexSessions with TV episode → title = '${grandparentTitle} - ${title}'
    - fetchPlexSessions with Plexamp track → title = '${grandparentTitle} - ${title}'
    - fetchPlexSessions with TranscodeSession key present → transcode=true
    - fetchPlexSessions with empty MediaContainer.Metadata → returns []
    - fetchPlexSessions with missing Metadata key → returns []
    - fetchPlexSessions on network error → returns [] (never throws)
    - Player.title maps to deviceName on each PlexStream
  </behavior>
  <action>
Write tests first in `src/__tests__/plex-adapter.test.ts` following the sabnzbd-adapter.test.ts pattern:
- `vi.mock('axios')`; mock `axios.get` with canned XML/JSON responses
- Plex `/status/sessions` returns XML by default but also supports JSON via `Accept: application/json` — use JSON by passing `Accept: application/json` header

Then implement `src/adapters/plex.ts`:

```
GET ${baseUrl}/status/sessions?X-Plex-Token=${token}
Headers: { Accept: 'application/json' }
httpsAgent: new https.Agent({ rejectUnauthorized: false })  // self-signed cert support
timeout: 5_000
```

Response shape (Plex JSON API):
```typescript
interface PlexSessionsResponse {
  MediaContainer: {
    Metadata?: PlexMetadataItem[]
  }
}
interface PlexMetadataItem {
  type: string            // 'movie' | 'episode' | 'track'
  title: string           // episode title or movie title or track title
  grandparentTitle?: string  // show name (TV) or artist name (music)
  year?: number
  parentIndex?: number    // season number
  index?: number          // episode number
  User: { title: string }
  Player: { title: string }
  TranscodeSession?: { videoDecision?: string }
  Media?: Array<{ videoResolution?: string }>
}
```

Title mapping:
- `type === 'movie'` → `title`
- `type === 'episode'` or `type === 'track'` → `${grandparentTitle} - ${title}`

Stream mapping per PlexStream:
- `user`: `item.User.title`
- `title`: derived by type (above)
- `deviceName`: `item.Player.title`
- `year`: `item.year ?? undefined`
- `season`: `item.parentIndex ?? undefined`
- `episode`: `item.index ?? undefined`
- `progressPercent`: 0 (Plex sessions endpoint does not expose viewOffset in a reliable way — set to 0 for now)
- `quality`: `item.Media?.[0]?.videoResolution ?? 'Unknown'`
- `transcode`: `item.TranscodeSession !== undefined`

On any error (network, parse, non-200): return []. Never throw.

Export: `export async function fetchPlexSessions(baseUrl: string, token: string): Promise<PlexStream[]>`

Use Node.js built-in `https` module for the Agent — no new dependencies. Import: `import https from 'node:https'`
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npm run test --workspace=packages/backend -- --reporter=verbose --run src/__tests__/plex-adapter.test.ts</automated>
  </verify>
  <done>All plex-adapter tests pass. fetchPlexSessions correctly maps movie/TV/track titles, transcode flag, deviceName, and idle state.</done>
</task>

<task type="auto">
  <name>Task 2: Wire plex poller into PollManager</name>
  <files>packages/backend/src/poll-manager.ts</files>
  <action>
In `poll-manager.ts`:

1. Add import at top:
   ```typescript
   import { fetchPlexSessions } from './adapters/plex.js'
   ```

2. Add constant near other interval constants:
   ```typescript
   const PLEX_INTERVAL_MS = 5_000  // 5 second poll per task description
   ```

3. Add private field to store plex config for reload:
   ```typescript
   private plexConfig: { baseUrl: string; token: string } | null = null
   ```

4. Replace the current `if (serviceId === 'plex')` early-return block (lines 155-171) with:
   ```typescript
   if (serviceId === 'plex') {
     // Store config for polling
     this.plexConfig = { baseUrl, token: apiKey }

     // Mark plex as configured with stale status until first poll completes
     this.state.set(serviceId, {
       id: 'plex',
       name: 'Plex',
       tier: 'rich',
       status: 'stale',
       configured: true,
       lastPollAt: new Date().toISOString(),
     })

     const doPollPlex = async () => {
       try {
         const streams = await fetchPlexSessions(baseUrl, apiKey)
         this.plexStreams = streams
         this.state.set('plex', {
           id: 'plex',
           name: 'Plex',
           tier: 'rich',
           status: 'online',
           configured: true,
           lastPollAt: new Date().toISOString(),
         })
       } catch {
         // fetchPlexSessions never throws — this is a safety net
       }
       this.broadcastSnapshot()
     }

     // Immediate first poll
     await doPollPlex()

     const timer = setInterval(doPollPlex, PLEX_INTERVAL_MS)
     this.timers.set('plex', timer)
     return
   }
   ```

5. In the `reload()` method, the existing block at lines 143-151 already clears the plex streams when config is null — leave that unchanged. Also clear `this.plexConfig = null` in that same block.

6. `updatePlexState()` method: leave it intact for backward-compat with the Tautulli webhook route. It still works — webhooks can override stream state if someone has Tautulli running.

7. `stopAll()`: no changes needed — `this.timers.get('plex')` already gets cleared by the existing loop.
  </action>
  <verify>
    <automated>cd /Users/Oreo/Projects/Coruscant && npm run test --workspace=packages/backend -- --reporter=verbose --run src/__tests__/tautulli-webhook.test.ts && npm run build --workspace=packages/backend 2>&1 | tail -20</automated>
  </verify>
  <done>TypeScript build succeeds. Tautulli webhook tests still pass. poll-manager.ts has 5s plex poller in the plex reload branch.</done>
</task>

</tasks>

<verification>
Full backend test suite passes:
```
cd /Users/Oreo/Projects/Coruscant && npm run test --workspace=packages/backend -- --run
```

TypeScript compiles clean:
```
cd /Users/Oreo/Projects/Coruscant && npm run build --workspace=packages/backend
```
</verification>

<success_criteria>
- `packages/backend/src/adapters/plex.ts` exists and exports `fetchPlexSessions`
- `fetchPlexSessions` maps movie titles bare, TV/music as `grandparentTitle - title`
- `TranscodeSession` presence drives `transcode: true`
- `Player.title` → `deviceName`
- Empty/missing Metadata → `[]`
- Network error → `[]` (no throw)
- `poll-manager.ts` plex reload branch starts a 5s setInterval calling `fetchPlexSessions`
- `updatePlexState()` still exists (Tautulli webhook backward-compat)
- All existing backend tests pass
- TypeScript build is clean
</success_criteria>

<output>
After completion, create `.planning/quick/260404-rxw-switch-plex-data-source-from-tautulli-we/260404-rxw-SUMMARY.md`
</output>
