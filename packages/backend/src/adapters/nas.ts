import axios from 'axios'
import type { NasStatus } from '@coruscant/shared'

const TIMEOUT_MS = 10_000
// DSM sessions last ~30 minutes; use 25 min to be conservative
const SESSION_DURATION_MS = 25 * 60 * 1000

/**
 * Synology DSM session management.
 * Authenticates via SYNO.API.Auth and caches the session ID (sid).
 * On error code 119 (invalid session), invalidates and retries.
 */
interface DsmSessionEntry {
  sid: string
  validUntil: number
}

// Module-level singleton map keyed by baseUrl
const sessions = new Map<string, DsmSessionEntry>()

async function ensureSession(baseUrl: string, username: string, password: string): Promise<string> {
  const cached = sessions.get(baseUrl)
  if (cached && Date.now() < cached.validUntil - 10_000) {
    return cached.sid
  }

  const response = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
    params: {
      api: 'SYNO.API.Auth',
      version: 6,
      method: 'login',
      account: username,
      passwd: password,
      format: 'sid',
    },
    timeout: TIMEOUT_MS,
  })

  if (!response.data?.success) {
    throw new Error(`DSM auth failed: ${JSON.stringify(response.data?.error)}`)
  }

  const sid: string = response.data?.data?.sid
  if (!sid) {
    throw new Error('DSM auth response missing data.sid')
  }

  sessions.set(baseUrl, {
    sid,
    validUntil: Date.now() + SESSION_DURATION_MS,
  })

  return sid
}

function invalidateSession(baseUrl: string): void {
  sessions.delete(baseUrl)
}

/**
 * Check if a DSM API response indicates an invalid session (error code 119).
 */
function isSessionExpired(data: { success: boolean; error?: { code: number } }): boolean {
  return !data.success && data.error?.code === 119
}

/**
 * Poll Synology NAS for hardware status via DSM API.
 *
 * Makes 3 parallel requests:
 *   - SYNO.Core.System.Utilization — CPU, RAM, network I/O
 *   - SYNO.Core.System (type=storage) — disk temps, volume usage, CPU temp
 *   - SYNO.Core.Hardware.FanSpeed — fan RPMs (optional)
 *
 * On DSM error 119 (session expired), invalidates session and retries once.
 */
export async function pollNas(baseUrl: string, username: string, password: string): Promise<NasStatus> {
  const defaultStatus: NasStatus = {
    cpu: 0,
    ram: 0,
    networkMbpsUp: 0,
    networkMbpsDown: 0,
    volumes: [],
  }

  const performPoll = async (): Promise<NasStatus> => {
    const sid = await ensureSession(baseUrl, username, password)

    const makeUrl = (api: string, version: number, method: string, extra?: Record<string, string>) => {
      const params = new URLSearchParams({
        api,
        version: String(version),
        method,
        _sid: sid,
        ...extra,
      })
      return `${baseUrl}/webapi/entry.cgi?${params.toString()}`
    }

    const [utilizationRes, storageRes, fanRes] = await Promise.all([
      axios.get(makeUrl('SYNO.Core.System.Utilization', 1, 'get', { type: 'current' }), { timeout: TIMEOUT_MS }),
      axios.get(makeUrl('SYNO.Core.System', 1, 'info', { type: 'storage' }), { timeout: TIMEOUT_MS }),
      axios.get(makeUrl('SYNO.Core.Hardware.FanSpeed', 1, 'get'), { timeout: TIMEOUT_MS }),
    ])

    // Check for session expiry in any response — if so, throw to trigger re-auth
    for (const res of [utilizationRes, storageRes, fanRes]) {
      if (isSessionExpired(res.data)) {
        const err = new Error('DSM session expired') as Error & { code119: boolean }
        err.code119 = true
        throw err
      }
    }

    const utilData = utilizationRes.data?.success ? utilizationRes.data.data : null
    const storageData = storageRes.data?.success ? storageRes.data.data : null
    const fanData = fanRes.data?.success ? fanRes.data.data : null

    // CPU: user + system + other
    const cpu = utilData
      ? (utilData.cpu?.user_load ?? 0) + (utilData.cpu?.system_load ?? 0) + (utilData.cpu?.other_load ?? 0)
      : 0

    // RAM: real_usage is already a percent
    const ram = utilData?.memory?.real_usage ?? 0

    // Network: convert bytes/sec to Mbps
    const network = utilData?.network?.[0]
    const networkMbpsUp = network ? (network.tx ?? 0) * 8 / 1_000_000 : 0
    const networkMbpsDown = network ? (network.rx ?? 0) * 8 / 1_000_000 : 0

    // CPU temperature from storage info
    const cpuTempC: number | undefined = storageData?.temperature

    // Volumes
    const volumes = (storageData?.vol_info ?? []).map((vol: { name: string; used_size: string; total_size: string }) => ({
      name: vol.name,
      usedPercent: parseInt(vol.total_size, 10) > 0
        ? (parseInt(vol.used_size, 10) / parseInt(vol.total_size, 10)) * 100
        : 0,
    }))

    // Disks: only include if hdd_info has items
    const hddInfo: Array<{ id: string; name: string; temp: number }> = storageData?.hdd_info ?? []
    const disks = hddInfo.length > 0
      ? hddInfo.map((disk) => ({ id: disk.id, name: disk.name, tempC: disk.temp }))
      : undefined

    // Fans: set undefined if empty or unavailable (NOT empty array, per D-19)
    const fanSpeeds: Array<{ id: string; rpm: number }> = fanData?.fan_speed ?? []
    const fans = fanSpeeds.length > 0
      ? fanSpeeds.map((fan) => ({ id: fan.id, rpm: fan.rpm }))
      : undefined

    return {
      cpu,
      ram,
      networkMbpsUp,
      networkMbpsDown,
      cpuTempC,
      volumes,
      ...(disks !== undefined && { disks }),
      ...(fans !== undefined && { fans }),
    }
  }

  try {
    return await performPoll()
  } catch (err) {
    // Re-authenticate on session expiry (error code 119) and retry once
    const isExpiry = (err as { code119?: boolean })?.code119 === true
      || (err as { response?: { data?: { error?: { code: number } } } })?.response?.data?.error?.code === 119

    if (isExpiry) {
      invalidateSession(baseUrl)
      try {
        return await performPoll()
      } catch {
        return defaultStatus
      }
    }

    return defaultStatus
  }
}

/**
 * Check if any Docker images on the NAS have updates available.
 * Runs on a separate 12-hour timer (D-18).
 * Returns false on any error (defensive — open question from RESEARCH.md).
 */
export async function checkNasImageUpdates(baseUrl: string, username: string, password: string): Promise<boolean> {
  try {
    const sid = await ensureSession(baseUrl, username, password)

    const params = new URLSearchParams({
      api: 'SYNO.Docker.Image',
      version: '1',
      method: 'list',
      _sid: sid,
    })

    const response = await axios.get(`${baseUrl}/webapi/entry.cgi?${params.toString()}`, {
      timeout: TIMEOUT_MS,
    })

    if (!response.data?.success) {
      return false
    }

    const images: Array<{ is_update_available?: boolean }> = response.data?.data?.images ?? []
    return images.some((img) => img.is_update_available === true)
  } catch {
    return false
  }
}
