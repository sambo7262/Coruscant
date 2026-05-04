# Phase 22: NAS Process Monitor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 22-nas-process-monitor
**Areas discussed:** AI model & cost, Diagnostic trigger & UI, Process data collection, Result quality & format

---

## Approach Decision (pre-gray-area)

The original phase scope was "AI-powered NAS CPU diagnostic" with an LLM budget of ~$0.01/request. During discussion, user asked for an honest feasibility assessment.

**Analysis presented:**
- DSM API provides real process lists — the LLM would be translating, not guessing
- But for processes like `postgres`, the LLM can't see deeper than the process name (no query-level insight)
- Static lookup table gives 90% of the value for 0% of the cost
- AI adds natural language veneer but can't access data that would make it genuinely smarter

**User's decision:** Drop AI/LLM entirely. Build static label lookup with DSM process list. No external dependencies.

| Approach | Considered | Selected |
|----------|-----------|----------|
| AI (Claude Haiku) per request | Yes — original scope | |
| Static lookup table | Yes — user preferred | ✓ |
| Hybrid (static + AI fallback) | Yes — offered as middle ground | |

**Rationale:** User wants to avoid external dependencies. Static lookup provides the same actionable information (process name + CPU %) that Resource Monitor shows, just surfaced on the dashboard with human-readable labels.

---

## Requirements Updated

NAS-01 and NAS-02 rewritten to remove AI/LLM references. Phase renamed from "NAS CPU Diagnostic" to "NAS Process Monitor". Out of Scope updated.

---

## Claude's Discretion

- CPU threshold for tap affordance (~30%)
- Usage bar styling within cockpit aesthetic
- Whether to show runtime/memory alongside CPU %
- Loading/stale states for on-demand fetch
- iPhone responsive layout

## Deferred Ideas

- Docker container-level CPU breakdown (PID → container mapping)
- Process kill/restart from dashboard
- Historical process CPU trends
