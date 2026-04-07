import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import https from 'node:https'

const unifiHttpsAgent = new https.Agent({ rejectUnauthorized: false })

const VALID_SERVICES = [
  'radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd',
  'pihole', 'plex', 'nas', 'unifi', 'piHealth',
] as const

const ARR_SERVICES = new Set(['radarr', 'sonarr', 'lidarr', 'prowlarr', 'readarr'])

type ValidService = (typeof VALID_SERVICES)[number]

function isValidService(id: string): id is ValidService {
  return (VALID_SERVICES as readonly string[]).includes(id)
}

export async function testConnectionRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/test-connection/:serviceId
   *
   * Makes a live connectivity check against the service using the provided
   * credentials. Always returns HTTP 200 — success/failure is in the body.
   */
  fastify.post<{
    Params: { serviceId: string }
    Body: { baseUrl?: string; apiKey?: string; username?: string }
  }>('/api/test-connection/:serviceId', async (request, reply) => {
    const { serviceId } = request.params

    if (!isValidService(serviceId)) {
      return reply.code(400).send({ error: `Unknown service: ${serviceId}` })
    }

    const baseUrl = (request.body.baseUrl ?? '').replace(/\/$/, '')
    const apiKey = request.body.apiKey ?? ''
    const timeout = 5_000

    try {
      if (ARR_SERVICES.has(serviceId)) {
        // v3 for Radarr/Sonarr, v1 for Lidarr/Prowlarr/Readarr
        const apiVersion = (serviceId === 'radarr' || serviceId === 'sonarr') ? 'v3' : 'v1'
        const response = await axios.get<Array<{ type: string; message: string }>>(
          `${baseUrl}/api/${apiVersion}/health`,
          {
            headers: { 'X-Api-Key': apiKey },
            timeout,
          },
        )

        const healthItems = Array.isArray(response.data) ? response.data : []
        const warningCount = healthItems.filter(
          (item) => item.type === 'warning' || item.type === 'error'
            || item.type === 'Warning' || item.type === 'Error',
        ).length

        return reply.send({
          success: true,
          message: `Connected (${apiVersion}) — ${warningCount} warning${warningCount !== 1 ? 's' : ''}`,
        })
      }

      if (serviceId === 'bazarr') {
        // Bazarr: GET /api/system/status with apikey query param
        await axios.get(`${baseUrl}/api/system/status`, {
          params: { apikey: apiKey },
          timeout,
        })

        return reply.send({ success: true, message: 'Connected' })
      }

      if (serviceId === 'sabnzbd') {
        // SABnzbd: GET /api?mode=queue&output=json&apikey=...
        const response = await axios.get<{ queue?: { noofslots?: number } }>(
          `${baseUrl}/api`,
          {
            params: { mode: 'queue', output: 'json', apikey: apiKey },
            timeout,
          },
        )

        const queueCount = response.data?.queue?.noofslots ?? 0
        return reply.send({
          success: true,
          message: `Connected - queue has ${queueCount} item${queueCount !== 1 ? 's' : ''}`,
        })
      }

      if (serviceId === 'pihole') {
        // Pi-hole v6: POST /api/auth with password, check for session sid
        const response = await axios.post(
          `${baseUrl}/api/auth`,
          { password: apiKey },
          { timeout, headers: { 'Content-Type': 'application/json' } },
        )
        const sid = response.data?.session?.sid
        if (!sid) {
          return reply.send({ success: false, message: 'Auth failed — no session returned' })
        }
        return reply.send({ success: true, message: 'Connected — Pi-hole v6' })
      }

      if (serviceId === 'plex') {
        // Plex: GET / with token as query param (most reliable — header-only fails on some PMS versions)
        const response = await axios.get(`${baseUrl}/`, {
          params: { 'X-Plex-Token': apiKey },
          headers: { 'Accept': 'application/json' },
          timeout,
        })
        const serverName = response.data?.MediaContainer?.friendlyName ?? 'Plex Server'
        return reply.send({ success: true, message: `Connected — ${serverName}` })
      }

      if (serviceId === 'nas') {
        // Synology DSM: GET /webapi/entry.cgi with SYNO.API.Auth login
        const username = request.body.username ?? ''
        const response = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
          params: {
            api: 'SYNO.API.Auth', version: 6, method: 'login',
            account: username, passwd: apiKey, format: 'sid',
          },
          timeout,
        })
        if (!response.data?.success) {
          const errCode = response.data?.error?.code ?? 'unknown'
          return reply.send({ success: false, message: `DSM auth failed (code: ${errCode})` })
        }
        const sid = response.data.data.sid
        // Best-effort logout of test session
        await axios.get(`${baseUrl}/webapi/entry.cgi`, {
          params: { api: 'SYNO.API.Auth', version: 6, method: 'logout', _sid: sid },
          timeout: 3000,
        }).catch(() => {})
        return reply.send({ success: true, message: 'Connected — DSM authenticated' })
      }

      if (serviceId === 'unifi') {
        const res = await axios.get(`${baseUrl}/proxy/network/integration/v1/sites`, {
          headers: { 'X-API-KEY': apiKey },
          timeout: 10_000,
          httpsAgent: unifiHttpsAgent,
        })
        const sites = res.data?.data ?? []
        const siteName = sites[0]?.name ?? 'Unknown'
        return reply.send({ success: true, message: `Connected — ${siteName}` })
      }

      if (serviceId === 'piHealth') {
        const response = await axios.get(`${baseUrl}/health`, { timeout })
        if (typeof response.data?.cpu_temp_c !== 'number') {
          return reply.send({ success: false, message: 'Unexpected response format — missing cpu_temp_c' })
        }
        const temp = response.data.cpu_temp_c
        return reply.send({ success: true, message: `Connected - CPU ${temp.toFixed(1)}C` })
      }

      // Should not reach here given the valid service list
      return reply.send({ success: false, message: 'Unsupported service' })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error'
      return reply.send({ success: false, message })
    }
  })
}
