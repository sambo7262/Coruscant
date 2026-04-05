---
status: awaiting_human_verify
trigger: "nas.docker is always undefined despite 19 containers running on the Synology NAS"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — three compounding defects cause silent undefined return
test: Fix applied, tsc --noEmit passes, 8/8 nas-adapter tests pass
expecting: Docker stats will populate OR backend logs will now show exactly which API path/shape is wrong
next_action: Human deploys updated backend and verifies Docker stats appear in AppHeader

## Symptoms

expected: AppHeader Docker section shows aggregated CPU%, RAM%, network across running containers
actual: nas.docker is always undefined — placeholder "--" shown permanently
errors: No error thrown — fetchNasDockerStats silently returns undefined
reproduction: App is running, NAS is connected (nas.cpu/ram/disks all populate fine), but docker field is always undefined
started: Never worked — added in Phase 5 plan 05-01

## Eliminated

- hypothesis: Status string wrong ('running' vs 'up' etc.) is the sole cause
  evidence: Wrong status would produce { cpuPercent: 0, ... } not undefined, since the running.length === 0 branch returns a zero object, not undefined
  timestamp: 2026-04-04

- hypothesis: API namespace is entirely wrong (no valid namespace tried)
  evidence: SYNO.Docker.Container and SYNO.ContainerManager.Container are the two correct namespaces per DSM 6 vs DSM 7.2 split — both are valid candidates
  timestamp: 2026-04-04

## Evidence

- timestamp: 2026-04-04
  checked: fetchNasDockerStats catch block (line 246-248)
  found: catch block catches ALL exceptions and returns undefined with no logging
  implication: Any error — network, permission denied (error code 115), invalid session, unexpected shape — is swallowed silently. Cannot distinguish cause without logging.

- timestamp: 2026-04-04
  checked: Response key check (line 214): response.data?.data?.containers
  found: Function only proceeds if response contains data.data.containers (plural). If the API returns the array under a different key (e.g., data.data.items, data.data.container singular, or data.containers without inner nesting), this check fails and the loop continues to the next namespace, ultimately returning undefined.
  implication: This is the most likely structural defect for Container Manager on DSM 7.x — Synology changed the package from Docker to Container Manager and the response shape may differ.

- timestamp: 2026-04-04
  checked: Status filter (line 224): c.status === 'running'
  found: Even if containers are retrieved successfully, if the status field uses a different value ('Up', 'started', 'RUNNING') this produces empty running[] array and returns zero-object, not undefined. However, per community findings, Docker uses 'running' as the standard status string from the Docker daemon, so this is lower risk.
  implication: Should still be made more defensive with case-insensitive check.

- timestamp: 2026-04-04
  checked: CPU/memory field names (lines 229-232): cpu_usage, memory_usage, memory_limit, up_bytes, down_bytes
  found: These field names are assumptions. The Synology Container Manager API wraps the Docker daemon and may use different field names than the standard Docker stats API (e.g., cpu_percent vs cpu_usage, mem_usage vs memory_usage).
  implication: Even if containers are found, stats fields may all be undefined, producing NaN or 0 in calculations — but would NOT return undefined at the function level.

- timestamp: 2026-04-04
  checked: pollNas call site (line 104)
  found: fetchNasDockerStats is called with .catch(() => undefined), meaning any throw is also caught. The function itself also has a catch-return-undefined. Double-wrapped silence.
  implication: Confirms there is zero visibility into why docker stats fail.

## Resolution

root_cause: Three compounding defects in fetchNasDockerStats: (1) response data key check used only 'containers' — if the Container Manager API returns the array under 'items' or 'container', the check silently falls through to the next namespace and eventually returns undefined; (2) the catch block swallowed all errors with no logging, making it impossible to distinguish permission denied, wrong namespace, or wrong response shape; (3) no version fallback was tried for SYNO.ContainerManager.Container (version 2 added in DSM 7.2).
fix: Replaced single-shot per-namespace request with a 3-entry loop covering SYNO.Docker.Container v1, SYNO.ContainerManager.Container v1, and SYNO.ContainerManager.Container v2. Per-request errors are caught individually and logged then skipped (continue). success=false responses are logged with the error payload. Container array extraction tries 'containers', 'items', and 'container' keys; if none match, logs the actual data keys so the real shape can be diagnosed. Status check is now case-insensitive and accepts both 'running' and 'up*'. CPU/mem/network fields use multi-key fallback helpers to handle alternate field names.
verification: tsc --noEmit clean. 8/8 nas-adapter unit tests pass. Awaiting live NAS verification.
files_changed: [packages/backend/src/adapters/nas.ts]
