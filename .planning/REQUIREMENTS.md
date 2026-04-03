# Requirements: Coruscant

**Defined:** 2026-04-02
**Core Value:** A single glance from a phone tells you whether your home infrastructure is healthy or needs attention.

## v1 Requirements

### Infrastructure & Deployment

- [x] **INFRA-01**: App runs as a Docker Compose project deployable via Synology NAS Container Manager
- [ ] **INFRA-02**: Docker images are built from a GitHub repo and pushed to the user's self-hosted registry; compose file references versioned image tags
- [x] **INFRA-03**: App is accessible in any browser via local IP and port
- [ ] **INFRA-04**: No app-level tunnel configuration required; Tailscale provides external access transparently

### Dashboard UI

- [ ] **DASH-01**: Main dashboard displays all monitored service cards in a mobile-first responsive grid layout, usable on both phone and desktop browser
- [ ] **DASH-02**: UI background renders an animated grid with traveling light pulses — the interface feels alive at rest, not static
- [ ] **DASH-03**: Service card borders animate with light traces running along their edges
- [ ] **DASH-04**: Health state components glow and pulse (slow breathing animation for healthy; sharp pulse for warning/alert)
- [ ] **DASH-05**: Color system applied consistently: Tron Blue `#00c8ff` = healthy/online, Red `#ff4444` = down/critical, Amber `#ffaa00` = warning/degraded
- [ ] **DASH-06**: Scrolling "Now Playing" banner displays active Plex streams (title, user, playback progress) at top or bottom of dashboard
- [ ] **DASH-07**: Tapping/clicking a service card navigates to a dedicated detail view for that service with expanded metrics
- [ ] **DASH-08**: All animations use `transform` and `opacity` only — no layout-triggering properties — to maintain 60fps on mobile

### Service Monitoring — Status Only

- [ ] **SVCST-01**: Radarr card shows up/down health state (Tron Blue = online, Red = unreachable, Amber = health warnings from API)
- [ ] **SVCST-02**: Sonarr card shows up/down health state
- [ ] **SVCST-03**: Lidarr card shows up/down health state
- [ ] **SVCST-04**: Bazarr card shows up/down health state
- [ ] **SVCST-05**: Status-tier services poll their `/api/v3/health` endpoints every 30–60 seconds

### Service Monitoring — Activity

- [ ] **SVCACT-01**: SABnzbd card shows up/down status, current download speed (MB/s), active queue item count, and animated progress bars for active downloads
- [ ] **SVCACT-02**: SABnzbd card displays amber error state when queue items have failed status
- [ ] **SVCACT-03**: SABnzbd polls at 5–15 second intervals to show live download progress

### Service Monitoring — Rich Data

- [ ] **SVCRICH-01**: Pi-hole card shows total DNS queries today, block percentage, and blocklist size; handles v5 and v6 API differences
- [ ] **SVCRICH-02**: Plex card shows active stream count, currently playing titles, playback state (playing/paused/buffering), and transcode vs direct-play indicators
- [ ] **SVCRICH-03**: NAS card shows CPU usage %, RAM usage %, and per-volume storage usage bars
- [ ] **SVCRICH-04**: NAS card shows per-disk temperatures and fan speed readings via Synology DSM API
- [ ] **SVCRICH-05**: Each rich-data service has a detail view with all available metrics expanded

### Network Monitoring

- [ ] **NET-01**: UniFi card shows active client count, WAN throughput (rx/tx), and overall network health state
- [ ] **NET-02**: UniFi card shows per-device status (APs, switches, gateways) with online/offline state
- [ ] **NET-03**: UniFi detail view lists all monitored devices with uptime, model, and connected client count
- [ ] **NET-04**: Backend manages UniFi cookie session lifecycle (login, re-auth on expiry)

### Notifications

- [ ] **NOTIF-01**: User can configure Pushover application token and user key in settings
- [ ] **NOTIF-02**: System sends Pushover notification when any monitored service transitions to offline/critical state
- [ ] **NOTIF-03**: User can configure per-service numeric thresholds (e.g., NAS storage volume > 85%, NAS CPU > 90%, SABnzbd queue errors)
- [ ] **NOTIF-04**: System sends Pushover notification when a configured threshold is breached
- [ ] **NOTIF-05**: Alert engine debounces notifications — repeated condition does not spam (configurable cooldown period)
- [ ] **NOTIF-06**: Pushover messages include service name, condition, current value, and a deep-link URL back to the Coruscant dashboard

### Logging

- [ ] **LOG-01**: App maintains internal structured logs covering poll events, errors, service state changes, and alert dispatches
- [ ] **LOG-02**: User can view logs in a dedicated log viewer page within the dashboard
- [ ] **LOG-03**: User can purge all logs or logs older than a selectable age from the UI
- [ ] **LOG-04**: User can export logs as a downloadable file from the UI

### Configuration & Settings

- [ ] **CFG-01**: Settings page lets user configure the base URL and API key for each service integration
- [ ] **CFG-02**: Settings page lets user configure per-service notification thresholds
- [ ] **CFG-03**: All settings are persisted to SQLite and survive app restarts and container restarts
- [ ] **CFG-04**: Each service configuration has a "Test Connection" action that validates the URL and credentials live

## v2 Requirements

### Dashboard Enhancements

- **DASH-V2-01**: Sparkline trend charts (in-memory rolling window, last 60 data points) for key metrics like NAS CPU, SABnzbd speed
- **DASH-V2-02**: Dashboard layout customization — drag-and-drop card reordering
- **DASH-V2-03**: Mobile PWA / home screen install support

### Notifications Enhancements

- **NOTIF-V2-01**: Additional notification channels (email, etc.) beyond Pushover

### Security

- **SEC-V2-01**: Optional PIN or password protection for the dashboard (Tailscale network-level auth is sufficient for v1)

## Smart Home Phase (Dedicated Late Phase)

These are isolated in their own phase due to complexity, OAuth requirements, and fragility of unofficial APIs.

- **SMRTH-01**: Google Nest thermostat card shows current temperature, humidity %, HVAC state (heating/cooling/off), and connectivity status
- **SMRTH-02**: Nest integration includes a one-time OAuth 2.0 setup wizard (SDM API, requires Google Cloud project + $5 Device Access enrollment)
- **SMRTH-03**: Amazon Ring card shows device list (doorbells, cameras), online/offline status, and recent event indicators (last motion, last doorbell ring)
- **SMRTH-04**: Ring integration uses `ring-client-api` with one-time 2FA setup; documented as best-effort/may break on Ring app updates

## Out of Scope

| Feature | Reason |
|---------|--------|
| Service control (pause downloads, restart services, disable Pi-hole) | Coruscant monitors, does not control; control adds attack surface and scope creep |
| Docker container management (start/stop/restart) | Monitoring and orchestration should be separate tools |
| Media library browsing | This is Plex's job; Coruscant shows health and activity, not content |
| Historical time-series charts (30-day trending) | Requires time-series DB (InfluxDB/Prometheus) — major infrastructure addition not suited to v1 |
| Multi-user access / authentication | Tailscale provides network-level access control; single-user household |
| Email/SMS notification channels (v1) | User already uses Pushover; adding channels multiplies config complexity |
| Port forwarding / firewall config | Tailscale handles external access entirely |
| Cloud hosting or telemetry | All data stays local; no external calls except to user-owned services |
| Camera live streams (Plex, Ring) | WebRTC complexity; not a monitoring concern |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Pending |
| DASH-01 | Phase 2 | Pending |
| DASH-02 | Phase 2 | Pending |
| DASH-03 | Phase 2 | Pending |
| DASH-04 | Phase 2 | Pending |
| DASH-05 | Phase 2 | Pending |
| DASH-06 | Phase 2 | Pending |
| DASH-07 | Phase 2 | Pending |
| DASH-08 | Phase 2 | Pending |
| SVCST-01 | Phase 3 | Pending |
| SVCST-02 | Phase 3 | Pending |
| SVCST-03 | Phase 3 | Pending |
| SVCST-04 | Phase 3 | Pending |
| SVCST-05 | Phase 3 | Pending |
| SVCACT-01 | Phase 3 | Pending |
| SVCACT-02 | Phase 3 | Pending |
| SVCACT-03 | Phase 3 | Pending |
| CFG-01 | Phase 3 | Pending |
| CFG-03 | Phase 3 | Pending |
| CFG-04 | Phase 3 | Pending |
| SVCRICH-01 | Phase 4 | Pending |
| SVCRICH-02 | Phase 4 | Pending |
| SVCRICH-03 | Phase 4 | Pending |
| SVCRICH-04 | Phase 4 | Pending |
| SVCRICH-05 | Phase 4 | Pending |
| NET-01 | Phase 5 | Pending |
| NET-02 | Phase 5 | Pending |
| NET-03 | Phase 5 | Pending |
| NET-04 | Phase 5 | Pending |
| NOTIF-01 | Phase 6 | Pending |
| NOTIF-02 | Phase 6 | Pending |
| NOTIF-03 | Phase 6 | Pending |
| NOTIF-04 | Phase 6 | Pending |
| NOTIF-05 | Phase 6 | Pending |
| NOTIF-06 | Phase 6 | Pending |
| CFG-02 | Phase 6 | Pending |
| LOG-01 | Phase 7 | Pending |
| LOG-02 | Phase 7 | Pending |
| LOG-03 | Phase 7 | Pending |
| LOG-04 | Phase 7 | Pending |
| SMRTH-01 | Phase 8 | Pending |
| SMRTH-02 | Phase 8 | Pending |
| SMRTH-03 | Phase 8 | Pending |
| SMRTH-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Smart Home phase: 4 total
- Mapped to phases: 47
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation (corrected coverage count: 43 v1, not 40)*
