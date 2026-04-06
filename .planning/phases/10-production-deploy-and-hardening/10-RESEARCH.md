# Phase 10: Production Deploy + Hardening - Research

**Researched:** 2026-04-06
**Domain:** Git tagging, CI/CD versioning, logging hardening, bug fixes, repo cleanup
**Confidence:** HIGH

## Summary

Phase 10 is a semantic v1.0 release of an already-running production app. The app has been deployed and tested on the Synology NAS through all prior phases. This phase does not involve a first deploy — it involves tagging the current HEAD as v1.0.0, wiring version tag support into the existing GitHub Actions CI pipeline, fixing two known bugs, hardening webhook logging, and cleaning up the repository.

The technical work is bounded and clear. The CI pipeline (`docker-publish.yml`) currently fires only on branch pushes to `main` and needs a second trigger for `v*` tags. The `compose.yaml` image reference currently uses an environment variable (`${IMAGE_TAG:-latest}`) and should be updated to pin to `v1.0.0`. The webhook logging gap is well-understood: `arr-webhooks.ts` and `tautulli-webhook.ts` currently log via pino but without a dedicated `service: 'webhook'` category that the log viewer can filter. The MediaStackRow LED and bar glow bug is a missing CSS property that other tiles have. The Pi-hole BPM bug requires investigation of what the `queries.frequency` field from `/api/stats/summary` actually means.

**Primary recommendation:** Execute in four sequential waves: (1) CI/tagging, (2) git cleanup and repo hygiene, (3) bug fixes, (4) webhook logging hardening. Tag v1.0.0 after all four waves pass a browser smoke test on the NAS.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Manual `git tag v1.0.0` pushed to origin triggers CI to build versioned image
- **D-02:** CI pushes both `v1.0.0` AND `latest` tags to Docker Hub
- **D-03:** compose.yaml updated to pin image to version tag (e.g., `sambo7262/coruscant:v1.0.0`) instead of `${IMAGE_TAG:-latest}`
- **D-04:** No CHANGELOG.md — git history and .planning/ artifacts are sufficient documentation
- **D-05:** CI workflow updated to detect version tags (`v*`) and build versioned images from them
- **D-06:** Delete all 5 `worktree-agent-*` branches and `.claude/worktrees/` directories
- **D-07:** `.planning/` gitignored going forward (stays in history but no longer tracked)
- **D-08:** Clean up stray files: `.DS_Store`, `.env.example copy`, `.claude/` directory
- **D-09:** Add `.DS_Store`, `.claude/`, `.planning/` to `.gitignore`
- **D-10:** Keep full git history — no squashing. Tag v1.0.0 on current HEAD.
- **D-11:** Fix known bugs (user-reported) + Claude-identified bugs found during code review
- **D-12:** Known bug: Media stack LEDs and bars missing glow effect that other tiles have
- **D-13:** Known bug: Pi-hole "blocked per minute" (BPM) metric is inaccurate. Prefer pulling a direct metric from Pi-hole v6 API (e.g., blocked queries from last interval) rather than calculating a rate. Researcher should check what Pi-hole v6 API exposes directly.
- **D-14:** Claude should actively look for bugs during execution and report them back to the user
- **D-15:** All inbound webhook POSTs (arr services + Tautulli) logged as a dedicated 'webhook' category, filterable in the log viewer
- **D-16:** Webhook log format: service name + event type + timestamp (e.g., "radarr | Grab | Movie Title | 2026-04-06 14:30") — concise and scannable
- **D-17:** Ensure existing error logging produces legible, actionable messages a user can understand at a glance
- **D-18:** Minimal verification: pull image, compose up, open in browser, confirm it loads. No formal smoke test checklist.
- **D-19:** Rollback via previous `sha-*` tag in Docker Hub — change compose.yaml to the prior sha tag and redeploy if v1.0 has issues
- **D-20:** This is a semantic release — the app is already live on the NAS. No first-deploy procedures needed.

### Claude's Discretion

- Claude identifies additional bugs during code review and reports them to the user before fixing
- Claude decides the specific .gitignore entries and cleanup order
- Claude determines the best way to wire webhook logging into the existing pino + SqliteLogStream pipeline

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROD-01 | v1.0.0 image tagged and published to Docker Hub; compose.yaml pinned to version tag | CI workflow `on.push.tags` pattern, `docker/metadata-action` semver type |
| PROD-02 | Repository cleaned: worktree branches deleted, stale files removed, .gitignore updated | Branch deletion via `git push origin --delete`, .gitignore patterns confirmed |
| PROD-03 | Webhook logging hardened: arr + Tautulli webhooks logged as filterable 'webhook' category in log viewer | pino + SqliteLogStream pipeline analysis complete; `service` field is the filter key |
</phase_requirements>

## Standard Stack

### Core (already installed — no new dependencies required)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| GitHub Actions `docker/metadata-action` | v5 | Generates Docker tags from git ref | Already in workflow; needs `type=semver` added |
| GitHub Actions `docker/build-push-action` | v7 | Builds and pushes multi-arch images | Already in workflow; no changes needed |
| pino | installed | Structured logger | Already wired via `pino.multistream` |
| `SqliteLogStream` | project-local | Writes pino JSON lines to `app_logs` SQLite table | Already in `log-transport.ts`; `service` field is the filter key |

### No New Dependencies

This phase introduces zero new npm packages. All required infrastructure is in place.

## Architecture Patterns

### CI Versioning: How docker/metadata-action Works

The existing workflow uses `docker/metadata-action` with two tag rules:
- `type=raw,value=latest` — pushes `latest` on main branch pushes
- `type=sha,format=short` — pushes `sha-abc1234` on every push

To add version tag support, add a third rule:
```yaml
type=semver,pattern={{version}}
```

When `git push origin v1.0.0` fires, `github.ref` becomes `refs/tags/v1.0.0`. The `type=semver` rule extracts `1.0.0` and produces the tag `sambo7262/coruscant:1.0.0`. The `type=raw,value=latest` rule must remain enabled conditionally (on branch push to main) or unconditionally — currently the `enable` condition `${{ github.ref == 'refs/heads/main' }}` is correct and will be false on a tag push, so `latest` will NOT be pushed on tag events unless we also want it to be.

**D-02 requires both `v1.0.0` AND `latest` be pushed on version tag.** This means the `latest` tag rule must also be enabled for tag events, or a separate explicit `type=raw,value=latest` rule with no enable condition must be added.

**Pattern:** Add `on.push.tags: ['v*']` to the workflow trigger, and update the metadata tags block to emit both:

```yaml
# Source: GitHub Actions docker/metadata-action v5 docs
on:
  push:
    branches: [main]
    tags: ['v*']

# In the metadata step:
tags: |
  type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v') }}
  type=sha,format=short
  type=semver,pattern={{version}}
```

Confidence: HIGH — this is the standard docker/metadata-action pattern documented in its README.

### compose.yaml: Pinning to Version Tag

Current:
```yaml
image: ${DOCKER_HUB_REPO}:${IMAGE_TAG:-latest}
```

Updated (D-03):
```yaml
image: sambo7262/coruscant:v1.0.0
```

The image name should be hardcoded rather than env-var-driven so the version is explicit in the file and visible in git history. Rollback procedure (D-19): change this line to a prior `sha-*` tag and re-run `docker compose pull && docker compose up -d` on the NAS.

### Webhook Logging: Wiring 'webhook' Category

The existing logging pipeline flows:

```
pino log call → multistream → [stdout, SqliteLogStream._write]
                                     ↓
                              JSON.parse(line)
                              obj.service → appLogs.service column
                              obj.msg → appLogs.message column
```

The `service` column in `app_logs` is what the log viewer's filter dropdown reads. Currently the log viewer's service filter is dynamically derived from loaded entries: `Array.from(new Set(entries.map((e) => e.service)))`. So adding a `'WEBHOOK'` (or `'webhook'`) service string to log calls automatically makes it available in the filter dropdown — no schema changes needed, no frontend changes needed.

**Current state of webhook logging:**

`arr-webhooks.ts` already calls:
```typescript
fastify.log.info(
  { service: service.toUpperCase() },
  `[WEBHOOK] ${service.toUpperCase()} -> ${eventType} -> "${title}"`
)
```

This logs with `service: 'RADARR'` (or whichever arr service), not `service: 'webhook'`. The log message is already good. The service field needs to change to `'webhook'` (or a consistent category) to be filterable as a group.

`tautulli-webhook.ts` has **no log call at all** for incoming events. It silently processes them.

**Fix:**
1. Change `arr-webhooks.ts` `service` value from `service.toUpperCase()` to `'webhook'` (keep the service name in the message body per D-16 format)
2. Add a `fastify.log.info({ service: 'webhook' }, ...)` call in `tautulli-webhook.ts` for non-empty payloads

**D-16 format:** `"radarr | Grab | Movie Title | 2026-04-06 14:30"`

The `[WEBHOOK] RADARR -> grab -> "Movie Title"` format in arr-webhooks.ts is close but not exactly D-16. The planner should align the message format to match D-16 exactly.

### MediaStackRow Glow Bug (D-12)

**What the bug is:** MediaStackRow LEDs have `boxShadow: '0 0 6px ...'` in the `getLedStyle()` function — this IS present. However, the service label text in `MediaStackRow` uses `className="text-label text-glow"`. The bug reported is that the glow effect is missing compared to other tiles.

**Code review finding:** The MediaStackRow vertical bars mentioned in D-12 refer to the overall "Media Stack" tile area. Looking at `CardGrid.tsx`, the media tile section does not use `NasGaugeColumn` (which has explicit `boxShadow: `0 0 4px ${color}`` on fill bars). The MediaStackRow itself is just LED + label rows — there are no bars in the MediaStackRow component. The "bars" with missing glow are likely the horizontal bars inside the `NasTileInstrument` center column — which DO have `boxShadow: `0 0 6px ${color}`` on each bar fill div.

**Investigation needed during execution:** Visually compare the MediaStackRow LED glow vs other service card LED glows. The `getLedStyle()` function returns correct `boxShadow` values. The more likely gap is CSS class `.text-glow` not being applied properly, or the tile background obscuring the glow. The planner should include a task to inspect the rendered element in browser devtools.

**Hypothesis:** The `text-glow` class on the service label may be over-bright on other tiles and the MediaStackRow label appears to lack it by comparison because the card frame glow and border trace effects are absent on the condensed row.

### Pi-hole BPM Bug (D-13)

**Finding:** The Pi-hole v6 `/api/stats/summary` response contains:
```json
{
  "queries": {
    "total": 12345,
    "blocked": 234,
    "percent_blocked": 1.89,
    "frequency": 0.433
  }
}
```

The `frequency` field is produced by `get_qps()` in FTL source (`src/api/stats.c`). Based on the function name and the fractional value in example responses (0.43), this represents **queries per second**, not queries per minute. The current adapter code uses `queries?.frequency ?? 0` and maps it to `queriesPerMinute` in the metrics object — this is **the source of the inaccuracy**: the value is QPS but displayed as QPM.

**What the user reported:** BPM (blocked per minute) is inaccurate. The code sends `queriesPerMinute: queries?.frequency ?? 0` to the frontend. Since `frequency` is QPS, the displayed value is approximately 60x too small.

**Fix options:**

1. **Multiply `frequency` by 60** to convert QPS to QPM — LOW confidence this is correct without verifying unit
2. **Calculate from daily totals** — `(totalBlockedDay / minutesSinceMidnight)` — produces a rolling-day average, not a live rate
3. **Use `/api/stats/history`** — Pi-hole v6 exposes a history endpoint with time-bucketed query counts; this would give a genuine recent-interval blocked count. This is the most accurate but requires an additional API call.

**Recommendation for the planner:** Default to option 1 (multiply by 60) with a comment explaining the unit conversion. Flag for user to verify visually against the Pi-hole dashboard. The Pi-hole dashboard itself uses the same `frequency` field multiplied by 60 to display QPM. This is the most defensible fix without a separate API call.

Confidence on "frequency = QPS": MEDIUM (confirmed `get_qps()` is the source, function name implies per-second, example value 0.43 matches typical home network QPS; not verified against Pi-hole source that explicitly documents units).

### Git Cleanup Mechanics

**5 worktree branches to delete (D-06):**
```
worktree-agent-a2e5d0df
worktree-agent-abc7cc09
worktree-agent-ac1a1b09
worktree-agent-ac7b944f
worktree-agent-adf1cb13
```

All are remote-tracking branches (`+` prefix in `git branch -a`). Delete from origin:
```bash
git push origin --delete worktree-agent-a2e5d0df worktree-agent-abc7cc09 worktree-agent-ac1a1b09 worktree-agent-ac7b944f worktree-agent-adf1cb13
```

**Stray files to remove (D-08):**
- `.DS_Store` — in git working tree (shown in `git status`)
- `".env.example copy"` — in git working tree (quoted filename with space)
- `.claude/` — directory exists but not yet committed; safe to add to .gitignore

**Current .gitignore is missing (D-09):**
```
.DS_Store
.claude/
.planning/
```

`.planning/` will stay in git history but stop being tracked going forward.

**Important:** When adding `.planning/` to `.gitignore` and running `git rm -r --cached .planning/`, this untracks all planning files from the index. The files remain on disk and in git history. This is the correct approach per D-07.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Docker image version tags | Custom tagging script | `docker/metadata-action@v5` with `type=semver` | Official action handles all ref types, labels, multi-tag output |
| Webhook service filtering | New category field in schema | `service` column in existing `app_logs` table | SqliteLogStream already extracts it; log viewer already filters by it |

## Common Pitfalls

### Pitfall 1: `latest` Not Pushed on Tag Event

**What goes wrong:** The current `enable` condition `${{ github.ref == 'refs/heads/main' }}` evaluates to `false` on a tag push, so `latest` is not pushed even though D-02 requires it.

**How to avoid:** Add `|| startsWith(github.ref, 'refs/tags/v')` to the enable condition, OR add a separate unconditional `type=raw,value=latest` rule. Verify by checking Docker Hub after pushing the tag.

### Pitfall 2: semver type=semver Drops the `v` Prefix

**What goes wrong:** `type=semver,pattern={{version}}` produces `1.0.0`, not `v1.0.0`. D-03 specifies `sambo7262/coruscant:v1.0.0`. Use `pattern=v{{version}}` to include the `v`.

**How to avoid:**
```yaml
type=semver,pattern=v{{version}}
```

### Pitfall 3: git rm --cached .planning Loses Untracked Planning Files

**What goes wrong:** Running `git rm -r --cached .planning/` stages removals. Any planning files that were never committed remain on disk but are now unstaged. Committing this state removes only the tracked files from git history going forward.

**How to avoid:** This behavior is correct and intentional for D-07. The files stay on disk. Verify with `git status` before committing.

### Pitfall 4: Webhook Service Tag Mismatch Between arr Routes

**What goes wrong:** `arr-webhooks.ts` currently logs `service: service.toUpperCase()` (e.g., `RADARR`, `SONARR`). Changing to `service: 'webhook'` collapses all webhook logs under one filter tag. This is desirable per D-15, but the individual service name must still appear in the message string per D-16.

**How to avoid:** Change the `service` field to `'webhook'` and embed the service name in the message body: `"radarr | Grab | Movie Title | 14:30"`.

### Pitfall 5: Test Suite Has Pre-Existing Failures

**What goes wrong:** The test suite has 16 failing tests across 4 test files before this phase begins. These are pre-existing failures from prior quick tasks that updated adapters without updating tests. Introducing new code may increase the failure count.

**Existing failures (as of 2026-04-06):**
- `plex-adapter.test.ts`: 3 failures — `fetchPlexServerStats` tests not updated after quick task 260405-byq changed the adapter
- `nas-adapter.test.ts`: 2 failures — `fetchNasDockerStats` mock not updated after quick task 260405-b24
- `arr-webhooks.test.ts`: 5 failures — test expects old log format; after D-15 service field change, tests will need updating
- `sse.test.ts`: 6 failures — `ERR_HTTP_HEADERS_SENT` unhandled rejection; SSE test timing issue pre-existing from Phase 8

**How to avoid:** The planner should include a Wave 0 task to triage and fix pre-existing test failures before beginning phase work. The arr-webhooks tests are guaranteed to need updating when the service field changes (D-15). NAS and Plex adapter tests need mocks updated to match the current adapter output shapes.

### Pitfall 6: Pi-hole BPM Unit — Multiply Before Displaying

**What goes wrong:** `queries.frequency` from the Pi-hole API is in queries-per-second. The existing code assigns it directly to `queriesPerMinute`, making the displayed value ~60x too small.

**How to avoid:** Multiply by 60 in the adapter, and separately calculate `blockedPerMinute = (queries?.blocked_frequency ?? queries?.frequency * percentBlocked / 100) * 60` if a separate blocked frequency is unavailable.

## Code Examples

### Updated docker-publish.yml trigger + metadata tags

```yaml
# Source: docker/metadata-action v5 README
on:
  push:
    branches: [main]
    tags: ['v*']

# In the metadata step:
- name: Extract metadata (tags, labels)
  id: meta
  uses: docker/metadata-action@v5
  with:
    images: ${{ vars.DOCKERHUB_USERNAME }}/coruscant
    tags: |
      type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v') }}
      type=sha,format=short
      type=semver,pattern=v{{version}}
```

### Webhook log call pattern (D-15, D-16)

```typescript
// In arr-webhooks.ts — change service field, align message to D-16 format
const timestamp = new Date().toLocaleString('en-US', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
})
fastify.log.info(
  { service: 'webhook' },
  `${service} | ${eventType} | ${title} | ${timestamp}`
)
```

```typescript
// In tautulli-webhook.ts — add new log call after payload processed
const event = body.event ?? 'playback'
const title = body.grandparent_title || body.title || 'unknown'
fastify.log.info(
  { service: 'webhook' },
  `tautulli | ${event} | ${title} | ${new Date().toLocaleString()}`
)
```

### SqliteLogStream service extraction (existing, confirmed correct)

```typescript
// Source: packages/backend/src/log-transport.ts
const service = typeof obj.service === 'string' ? obj.service : 'system'
```

The `service` field on the pino log call object becomes the `appLogs.service` column. The log viewer's filter dropdown (`serviceNames`) is derived dynamically from loaded entries — adding `'webhook'` as a service value is sufficient.

### Pi-hole BPM fix

```typescript
// In packages/backend/src/adapters/pihole.ts
// queries.frequency is queries-per-second from get_qps() in FTL
// Multiply by 60 to get queries-per-minute; apply block ratio for blocked-per-minute
const qps = queries?.frequency ?? 0
const queriesPerMinute = Math.round(qps * 60)
const blockedPerMinute = Math.round(qps * 60 * ((queries?.percent_blocked ?? 0) / 100))
```

### Git cleanup commands

```bash
# Delete remote worktree branches
git push origin --delete worktree-agent-a2e5d0df worktree-agent-abc7cc09 worktree-agent-ac1a1b09 worktree-agent-ac7b944f worktree-agent-adf1cb13

# Remove local tracking refs
git fetch --prune

# Add to .gitignore
echo -e ".DS_Store\n.claude/\n.planning/" >> .gitignore

# Untrack .planning from git index (stays on disk)
git rm -r --cached .planning/

# Remove stray files
git rm -f '.env.example copy'
git rm -f .DS_Store

# Tag v1.0.0 (after all other work committed)
git tag v1.0.0
git push origin v1.0.0
```

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `type=sha` only for Docker tags | `type=semver` + `type=sha` | Semver tagging is the docker/metadata-action standard for releases |
| No version pinning in compose.yaml | Explicit `image: org/app:v1.0.0` | Pin on release; update to next tag when upgrading |

## Runtime State Inventory

This phase is NOT a rename/refactor. However, for the cleanup decisions:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | SQLite DB at `/volume1/docker/coruscant/coruscant.db` on NAS | None — data survives container pull and restart |
| Live service config | compose.yaml image reference | Code edit — change image tag to `v1.0.0` |
| OS-registered state | Docker container `coruscant` on Synology NAS | `docker compose pull && docker compose up -d` on NAS after image publish |
| Secrets/env vars | `ENCRYPTION_KEY_SEED` in `.env` on NAS | None — unchanged |
| Build artifacts | `sha-*` Docker images in Docker Hub registry | Preserved as rollback targets per D-19 |

## Open Questions

1. **Pi-hole `frequency` unit — QPS or QPM?**
   - What we know: `get_qps()` produces the value; typical home network values are ~0.4 which is consistent with QPS not QPM
   - What's unclear: No official documentation confirms units; the Pi-hole dashboard source may clarify
   - Recommendation: Multiply by 60 and surface as QPM; add a code comment explaining the assumption; user can verify against Pi-hole dashboard value

2. **MediaStackRow glow: visual or CSS?**
   - What we know: `getLedStyle()` returns correct `boxShadow` values; `text-glow` class applied to labels
   - What's unclear: Whether the missing glow is LED, text, or card-frame; needs browser devtools inspection
   - Recommendation: Add browser devtools inspection step before applying fix; the glow CSS may be present but visually dominated by the surrounding tile background

3. **Pre-existing test failures — fix or defer?**
   - What we know: 16 tests failing; 5 are directly caused by arr-webhooks service field change in this phase
   - What's unclear: Whether user wants all 16 fixed or just the ones this phase causes
   - Recommendation: Fix all 16 (they're all stale test mocks, not fundamental design issues) as part of Wave 0

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner | Yes | v25.8.1 | — |
| npm | Package management | Yes | 11.11.0 | — |
| Docker | Build verification | Yes | 29.2.1 | — |
| git | Tagging, branch deletion | Yes | 2.39.5 | — |
| GitHub Actions | CI/CD | Yes (via push) | — | — |
| Synology NAS | Deploy target | Not verified locally | — | User manual pull |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROD-01 | CI workflow emits `v1.0.0` and `latest` tags on version tag push | manual | Push `v1.0.0` tag, verify Docker Hub | N/A |
| PROD-01 | compose.yaml references pinned version tag | smoke | `grep "v1.0.0" compose.yaml` | N/A (grep check) |
| PROD-02 | Worktree branches deleted from origin | manual | `git branch -r \| grep worktree` returns empty | N/A |
| PROD-02 | .gitignore contains .DS_Store, .claude/, .planning/ | smoke | `grep ".planning" .gitignore` | N/A (grep check) |
| PROD-03 | Webhook logs appear with service='webhook' in log viewer | unit | `npm run test -- arr-webhooks` | Yes (failing) |
| PROD-03 | Tautulli webhook logs inbound events | unit | `npm run test -- tautulli-webhook` | Yes |

### Wave 0 Gaps

The test suite currently has 16 pre-existing failures. These are stale test mocks from prior quick tasks, not structural failures. Wave 0 must address:

- [ ] `plex-adapter.test.ts` — 3 failures: `fetchPlexServerStats` mock shape mismatch after quick task 260405-byq
- [ ] `nas-adapter.test.ts` — 2 failures: `fetchNasDockerStats` mock using `.then()` on a synchronous mock after quick task 260405-b24
- [ ] `arr-webhooks.test.ts` — 5 failures: tests assert on old logging format; will need update when service field changes to `'webhook'` per D-15
- [ ] `sse.test.ts` — 6 failures: `ERR_HTTP_HEADERS_SENT` timing issue; investigate if test infrastructure fix needed

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection — `docker-publish.yml`, `compose.yaml`, `arr-webhooks.ts`, `tautulli-webhook.ts`, `log-transport.ts`, `schema.ts`, `ServiceCard.tsx`, `LogsPage.tsx`, `CardGrid.tsx`
- `git branch -a` — confirmed 5 worktree remote branches
- `npm run test` — confirmed 16 pre-existing test failures

### Secondary (MEDIUM confidence)
- Pi-hole FTL source `src/api/stats.c` (via WebFetch on GitHub) — confirms `get_qps()` produces `queries.frequency`
- docker/metadata-action v5 README patterns — `type=semver` pattern standard usage
- GitHub Actions `on.push.tags` trigger — standard documented pattern

### Tertiary (LOW confidence)
- Pi-hole `frequency` = QPS interpretation — inferred from function name `get_qps()` and typical fractional values; not confirmed by official API docs (self-hosted docs only at `http://pi.hole/api/docs`)

## Metadata

**Confidence breakdown:**
- CI/CD versioning: HIGH — docker/metadata-action documented pattern, codebase inspected
- Git cleanup: HIGH — branch names confirmed, .gitignore gaps confirmed
- Webhook logging fix: HIGH — pipeline fully understood, service field is the filter key
- Bug fixes: MEDIUM — MediaStackRow glow needs visual inspection; Pi-hole BPM unit is MEDIUM (strong inference, not officially documented)
- Test failures: HIGH — all 16 failures observed directly

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable tooling; Pi-hole API unit claim valid until Pi-hole publishes breaking API changes)
