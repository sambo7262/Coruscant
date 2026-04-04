import axios from 'axios'
import type { ServiceStatus } from '@coruscant/shared'

const TIMEOUT_MS = 10_000

/**
 * Pi-hole v6 session management.
 * Pi-hole v6 uses POST /api/auth to obtain a session ID (sid).
 * Pi-hole v5 is NOT supported — v6 FTL API required (per D-02 decision).
 */
interface SessionEntry {
  sid: string
  validUntil: number
}

// Module-level singleton map keyed by baseUrl
const sessions = new Map<string, SessionEntry>()

async function ensureSession(baseUrl: string, password: string): Promise<string> {
  const cached = sessions.get(baseUrl)
  if (cached && Date.now() < cached.validUntil - 10_000) {
    return cached.sid
  }

  const response = await axios.post(
    `${baseUrl}/api/auth`,
    { password },
    { timeout: TIMEOUT_MS },
  )

  const sid: string = response.data?.session?.sid
  const validity: number = response.data?.session?.validity ?? 1800 // seconds

  if (!sid) {
    throw new Error('Pi-hole auth response missing session.sid')
  }

  sessions.set(baseUrl, {
    sid,
    validUntil: Date.now() + validity * 1000,
  })

  return sid
}

function invalidateSession(baseUrl: string): void {
  sessions.delete(baseUrl)
}

/**
 * Poll Pi-hole v6 for DNS statistics.
 *
 * Makes 4 parallel requests:
 *   - /api/stats/summary   — query counts, blocked %, frequency
 *   - /api/dns/blocking    — blocking enabled/disabled state
 *   - /api/info/system     — CPU load, memory usage
 *   - /api/stats/query_types — query type breakdown (per D-06)
 *
 * Status mapping (per D-05):
 *   - blocking=enabled  → 'online' (green LED)
 *   - blocking=disabled → 'warning' (amber LED)
 *   - network error     → 'offline' (red LED)
 */
export async function pollPihole(baseUrl: string, password: string): Promise<ServiceStatus> {
  const lastPollAt = new Date().toISOString()

  const performPoll = async (): Promise<ServiceStatus> => {
    const sid = await ensureSession(baseUrl, password)

    const headers = { 'X-FTL-SID': sid }
    const opts = { headers, timeout: TIMEOUT_MS }

    const [summaryRes, blockingRes, systemRes, queryTypesRes] = await Promise.all([
      axios.get(`${baseUrl}/api/stats/summary`, opts),
      axios.get(`${baseUrl}/api/dns/blocking`, opts),
      axios.get(`${baseUrl}/api/info/system`, opts),
      axios.get(`${baseUrl}/api/stats/query_types`, opts),
    ])

    const { queries, gravity } = summaryRes.data
    const blocking: string = blockingRes.data?.blocking ?? 'disabled'
    const system = systemRes.data?.system
    const queryTypesData: Record<string, number> = queryTypesRes.data?.types ?? {}

    const cpuLoad1m: number = system?.cpu?.load?.[0] ?? 0
    const ramUsed: number = system?.memory?.ram?.used ?? 0
    const ramTotal: number = system?.memory?.ram?.total ?? 1
    const memPercent = (ramUsed / ramTotal) * 100

    const status = blocking === 'enabled' ? 'online' : 'warning'

    return {
      id: 'pihole',
      name: 'Pi-hole',
      tier: 'rich',
      status,
      configured: true,
      lastPollAt,
      metrics: {
        blockingActive: blocking === 'enabled',
        queriesPerMinute: queries?.frequency ?? 0,
        load1m: cpuLoad1m,
        memPercent,
        totalQueriesDay: queries?.total ?? 0,
        totalBlockedDay: queries?.blocked ?? 0,
        percentBlocked: queries?.percent_blocked ?? 0,
        domainsBlocked: gravity?.domains_being_blocked ?? 0,
        queryTypes: queryTypesData, // D-06: Record<string, number>
      },
    }
  }

  try {
    return await performPoll()
  } catch (err) {
    // Check if 401 — if so, invalidate session and retry once
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 401) {
      invalidateSession(baseUrl)
      try {
        return await performPoll()
      } catch (retryErr) {
        const reason = retryErr instanceof Error ? retryErr.message : String(retryErr)
        return {
          id: 'pihole',
          name: 'Pi-hole',
          tier: 'rich',
          status: 'offline',
          configured: true,
          lastPollAt,
          metrics: { error: reason },
        }
      }
    }

    const reason = err instanceof Error ? err.message : String(err)
    return {
      id: 'pihole',
      name: 'Pi-hole',
      tier: 'rich',
      status: 'offline',
      configured: true,
      lastPollAt,
      metrics: { error: reason },
    }
  }
}
