---
status: complete
phase: 04-rich-service-integrations
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md]
started: 2026-04-04T23:00:00Z
updated: 2026-04-04T23:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start fresh with `npm run dev` (or docker compose up). Backend boots without errors, frontend loads at localhost:1688 (or configured port), and the dashboard renders — cards visible, SSE connection established (no "disconnected" banner).
result: pass

### 2. Settings: PI-HOLE tab
expected: Open Settings → select PI-HOLE tab. Two fields visible: URL and Password. A note reads "Pi-hole v6 or higher required." Save button present. Fill in a URL and password, click SAVE — button confirms save. Click TEST — returns success or connection error message.
result: skipped
reason: user opted to close phase and advance

### 3. Settings: PLEX tab
expected: Open Settings → select PLEX tab. One credential field: "Plex Token". Below it, a read-only Webhook URL field showing `http://{hostname}:1688/api/webhooks/tautulli` with a copy button. Clicking the copy button briefly changes to "COPIED!" then reverts. Tautulli setup instructions visible below the URL.
result: skipped
reason: user opted to close phase and advance

### 4. Settings: NAS tab
expected: Open Settings → select NAS tab. Three fields visible: URL, DSM Username (plaintext), and DSM Password (masked). A note reads "Requires an admin-level DSM account." Fill in all three, click SAVE — confirmed. Click TEST — returns success or error.
result: skipped
reason: user opted to close phase and advance

### 5. Pi-hole card
expected: On the main dashboard, the Pi-hole card shows a 2×2 metric grid with four cells: QPM (queries per minute), LOAD (system load), MEM% (memory usage), and STATUS (blocking on/off). When Pi-hole is configured and online, the STATUS LED shows green. When blocking is disabled, STATUS shows amber.
result: skipped
reason: user opted to close phase and advance

### 6. Pi-hole detail view
expected: Tap the Pi-hole card to open the detail view. Three sections visible: TODAY'S STATS (Queries Today, Blocked Today, Block Rate), SYSTEM (Blocklist Size, Queries/Min, System Load, Memory Usage), and QUERY DISTRIBUTION (donut/pie chart showing query type breakdown by percentage). If Pi-hole is offline, shows "CONNECTION ERROR" message. If not configured, shows "NO DATA — configure Pi-hole in Settings".
result: skipped
reason: user opted to close phase and advance

### 7. Media stack two-column layout
expected: On the main dashboard, arr services (Radarr, Sonarr, Lidarr, etc.) appear as condensed LED+label rows in a left "MEDIA STACK" panel — not as full cards. Each row has a small colored LED dot and the service name. Tapping a row navigates to that service's detail. Full cards (SABnzbd, Pi-hole) appear in the right column. Plex and NAS do NOT appear as standalone cards in the grid.
result: skipped
reason: user opted to close phase and advance

### 8. Arr service LED colors
expected: In the Media Stack panel, arr service LEDs reflect service state: green = up/healthy, red = down/unreachable, yellow/amber = error state, purple solid = online with active downloads, purple flashing = queued/paused. Purple is used for all healthy arr states when online per D-30.
result: skipped
reason: user opted to close phase and advance

### 9. SABnzbd card display
expected: The SABnzbd card (full card in the right column) shows the current download filename (truncated if long, with full name in tooltip on hover/press), and a speed + time-remaining row below it. When idle, shows "IDLE". The LED reflects download state.
result: skipped
reason: user opted to close phase and advance

### 10. NAS header strip — live data
expected: The header's center column shows a horizontal NAS instrument strip with: CPU%, RAM%, DSK%, network upload/download arrows with Mbps values, and CPU temperature (when available). Values update live as SSE data arrives. When NAS is configured but data hasn't arrived yet, columns show "—" at zero fill. Strip is tappable (cursor changes on hover).
result: skipped
reason: user opted to close phase and advance

### 11. NAS header panel — expand/collapse
expected: Tap the NAS strip in the header → an animated panel slides down below the header. Panel shows up to three sections (only if data present): DISKS (name, read/write MB/s, temp per disk), DOCKER (CPU%, RAM%, network Mbps), FANS (fan ID + RPM). An image update indicator is visible: amber pulsing LED when Docker image updates are available, grey static LED when up to date. Tapping outside the panel (on the backdrop) closes it. Tapping the strip again also closes it.
result: skipped
reason: user opted to close phase and advance

### 12. NAS header — unconfigured state
expected: Before NAS is configured in Settings, the header center column shows "NAS NOT CONFIGURED" in grey text. The strip is not tappable and does not open a panel.
result: skipped
reason: user opted to close phase and advance

### 13. NowPlayingBanner — unconfigured state
expected: Before Plex is configured in Settings, the NowPlayingBanner is completely hidden — no rail, no idle label, no empty space reserved for it.
result: skipped
reason: user opted to close phase and advance

### 14. NowPlayingBanner — idle state
expected: When Plex is configured but no streams are active, a collapsed rail is visible showing "NO ACTIVE STREAMS" label. It does not expand or animate — just a static status indicator.
result: skipped
reason: user opted to close phase and advance

### 15. NowPlayingBanner — active streams
expected: When Plex has active streams (triggered by Tautulli webhook or direct PMS poll per quick task 260404-rxw), the NowPlayingBanner shows a scrolling ticker. Each stream entry shows: title, deviceName (e.g. "Apple TV"), and a Direct Play / Transcode indicator. Tapping the banner expands it to show stream rows and (if available) a Plex server stats section with CPU%, RAM%, and bandwidth Mbps.
result: skipped
reason: user opted to close phase and advance

## Summary

total: 15
passed: 1
issues: 0
pending: 0
skipped: 14
blocked: 0

## Gaps

[none]
