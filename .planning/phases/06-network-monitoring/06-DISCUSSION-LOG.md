# Phase 6: Network Monitoring — Discussion Log

**Session:** 2026-04-05
**Areas discussed:** UBIQUITI card body, Health LED rollup, Settings tab, Device detail view

---

## Area 1: UBIQUITI Card Body Content

**Q: How should WAN throughput display in the compact UBIQUITI section?**
- Options: Numbers only / Mini throughput bars / Single WAN line + clients
- **Selected:** Mini throughput bars
- **Notes:** "uploads be red and downloads be blue to add some color"

**Q: What max bandwidth should the bars scale against?**
- Options: ISP plan speed / Dynamic peak observed / Fixed 1 Gbps ceiling
- **Selected:** Dynamic peak observed
- **Notes:** "can this occasionally reset so that a high of 2g isn't maintained forever?" → resolved as 6-hour rolling window reset

---

## Area 2: Health LED Rollup Logic

**Q: What should the overall network health LED indicate?**
- Options: Gateway-first / Any-device-down = amber / All-or-nothing
- **Selected:** Gateway-first
  - Gateway offline → RED (internet down)
  - AP or switch offline → AMBER (degraded, not critical)
  - All devices online → GREEN

---

## Area 3: Settings Tab & Site Scoping

**Q: Do you need site selection, or always use the default site?**
- Options: Default site only / Site selector field
- **Selected:** Default site only
  - 2 fields: Controller URL + API Token + TEST CONNECTION

---

## Area 4: Device Detail View

**Q: How should devices be organized?**
- Options: Grouped by type / Flat list status-sorted
- **Selected:** Grouped by type (GATEWAYS, SWITCHES, ACCESS POINTS)
  - Per device: LED, model name, uptime, client count

**Q: Any additional data per device row?**
- Options: Just model/uptime/clients / Add IP / Add firmware version
- **Selected:** Just those three (model, uptime, client count)

---

## API Research (conducted during session)

User provided request format:
```
curl -k -X GET 'https://192.168.86.1/proxy/network/integration/v1/sites' \
  -H 'X-API-KEY: YOUR_API_KEY' \
  -H 'Accept: application/json'
```

Also provided docs link: https://unifi.ui.com/consoles/{id}/unifi-api/network (requires auth — not publicly accessible)

**Findings from [unifi-network-mcp](https://github.com/ryanbehan/unifi-network-mcp):**
- Integration v1 device fields: `macAddress`, `model`, `name`, `ipAddress`, `firmwareVersion`, `state`, `uptime`, `features`
- Client count: `totalCount` from clients endpoint
- WAN throughput: NOT confirmed available in v1 API — flagged for researcher

---

*Human auditing reference only — downstream agents do not read this file*
