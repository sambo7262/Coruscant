# Phase 5: UI v2 — Instrument Panel Polish — Discussion Log

**Date:** 2026-04-04
**Areas discussed:** Per-card metric selection, Media stack row density, Detail view completeness, Polish inventory

---

## Area 1: Per-card metric selection

**Q: SABnzbd card — what's the primary thing to see at a glance?**
Options: filename+speed+ETA / speed+progress+queue count / speed+progress only / you decide
**Selected:** Filename + speed + ETA
**Notes:** Currently not working — must be fixed in Phase 5. Color logic is inverted: text goes purple when downloading (wrong), LED should change (to purple) while text stays amber. Backend must expose filename and ETA.

**Q: Pi-hole card body — keep current or change?**
Options: blocking status + % blocked + QPM / keep current (status+QPM+load+memory) / blocking status + totals / you decide
**Selected:** Keep current layout (status + QPM + system load + memory %)
**Notes:** Donut chart in detail view has broken dynamic legend — replace with static legend table (color swatch + type + count) to the right of the donut.

---

## Area 2: Media stack row density

**Q: Arr condensed rows — secondary info beyond LED + name?**
Options: LED+name only / LED+name+warning count / LED+name+queue count / you decide
**Selected:** LED + name only
**Notes:** But restructure the tile: two columns of three within a single chamfered tile (Radarr/Sonarr/Lidarr left; Prowlarr/Bazarr/Readarr right). Everything currently shows purple — fix LED logic: green=up, red=down, amber=needs attention, solid purple=downloading, flashing purple=queued. Amber header bar on the tile. Remove "MEDIA STACK" section label.

---

## Area 3: Detail view completeness

**Q: How deep should detail views go?**
Options: key stats only / full dump / service-specific depth
**Selected:** Service-specific depth

**Q: Arr detail view?**
Options: status + health warnings list / status + queue depth + warnings / status rows only
**Selected:** Status + health warnings as a list (version + status dot-leader rows, then health warning messages from /api/v3/health)

**Q: SABnzbd detail view?**
Options: active job + full queue list / active job only / you decide
**Selected:** Active job + full queue list (current download at top, remaining queue items below)

---

## Area 4: Polish inventory

**Q: Specific rough edges?**
Selected: NAS header expand/collapse + Plex rail expand

**NAS header notes:**
- Not seeing Docker stats — likely not implemented correctly in Phase 4
- Header too narrow for all stats
- Move disk temps to header as bars, separate section; SSDs and HDDs in separate groups; temps in °F
- Kill the expanding header entirely — Docker stats always visible in their own section
- Image update LED broken: user has a container with available update, LED not triggering

**SABnzbd additional:** Make tile narrow — always only one download, no scrolling (horizontal or vertical)

**Plex rail notes:**
- Now using Tautulli (verified working) — use webhooks as primary, direct Plex poll as fallback
- Plex server stats (CPU/MEM/Network) on the right side of collapsed rail
- Multiple streams: rotating view in collapsed state
- Audio streams: tracks show SxEx format (wrong) — fix to show Track + Album
- Audio quality shows "unknown" — fix to show real quality (FLAC, MP3, AAC, etc.)
- Add "PLEX" label — currently not visible anywhere in the UI
- Remove stream count ("N STREAMS") — just say "PLEX"
- Add media type badge (AUDIO / VIDEO) to each stream row

**Q: Tautulli vs direct Plex poll?**
Options: keep direct Plex poll / switch back to Tautulli webhooks
**Selected:** Tautulli webhooks primary + direct Plex poll as fallback
**Notes:** Tautulli provides richer metadata. Triggers: Playback Start, Playback Stop, Playback Pause, Playback Resume.

**Final addition:** Full dashboard must not scroll at 800×480 (landscape kiosk) — hard constraint for all tiles, not just SABnzbd.

---

*Discussion log for Phase 05 — human reference only, not consumed by downstream agents*
