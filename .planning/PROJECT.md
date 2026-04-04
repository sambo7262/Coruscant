# Coruscant

## What This Is

Coruscant is a self-hosted home infrastructure monitoring hub running on a Synology NAS via Docker. It aggregates health and activity data from all home services — media apps, NAS hardware, network equipment, and smart home devices — into a single mobile-first web dashboard. Instead of navigating five different apps, everything is visible at a glance with real-time status, alerts, and drill-down detail views.

## Core Value

A single glance from a phone tells you whether your home infrastructure is healthy or needs attention.

## Requirements

### Validated

**Settings & Configuration** *(Validated in Phase 03)*
- [x] Settings pages to configure service connection endpoints, credentials, and API keys — encrypted with AES-256-GCM at rest

**Service Monitoring — Status Only** *(Validated in Phase 03)*
- [x] Radarr — up/down/warning status (live, polling every 45s)
- [x] Sonarr — up/down/warning status (live, polling every 45s)
- [x] Lidarr — up/down/warning status (live, polling every 45s)
- [x] Bazarr — up/down status (live, polling every 45s)
- [x] Prowlarr — up/down/warning status (live, polling every 45s)
- [x] Readarr — up/down/warning status (live, polling every 45s)

**Service Monitoring — Activity** *(Validated in Phase 03)*
- [x] SABnzbd — up/down + active download queue, speed, progress, failed items (live, polling every 10s)

### Active

**Infrastructure & Deployment**
- [ ] Runs as a Docker Compose project on Synology NAS Container Manager
- [ ] Docker images built and versioned via a self-hosted registry, managed through GitHub
- [ ] Accessible via local IP/port; external access via existing Tailscale tunnel (no port forwarding required)

**Dashboard — Core**
- [ ] Mobile-first web dashboard accessible in any browser
- [ ] Tiered service cards: status-only (red/blue/amber dot), activity (progress bar), and rich data (charts/graphs)
- [ ] Tron/Grid visual language: animated grid background with traveling light pulses, glowing pulsing components, animated card border traces, scan/flicker effects — the UI feels alive, not static
- [ ] Color system: Tron Blue `#00c8ff` = healthy, Red `#ff4444` = down/critical, Amber `#ffaa00` = warning, Dim Blue `#004466` = chrome, Near-Black `#0a0a0f` = background
- [ ] Scrolling "Now Playing" banner (top or bottom) showing active Plex streams
- [ ] Click-through from dashboard card to detailed service view

**Service Monitoring — Status Only**
- [ ] Radarr — up/down status
- [ ] Sonarr — up/down status
- [ ] Lidarr — up/down status
- [ ] Bazarr — up/down status

**Service Monitoring — Activity**
- [ ] SABnzbd — up/down + active download queue, progress bars, error states

**Service Monitoring — Rich Data**
- [ ] Pi-hole — DNS query stats, blocklist hit rate, upstream response times
- [ ] Plex Media Server — active streams, transcoding load, server health
- [ ] Synology NAS — CPU usage, RAM usage, storage per volume, disk temps, fan speeds
- [ ] Ubiquiti network equipment — device status, throughput, client counts

**Smart Home (research & include what's feasible)**
- [ ] Google Nest — status/presence indicators
- [ ] Amazon Ring — doorbell/camera status, recent event indicators

**Notifications**
- [ ] Pushover notifications when configurable thresholds are breached
- [ ] Per-service threshold configuration (e.g., NAS storage > 85%, CPU > 90%)

**Logging**
- [ ] Centralized application log viewer within the UI
- [ ] Log management: purge and export capabilities

**Settings & Configuration**
- [ ] Settings pages to configure service connection endpoints, credentials, and API keys
- [ ] Threshold configuration UI for notification triggers

### Out of Scope

- Opening firewall ports for external access — Tailscale handles this entirely
- Replacing the individual apps' own UIs — Coruscant monitors, not controls
- Cloud hosting — NAS-local deployment only for v1

## Context

- **Deployment target**: Synology NAS running DSM with Container Manager (Docker Compose)
- **External access**: Tailscale mesh network already in place; no app-level tunnel config needed
- **Docker registry**: Self-hosted registry; images tagged and versioned via GitHub repo
- **Existing services monitored**: Radarr, Sonarr, Lidarr, Bazarr, SABnzbd, Pi-hole, Plex, Ubiquiti gear, Synology NAS, Google Nest, Amazon Ring
- **Monitoring depth**: Deep API integration for key services (Plex, Radarr/Sonarr, Pi-hole, Ubiquiti, NAS); basic up/down for simpler services
- **Notification channel**: Pushover (user already uses this)
- **Primary usage**: Mobile phone, daily glance — secondary is desktop browser

## Constraints

- **Platform**: Must run in Docker Compose on Synology NAS Container Manager — no exotic runtime dependencies
- **Network**: App must work on LAN; Tailscale provides WAN access transparently
- **Registry**: Images pulled from user's own self-hosted Docker registry
- **Privacy**: All data stays local — no cloud telemetry, no external API calls except to services the user controls

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tron/Neon Grid aesthetic with living animations | User wants the UI to feel alive — light traveling through grids, pulsing glows, animated border traces, not just Tron colors on a static layout | — Pending |
| Tron Blue (`#00c8ff`) as healthy state instead of green | More on-brand with Tron world; green would break the Grid aesthetic | — Pending |
| Tiered monitoring depth (status / activity / rich) | Different services warrant different levels of UI real estate and API integration complexity | — Pending |
| Smart home services (Nest, Ring) research-and-include | Feasibility unknown; include what works, skip what doesn't | — Pending |
| Pushover for notifications | User's existing notification stack | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-04 — Phase 03 complete (settings + media stack adapters live)*
