---
plan: 05-01
phase: 05-ui-v2-instrument-panel-polish
status: complete
completed: 2026-04-05
key-files:
  created:
    - packages/shared/src/types.ts
    - packages/backend/src/adapters/sabnzbd.ts
    - packages/backend/src/adapters/plex.ts
    - packages/backend/src/adapters/nas.ts
    - packages/backend/src/__tests__/sabnzbd-adapter.test.ts
    - packages/backend/src/__tests__/plex-adapter.test.ts
    - packages/backend/src/__tests__/nas-adapter.test.ts
---

## What Was Built

Extended the backend data layer with three sets of missing fields needed by Phase 5 frontend plans:

**Task 1 — Shared types + SABnzbd/Plex adapters (26 tests)**
- `SabnzbdMetrics` now includes `currentFilename` and `timeLeft` extracted from the first non-Failed queue slot
- `PlexStream` now includes `mediaType` ('audio'|'video'), `albumName`, and `trackTitle`
- Audio Plex streams return codec-based quality strings (e.g. "FLAC 1411k") instead of video resolution
- `PlexMetadataItem` extended with `parentTitle` and `Media[].audioCodec/bitrate`

**Task 2 — NAS Docker stats + hardened image update detection (8 tests)**
- New `fetchNasDockerStats` function queries `SYNO.Docker.Container` (fallback: `SYNO.ContainerManager.Container`) and aggregates CPU %, RAM %, and network bytes across running containers
- `pollNas` now includes Docker stats in its parallel call set — `NasStatus.docker` is populated
- `checkNasImageUpdates` now tries both Docker and ContainerManager namespaces across API versions 1 and 2, and checks `is_update_available`, `canUpgrade`, and `upgrade_available` field names

## Self-Check: PASSED

- All 34 tests pass (26 SABnzbd+Plex, 8 NAS)
- TypeScript compiles (types.ts changes are additive/optional fields only)
- No breaking changes to existing consumers

## Decisions

- Used `grandparentTitle` (artist) and `parentTitle` (album) from Plex metadata — trackTitle maps to `item.title`, albumName to `item.parentTitle`
- Docker stats network fields are cumulative bytes, not rates — displayed as MB totals for now (rate derivation deferred)
- `fetchNasDockerStats` is exported separately so it can be called independently if needed later
