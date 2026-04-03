# Phase 3: Settings + First Service Adapters — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 03-settings-first-service-adapters
**Areas discussed:** Settings page layout, Unconfigured card state, Test Connection feedback, Mock→real SSE transition

---

## Settings Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single scrolling page | All services listed vertically on one page, each in its own section | |
| Tabbed / sidebar nav | Horizontal tab bar per service; clicking a tab shows that service's config panel | ✓ |

**User's choice:** Tabbed / sidebar nav
**Notes:** "I like #2 as this is just the beginning and a tab of services keeps the page easy to navigate without scrolling forever."

---

### Save behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Save per tab | Each tab has its own SAVE button; saves are isolated per service | ✓ |
| Auto-save on blur | Fields save automatically when user clicks away | |

**User's choice:** Save per tab

---

### Live data after save

| Option | Description | Selected |
|--------|-------------|----------|
| Live on next poll | After save, backend picks up new credentials on next poll cycle (~5–30s) | ✓ |
| Require restart | Credentials take effect after container restart | |

**User's choice:** Live on next poll

---

### Tab LED indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Status LED on tab | Small LED dot per tab matching cockpit status colours | ✓ |
| Checkmark / badge | Simple ✓ on configured tabs | |

**User's choice:** Status LED on tab

---

### LED intensity slider

| Option | Description | Selected |
|--------|-------------|----------|
| General / Display tab | Add a non-service tab for app-level settings | |
| Keep in place, tack on | Slider at bottom of first tab or footer | |
| Remove slider | Remove the Phase 2 carryover slider entirely | ✓ |

**User's choice:** Remove the slider
**Notes:** "We can get rid of this as the LEDs we have are fine without config."

---

### Tab bar overflow

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal scroll | Tab bar overflows horizontally and scrolls | ✓ |
| Two rows of tabs | Tabs wrap into 2 rows | |
| Dropdown selector | Replace tab bar with a SELECT when too many services | |

**User's choice:** Horizontal scroll

---

### API key visibility

**User's choice:** API key fields use `type="password"` with a show/hide eye icon toggle.
**Notes:** "The way we save API keys should look like 'password visibility' and not readable on front end."

---

## Unconfigured Card State

| Option | Description | Selected |
|--------|-------------|----------|
| Grey LED + 'NOT CONFIGURED' label | Card renders normally but with static grey LED and dim label | ✓ |
| Hide the card entirely | Unconfigured services don't appear on dashboard at all | |
| Ghost / placeholder slot | Dim outlined ghost card with no labels | |

**User's choice:** Grey LED + 'NOT CONFIGURED' label

---

### Tap behavior for unconfigured cards

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to Settings (that service's tab) | Tapping deep-links to Settings with that service's tab pre-selected | ✓ |
| Stay on dashboard, do nothing | Tapping does nothing | |
| Detail view with configure button | Navigate to detail page with a Settings prompt | |

**User's choice:** Navigate to Settings (that service's tab)

---

## Test Connection Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Inline status below the button | Result line appears directly below TEST button; stays visible | ✓ |
| Toast notification | Brief toast slides in from screen edge | |

**User's choice:** Inline status below the button

---

### In-flight state

| Option | Description | Selected |
|--------|-------------|----------|
| Disable button + brief spinner | Button disabled, shows TESTING… during request | ✓ |
| Nothing — result appears when done | Button stays clickable; result appears when response arrives | |

**User's choice:** Disable button + brief spinner

---

## Mock→real SSE Transition

| Option | Description | Selected |
|--------|-------------|----------|
| Grey / unconfigured state — no mock | Configured services show real data; unconfigured get status:'stale' + configured:false | ✓ |
| Keep mock for unconfigured services | Fall back to mock for unconfigured services | |
| Claude's discretion | Let Claude decide | |

**User's choice:** Grey / unconfigured state — no mock (retire mock generator)

---

### Poll failure state

| Option | Description | Selected |
|--------|-------------|----------|
| Red LED + 'OFFLINE' immediately | First poll failure = red/offline immediately | ✓ |
| Amber 'STALE' then red after N failures | Amber first, then red after consecutive failures | |

**User's choice:** Red immediately for any connection failure

---

### Color semantics clarification (user-initiated)

User reiterated color semantics for the entire project:
- **Green** = service up / healthy
- **Red** = service down (any connection failure — timeout, bad creds, unreachable)
- **Amber** = user action required (e.g., arr health warnings needing manual intervention)
- **Purple** = active downloading (SABnzbd)
- Grey = not configured

Key constraint: amber is NEVER for connection failures or lack of activity — strictly for "user must do something."

Confirmed: bad API key (401/403) → red (connection failure), not amber.

---

## Claude's Discretion

- Drizzle schema shape for service configurations
- AES-256-GCM IV/tag storage approach in SQLite
- Exact poll interval values within spec ranges
- Shared base adapter pattern for arr services
- SABnzbd `ServiceStatus.metrics` shape
- Backend API route design for settings CRUD and test-connection
- React Router URL strategy for Settings deep-link

## Deferred Ideas

None.
