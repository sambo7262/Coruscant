---
phase: quick-260405-1of
plan: "01"
subsystem: backend/debug
tags: [debug, synology, docker-stats, api-discovery]
dependency_graph:
  requires: []
  provides: [discovery field in /debug/docker-stats, attemptsWithType field in /debug/docker-stats]
  affects: [packages/backend/src/routes/debug.ts]
tech_stack:
  added: []
  patterns: [SYNO.API.Info query for Synology API spec discovery]
key_files:
  modified:
    - packages/backend/src/routes/debug.ts
decisions:
  - "/debug/docker-stats now returns { discovery, attempts, attemptsWithType } — discovery holds raw SYNO.API.Info response revealing exact required params; attemptsWithType retries with type=all to resolve error 114 (missing required param)"
metrics:
  duration: ~3m
  completed: 2026-04-05
  tasks: 1
  files: 1
---

# Quick 260405-1of Plan 01: SYNO.API.Info Discovery and type=all Retry Summary

**One-liner:** Added SYNO.API.Info discovery pass and type=all retry to /debug/docker-stats so exact Synology API parameter requirements are exposed without guessing.

## What Was Built

Extended the `/debug/docker-stats` debug endpoint with two new diagnostic steps:

1. **Discovery (Step 2):** Calls `SYNO.API.Info` with `query=SYNO.Docker` to fetch the full API spec for all SYNO.Docker.* namespaces. The raw response is returned under the `discovery` key. This reveals which methods exist, what version ranges they support, and critically — what required parameters they expect.

2. **type=all retry (Step 4):** Duplicates the existing container list attempts but adds `type: 'all'` to each request's params. Error 114 ("required parameter missing") is the most common failure mode; `type` is the most commonly omitted required param for container list endpoints. Results appear under `attemptsWithType`.

The existing `attempts` array (Step 3, no type= param) is preserved unchanged.

**Response shape:**
```json
{
  "discovery": { ... },       // raw SYNO.API.Info response for SYNO.Docker.*
  "attempts": [ ... ],        // original list calls without type=
  "attemptsWithType": [ ... ] // same list calls with type=all added
}
```

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add SYNO.API.Info discovery and type=all retry to /debug/docker-stats | 64e3559 | packages/backend/src/routes/debug.ts |

## Verification

TypeScript build (`npm run build --workspace=packages/backend`) passes with no errors or warnings.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- packages/backend/src/routes/debug.ts: EXISTS
- Commit 64e3559: EXISTS (`git log --oneline | grep 64e3559`)
