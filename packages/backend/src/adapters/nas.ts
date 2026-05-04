import axios from 'axios'
import type { ImageUpdateDetail, NasDockerStats, NasProcess, NasStatus } from '@coruscant/shared'

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

    const [utilizationRes, storageRes, fanRes, dockerStats, systemInfoRes] = await Promise.all([
      axios.get(makeUrl('SYNO.Core.System.Utilization', 1, 'get', { type: 'current' }), { timeout: TIMEOUT_MS }),
      axios.get(makeUrl('SYNO.Core.System', 1, 'info', { type: 'storage' }), { timeout: TIMEOUT_MS }),
      axios.get(makeUrl('SYNO.Core.Hardware.FanSpeed', 1, 'get'), { timeout: TIMEOUT_MS }),
      fetchNasDockerStats(baseUrl, username, password).catch(() => undefined),
      axios.get(makeUrl('SYNO.Core.System', 1, 'info'), { timeout: TIMEOUT_MS }).catch(() => null),
    ])

    // Check for session expiry in any response — if so, throw to trigger re-auth
    for (const res of [utilizationRes, storageRes, fanRes]) {
      if (isSessionExpired(res.data)) {
        const err = new Error('DSM session expired') as Error & { code119: boolean }
        err.code119 = true
        throw err
      }
    }
    // systemInfoRes may be null (caught error) — only check if present
    if (systemInfoRes && isSessionExpired(systemInfoRes.data)) {
      const err = new Error('DSM session expired') as Error & { code119: boolean }
      err.code119 = true
      throw err
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

    // NAS server name from system info (general, not storage-specific)
    const systemInfoData = systemInfoRes?.data?.success ? systemInfoRes.data.data : null
    const nasName: string | undefined = typeof systemInfoData?.server_name === 'string' && systemInfoData.server_name
      ? systemInfoData.server_name
      : undefined

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
      ...(nasName !== undefined && { name: nasName }),
      volumes,
      ...(disks !== undefined && { disks }),
      ...(fans !== undefined && { fans }),
      ...(dockerStats !== undefined && { docker: dockerStats }),
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
 * Fetch Docker container resource stats via SYNO.Docker.Container.Resource.
 * Uses GET with name=any to retrieve all containers in a single request.
 * Each resource entry has cpu (float %) and memoryPercent (float %).
 * Aggregates by summing both fields across all returned resources.
 * Falls back to SYNO.ContainerManager.Container.Resource on failure.
 * Returns undefined if neither API is available.
 */
export async function fetchNasDockerStats(
  baseUrl: string,
  username: string,
  password: string,
): Promise<NasDockerStats | undefined> {
  type RawResource = Record<string, unknown>

  function tryParseResources(responseData: Record<string, unknown>): RawResource[] | null {
    const inner = responseData.data as Record<string, unknown> | undefined
    if (!inner) return null
    if (Array.isArray(inner.resources)) return inner.resources as RawResource[]
    return null
  }

  try {
    const sid = await ensureSession(baseUrl, username, password)

    for (const api of [
      'SYNO.Docker.Container.Resource',
      'SYNO.ContainerManager.Container.Resource',
    ]) {
      const params = new URLSearchParams({
        api,
        version: '1',
        method: 'get',
        name: 'any',
        _sid: sid,
      })

      const responseData = await axios
        .get(`${baseUrl}/webapi/entry.cgi?${params.toString()}`, { timeout: TIMEOUT_MS })
        .then((r) => r.data as Record<string, unknown>)
        .catch((reqErr: unknown) => {
          console.warn(`[nas] fetchNasDockerStats ${api} request failed:`, reqErr)
          return null
        })

      if (responseData === null) continue

      if (!responseData.success) {
        console.warn(
          `[nas] fetchNasDockerStats ${api} returned success=false:`,
          JSON.stringify((responseData.error as unknown) ?? responseData),
        )
        continue
      }

      const resources = tryParseResources(responseData)
      if (!resources) {
        const inner = responseData.data as Record<string, unknown> | undefined
        console.warn(
          `[nas] fetchNasDockerStats ${api}: no resources array found. ` +
          `data keys: [${Object.keys(inner ?? {}).join(', ')}]`,
        )
        continue
      }

      if (resources.length === 0) {
        return { cpuPercent: 0, ramPercent: 0 }
      }

      const cpuPercent = resources.reduce((sum, r) => {
        const v = r.cpu
        return sum + (typeof v === 'number' && isFinite(v) ? v : 0)
      }, 0)

      const ramPercent = resources.reduce((sum, r) => {
        const v = r.memoryPercent
        return sum + (typeof v === 'number' && isFinite(v) ? v : 0)
      }, 0)

      return {
        cpuPercent: Math.round(cpuPercent * 10) / 10,
        ramPercent: Math.round(ramPercent * 10) / 10,
      }
    }

    console.warn('[nas] fetchNasDockerStats: all API namespaces exhausted, returning undefined')
    return undefined
  } catch (err) {
    console.warn('[nas] fetchNasDockerStats: unexpected error:', err)
    return undefined
  }
}

const PROCESS_LABELS: Record<string, string> = {
  ffmpeg:                'Plex transcoding',
  'Plex Media Server':   'Plex media server',
  'Plex Media':          'Plex media server',
  'Plex Script Host':    'Plex plugins',
  'Plex DLNA Server':    'Plex DLNA',
  'Plex Tuner Service':  'Plex tuner',
  Radarr:                'Radarr (movies)',
  Sonarr:                'Sonarr (TV)',
  Lidarr:                'Lidarr (music)',
  Readarr:               'Readarr (books)',
  Prowlarr:              'Prowlarr (indexers)',
  grafana:               'Grafana monitoring',
  'pihole-FTL':          'Pi-hole DNS',
  tailscaled:            'Tailscale VPN',
  uvicorn:               'Python web server',
  watchtower:            'Watchtower (auto-update)',
  mosquitto:             'MQTT broker',
  smbd:                  'Network file sharing (SMB)',
  synoindexd:            'File indexing',
  synoscgi:              'DSM web interface',
  dockerd:               'Docker engine',
  containerd:            'Docker container runtime',
  'containerd-shim':     'Docker container shim',
  'docker-proxy':        'Docker network proxy',
  nginx:                 'Web server / reverse proxy',
  postgres:              'Database (PostgreSQL)',
  pgbouncer:             'Database connection pool',
  node:                  'Node.js application',
  python3:               'Python script',
  python:                'Python script',
  rsync:                 'File sync / backup',
  sshd:                  'SSH connection',
  synophotod:            'Synology Photos indexing',
  synoconfd:             'Synology system config',
  scemd:                 'Synology system monitor',
  snmpd:                 'SNMP monitoring agent',
  'redis-server':        'Redis cache',
  'beam.smp':            'Erlang runtime',
  systemd:               'System init',
}

function labelProcess(rawName: string): string {
  if (PROCESS_LABELS[rawName]) return PROCESS_LABELS[rawName]
  for (const [key, label] of Object.entries(PROCESS_LABELS)) {
    if (rawName.startsWith(key)) return label
  }
  return rawName
}

/**
 * Fetch top 5 processes sorted by CPU descending via SYNO.Core.System.Process.
 * Applies human-readable labels from PROCESS_LABELS with prefix-match fallback.
 * Defensively parses DSM response — field names (cmd/name/process_name, cpu/cpu_percent/cpu_usage)
 * are unverified against real hardware and checked via multiple plausible paths.
 * Returns empty array on any error (never throws).
 */
export async function fetchNasProcesses(
  baseUrl: string,
  username: string,
  password: string,
  cpuOverall?: number,
): Promise<NasProcess[]> {
  try {
    const sid = await ensureSession(baseUrl, username, password)
    const params = new URLSearchParams({
      api: 'SYNO.Core.System.Process',
      version: '1',
      method: 'list',
      _sid: sid,
    })
    const res = await axios.get(
      `${baseUrl}/webapi/entry.cgi?${params.toString()}`,
      { timeout: TIMEOUT_MS },
    )

    if (!res.data?.success) return []

    // DEFENSIVE: DSM field names unverified — check multiple plausible paths
    const rawList: Record<string, unknown>[] = Array.isArray(res.data?.data?.process)
      ? res.data.data.process
      : Array.isArray(res.data?.data?.processes)
      ? res.data.data.processes
      : Array.isArray(res.data?.data)
      ? res.data.data
      : []

    const parsed = rawList
      .map((p) => {
        const rawName = String(p.command ?? p.cmd ?? p.name ?? '')
        const cpuPercent = Number(p.cpu ?? p.cpu_percent ?? p.cpu_usage ?? 0)
        return {
          pid: Number(p.pid ?? 0),
          name: rawName,
          label: labelProcess(rawName),
          cpuPercent,
        }
      })
      .filter((p) => p.name.length > 0)
      .sort((a, b) => b.cpuPercent - a.cpuPercent)
      .slice(0, 5)

    if (cpuOverall && cpuOverall > 0) {
      const rawSum = rawList.reduce((sum, p) => sum + Number(p.cpu ?? p.cpu_percent ?? p.cpu_usage ?? 0), 0)
      if (rawSum > 0) {
        const scale = cpuOverall / rawSum
        for (const proc of parsed) {
          proc.cpuPercent = Math.round(proc.cpuPercent * scale * 10) / 10
        }
      }
    }

    return parsed
  } catch (err) {
    console.warn('[nas] fetchNasProcesses: failed:', err)
    return []
  }
}

export interface ImageUpdateResult {
  available: boolean
  images: ImageUpdateDetail[]
  checkedAt: string
}

/**
 * Check if any Docker images have updates available via the Docker socket.
 * Lists local images, queries the registry digest via /distribution/{name}/json,
 * and compares against the local digest. Returns per-image detail array.
 * Returns empty result on any error (defensive).
 */
export async function checkNasImageUpdates(): Promise<ImageUpdateResult> {
  const DOCKER_SOCKET = '/var/run/docker.sock'

  try {
    // List all local images
    const imagesRes = await axios.get('http://localhost/v1.41/images/json', {
      socketPath: DOCKER_SOCKET,
      timeout: TIMEOUT_MS,
    })

    const images: Array<{ RepoTags?: string[]; RepoDigests?: string[] }> = imagesRes.data ?? []
    const updates: ImageUpdateDetail[] = []

    for (const img of images) {
      const tags = img.RepoTags ?? []
      const localDigests = img.RepoDigests ?? []

      for (const tag of tags) {
        // Skip dangling/untagged images and local-only builds
        if (tag === '<none>:<none>' || !tag.includes('/')) continue

        const localDigest = localDigests.find((d) => d.startsWith(tag.split(':')[0] + '@'))
        if (!localDigest) continue

        const localSha = localDigest.split('@')[1]
        if (!localSha) continue

        try {
          const distRes = await axios.get(
            `http://localhost/v1.41/distribution/${encodeURIComponent(tag)}/json`,
            { socketPath: DOCKER_SOCKET, timeout: TIMEOUT_MS },
          )

          const remoteDigest = distRes.data?.Descriptor?.digest as string | undefined
          if (!remoteDigest) continue

          updates.push({ tag, localSha, remoteSha: remoteDigest, updateAvailable: remoteDigest !== localSha })
        } catch {
          // Registry unreachable or auth failed for this image — skip it
          continue
        }
      }
    }

    return { available: updates.some(u => u.updateAvailable), images: updates, checkedAt: new Date().toISOString() }
  } catch {
    return { available: false, images: [], checkedAt: new Date().toISOString() }
  }
}
