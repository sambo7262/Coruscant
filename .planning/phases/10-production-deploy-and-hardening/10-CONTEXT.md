# Phase 10: Production Deploy + Hardening - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Semantic v1.0 release of an already-running app. The app is deployed and working on the Synology NAS — this phase is about: tagging v1.0, fixing known + discovered bugs, improving logging for ongoing debugging, and cleaning up the repo for long-term maintenance.

This is NOT a first deploy. The user has been testing and deploying on the NAS throughout development.

</domain>

<decisions>
## Implementation Decisions

### Versioning & Tagging
- **D-01:** Manual `git tag v1.0.0` pushed to origin triggers CI to build versioned image
- **D-02:** CI pushes both `v1.0.0` AND `latest` tags to Docker Hub
- **D-03:** compose.yaml updated to pin image to version tag (e.g., `sambo7262/coruscant:v1.0.0`) instead of `${IMAGE_TAG:-latest}`
- **D-04:** No CHANGELOG.md — git history and .planning/ artifacts are sufficient documentation
- **D-05:** CI workflow updated to detect version tags (`v*`) and build versioned images from them

### Git Cleanup
- **D-06:** Delete all 5 `worktree-agent-*` branches and `.claude/worktrees/` directories
- **D-07:** `.planning/` gitignored going forward (stays in history but no longer tracked)
- **D-08:** Clean up stray files: `.DS_Store`, `.env.example copy`, `.claude/` directory
- **D-09:** Add `.DS_Store`, `.claude/`, `.planning/` to `.gitignore`
- **D-10:** Keep full git history — no squashing. Tag v1.0.0 on current HEAD.

### Final Bug Pass
- **D-11:** Fix known bugs (user-reported) + Claude-identified bugs found during code review
- **D-12:** Known bug: Media stack LEDs and bars missing glow effect that other tiles have
- **D-13:** Known bug: Pi-hole "blocked per minute" (BPM) metric is inaccurate. Prefer pulling a direct metric from Pi-hole v6 API (e.g., blocked queries from last interval) rather than calculating a rate. Researcher should check what Pi-hole v6 API exposes directly.
- **D-14:** Claude should actively look for bugs during execution and report them back to the user

### Logging Hardening
- **D-15:** All inbound webhook POSTs (arr services + Tautulli) logged as a dedicated 'webhook' category, filterable in the log viewer
- **D-16:** Webhook log format: service name + event type + timestamp (e.g., "radarr | Grab | Movie Title | 2026-04-06 14:30") — concise and scannable
- **D-17:** Ensure existing error logging produces legible, actionable messages a user can understand at a glance

### Deploy Verification
- **D-18:** Minimal verification: pull image, compose up, open in browser, confirm it loads. No formal smoke test checklist.
- **D-19:** Rollback via previous `sha-*` tag in Docker Hub — change compose.yaml to the prior sha tag and redeploy if v1.0 has issues
- **D-20:** This is a semantic release — the app is already live on the NAS. No first-deploy procedures needed.

### Claude's Discretion
- Claude identifies additional bugs during code review and reports them to the user before fixing
- Claude decides the specific .gitignore entries and cleanup order
- Claude determines the best way to wire webhook logging into the existing pino + SqliteLogStream pipeline

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CI/CD & Deployment
- `.github/workflows/docker-publish.yml` — Current CI pipeline; needs version tag support added
- `compose.yaml` — Production compose file; needs image ref updated to pinned version
- `Dockerfile` — Multi-stage build; already production-ready
- `.env.example` — Environment variable documentation for deployment

### Logging
- `packages/backend/src/index.ts` — pino.multistream setup (stdout + SqliteLogStream)
- `packages/backend/src/db/schema.ts` — app_logs table schema (verify category/level fields)

### Webhook Routes
- `packages/backend/src/routes/` — arr webhook routes and Tautulli webhook routes (where webhook logging needs to be added)

### Pi-hole
- `packages/backend/src/adapters/pihole.ts` — Pi-hole v6 adapter; BPM calculation logic to review

### Frontend
- `packages/frontend/src/components/ServiceCard.tsx` — MediaStackRow glow styling to fix
- `packages/frontend/src/components/CardGrid.tsx` — Grid layout with MEDIA tile

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- pino logger with SqliteLogStream transport — webhook logging can piggyback on this pipeline
- Log viewer UI (LogsPage) with service/level filters — adding a 'webhook' category filter should be straightforward
- `.github/workflows/docker-publish.yml` — existing CI with multi-arch build, QEMU, Buildx

### Established Patterns
- Logging: pino.multistream → stdout + SqliteLogStream; structured JSON logs
- Webhook routes: each service registers its own Fastify plugin with content-type parser
- LED glow: CSS `box-shadow` and `filter: drop-shadow()` on StatusDot and vertical bar components

### Integration Points
- CI workflow: add `on.push.tags` trigger for `v*` pattern
- compose.yaml: change image reference from env var to pinned tag
- Webhook route handlers: add pino log calls with 'webhook' category
- Log viewer: add 'webhook' to the category filter dropdown

</code_context>

<specifics>
## Specific Ideas

- User emphasized this is "semantics only" — everything is already running. Keep the phase lightweight.
- User wants Claude to proactively find bugs and report them, not just fix the two known ones.
- Pi-hole BPM: user verified mem% and blocked% are accurate against Pi-hole directly. Only BPM is wrong. Check if Pi-hole v6 API provides a direct "recent blocked" count.
- Logging should help the user debug issues after v1.0 — seeing webhook flow is the primary use case.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-production-deploy-and-hardening*
*Context gathered: 2026-04-06*
