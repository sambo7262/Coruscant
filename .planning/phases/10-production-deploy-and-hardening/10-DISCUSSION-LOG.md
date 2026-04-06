# Phase 10: Production Deploy + Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 10-production-deploy-and-hardening
**Areas discussed:** Versioning & tagging strategy, Git cleanup scope, Final bug pass criteria, Deploy verification

---

## Versioning & Tagging Strategy

### How should v1.0 be tagged and released?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual git tag + CI builds | `git tag v1.0.0` and push; CI detects tag and builds versioned image | ✓ |
| GitHub Release with notes | GitHub Release UI creates tag + release page with changelog | |
| CI auto-tags on main | Every merge auto-increments a version tag | |

**User's choice:** Manual git tag + CI builds
**Notes:** None

### Should compose.yaml pin to a version tag or keep using latest?

| Option | Description | Selected |
|--------|-------------|----------|
| Pin to version tag | compose.yaml references e.g. `sambo7262/coruscant:v1.0.0` | ✓ |
| Keep using latest | Current behavior, `docker compose pull` always gets newest | |
| Both — latest + pinned | CI pushes both tags, compose.yaml pins to version | |

**User's choice:** Pin to version tag
**Notes:** None

### Should CI also push a latest tag alongside the version tag?

| Option | Description | Selected |
|--------|-------------|----------|
| Version tag only | CI pushes only `v1.0.0`, no `latest` | |
| Both version + latest | CI pushes `v1.0.0` AND updates `latest` | ✓ |
| You decide | Claude picks | |

**User's choice:** Both version + latest
**Notes:** None

### Do you want a CHANGELOG file?

| Option | Description | Selected |
|--------|-------------|----------|
| No changelog — git history is enough | Personal project, git log + planning artifacts sufficient | ✓ |
| Simple CHANGELOG.md | Brief hand-written changelog per release | |
| You decide | Claude picks | |

**User's choice:** No changelog
**Notes:** None

---

## Git Cleanup Scope

### Stale worktree branches?

| Option | Description | Selected |
|--------|-------------|----------|
| Delete all worktree branches | Remove 5 `worktree-agent-*` branches + `.claude/worktrees/` | ✓ |
| Leave them | They don't affect production | |
| You decide | Claude assesses | |

**User's choice:** Delete all worktree branches
**Notes:** None

### Should .planning/ stay in the repo?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep in repo | Valuable documentation history | |
| Gitignore it | Remove from tracking, keep code-focused | ✓ |
| Archive to a branch | Move to archive branch, gitignore on main | |

**User's choice:** Gitignore it
**Notes:** None

### Stray file cleanup?

| Option | Description | Selected |
|--------|-------------|----------|
| Clean all + add to .gitignore | Delete .DS_Store, .env.example copy, add all to .gitignore | ✓ |
| Just .gitignore, don't delete history | Stop tracking but keep history | |
| You decide | Claude handles | |

**User's choice:** Clean all + add to .gitignore
**Notes:** None

### Squash debug commits?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep full history | Every commit stays | ✓ |
| Squash per-phase | One commit per phase | |
| You decide | Claude decides | |

**User's choice:** Initially chose "Squash per-phase", then switched to "Keep full history" after learning it requires force-push rewriting all SHAs.
**Notes:** User reconsidered after understanding the force-push implications.

---

## Final Bug Pass Criteria

### How thorough should the pre-v1.0 bug pass be?

| Option | Description | Selected |
|--------|-------------|----------|
| Visual spot-check on kiosk + phone | Quick manual walkthrough, trust prior UAT | |
| Full regression test | Run all tests, check every card/tab | |
| Known issues only | Fix specific bugs, no exploratory testing | ✓ |

**User's choice:** Known issues only + Claude-identified bugs
**Notes:** User wants both — fix their known bugs AND have Claude proactively find/report bugs during execution

### Webhook log category?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated 'webhook' log category | All webhook POSTs logged with service, event type, payload summary | ✓ |
| Use existing service filter | Log under service name | |
| Both — service + webhook tag | Dual tagging | |

**User's choice:** Dedicated 'webhook' log category
**Notes:** User wants to filter on webhook events specifically to debug media/Tautulli webhook flows

### Webhook log detail level?

| Option | Description | Selected |
|--------|-------------|----------|
| Service + event type + timestamp | Concise, scannable one-liner | ✓ |
| Full payload dump | Entire JSON body | |
| Summary + link to full payload | One-line summary, click to expand | |

**User's choice:** Service + event type + timestamp
**Notes:** None

### Known bugs?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude identifies during execution | Let planner/executor find issues | ✓ |
| I'll list them now | User has specific bugs | ✓ |
| Check debug docs | Review .planning/debug/ files | |

**User's choice:** Both — Claude identifies + user listed:
1. Media stack LEDs and bars missing glow effect
2. Pi-hole BPM metric inaccurate — prefer direct API metric over calculated rate

---

## Deploy Verification

### How to verify production deploy?

| Option | Description | Selected |
|--------|-------------|----------|
| Smoke test checklist | Short formal checklist | |
| Just pull and check it loads | Minimal: compose pull+up, open browser | ✓ |
| You decide | Claude defines steps | |

**User's choice:** Just pull and check it loads
**Notes:** App is already live on NAS — this is a semantic release, not a first deploy

### Rollback plan?

| Option | Description | Selected |
|--------|-------------|----------|
| Previous SHA tag in Docker Hub | Change compose.yaml to prior sha tag | ✓ |
| No rollback plan needed | Fix forward | |
| Keep backup image locally | Docker save current image | |

**User's choice:** Previous SHA tag in Docker Hub
**Notes:** None

---

## Claude's Discretion

- Bug identification approach and reporting format
- .gitignore entries and cleanup order
- Webhook logging integration into existing pino pipeline

## Deferred Ideas

None — discussion stayed within phase scope
