import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import https from 'node:https'
import { eq } from 'drizzle-orm'
import { getDb } from '../db.js'
import { serviceConfig } from '../schema.js'
import { decrypt } from '../crypto.js'

const unifiAgent = new https.Agent({ rejectUnauthorized: false })

const SEED = process.env.ENCRYPTION_KEY_SEED

/**
 * Debug routes — LAN-only diagnostic endpoints.
 * Not intended for production use; helpful for diagnosing Synology API issues.
 */
export async function debugRoutes(fastify: FastifyInstance) {
  /**
   * GET /debug/docker-stats
   * Hits the Synology Container Manager API directly and returns the raw response.
   * Tries all known namespaces and versions so you can see exactly what the NAS returns.
   */
  fastify.get('/debug/docker-stats', async (_request, reply) => {
    const db = getDb()
    const row = db.select().from(serviceConfig).where(eq(serviceConfig.serviceName, 'nas')).get()

    if (!SEED) return reply.status(500).send({ error: 'ENCRYPTION_KEY_SEED not configured' })
    if (!row?.baseUrl) {
      return reply.status(404).send({ error: 'NAS not configured' })
    }

    const baseUrl = row.baseUrl.replace(/\/$/, '')
    const username = row.username ?? ''
    let password = ''
    if (row.encryptedApiKey) {
      try {
        password = decrypt(row.encryptedApiKey, SEED)
      } catch (decryptErr) {
        fastify.log.error({ err: decryptErr }, 'debug/docker-stats: failed to decrypt NAS password — ENCRYPTION_KEY_SEED may have changed')
        return reply.status(500).send({ error: 'Failed to decrypt NAS credentials — ENCRYPTION_KEY_SEED may have changed' })
      }
    }

    // Step 1: authenticate
    let sid: string
    try {
      const authRes = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
        params: { api: 'SYNO.API.Auth', version: 3, method: 'login', account: username, passwd: password, format: 'sid' },
        timeout: 5000,
      })
      sid = authRes.data?.data?.sid
      if (!sid) return reply.send({ error: 'Auth failed', authResponse: authRes.data })
    } catch (e: unknown) {
      return reply.send({ error: 'Auth request failed', detail: String(e) })
    }

    // Step 2: query SYNO.API.Info with query=all, filter for docker/container APIs
    let discoveryAll: Record<string, unknown> = {}
    try {
      const infoRes = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
        params: { api: 'SYNO.API.Info', version: 1, method: 'query', query: 'all', _sid: sid },
        timeout: 10000,
      })
      const allApis: Record<string, unknown> = infoRes.data?.data ?? {}
      // Filter to only keys containing 'docker' or 'container' (case-insensitive)
      for (const key of Object.keys(allApis)) {
        if (/docker|container/i.test(key)) {
          discoveryAll[key] = allApis[key]
        }
      }
    } catch (e: unknown) {
      discoveryAll = { error: String(e) }
    }

    // Step 3: SYNO.Docker.Container list — GET with pagination params (offset+limit required by most Synology list APIs)
    const containerListAttempts: Record<string, unknown>[] = []
    for (const extra of [
      { offset: 0, limit: 50 },
      { offset: 0, limit: 50, type: 'all' },
      { offset: 0, limit: 50, status: 'all' },
    ]) {
      try {
        const res = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
          params: { api: 'SYNO.Docker.Container', version: 1, method: 'list', _sid: sid, ...extra },
          timeout: 5000,
        })
        containerListAttempts.push({ extra, success: res.data?.success, dataKeys: Object.keys(res.data?.data ?? {}), raw: res.data })
      } catch (e: unknown) {
        containerListAttempts.push({ extra, error: String(e) })
      }
    }

    // Step 4: SYNO.Docker.Container.Resource — GET with various param combos
    const resourceAttempts: Record<string, unknown>[] = []
    for (const params of [
      { method: 'list' },
      { method: 'list', offset: 0, limit: 50 },
      { method: 'get', name: 'coruscant' },
      { method: 'get', name: 'coruscant-backend-1' },
      { method: 'getinfo' },
      { method: 'getinfo', offset: 0, limit: 50 },
    ]) {
      try {
        const res = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
          params: { api: 'SYNO.Docker.Container.Resource', version: 1, _sid: sid, ...params },
          timeout: 5000,
        })
        resourceAttempts.push({ params, success: res.data?.success, dataKeys: Object.keys(res.data?.data ?? {}), raw: res.data })
      } catch (e: unknown) {
        resourceAttempts.push({ params, error: String(e) })
      }
    }

    // Step 5: SYNO.Docker.Project list with pagination
    let projectList: unknown = null
    try {
      const res = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
        params: { api: 'SYNO.Docker.Project', version: 1, method: 'list', offset: 0, limit: 50, _sid: sid },
        timeout: 5000,
      })
      projectList = { success: res.data?.success, dataKeys: Object.keys(res.data?.data ?? {}), raw: res.data }
    } catch (e: unknown) {
      projectList = { error: String(e) }
    }

    return reply.send({ discoveryAll, containerListAttempts, resourceAttempts, projectList })
  })

  /**
   * GET /debug/plex-stats
   * Hits PMS /statistics/resources directly and returns the raw JSON response.
   * Tries timespan=1 and timespan=6 so we can see which returns real data.
   */
  fastify.get('/debug/plex-stats', async (_request, reply) => {
    const db = getDb()
    const row = db.select().from(serviceConfig).where(eq(serviceConfig.serviceName, 'plex')).get()

    if (!SEED) return reply.status(500).send({ error: 'ENCRYPTION_KEY_SEED not configured' })
    if (!row?.baseUrl) return reply.status(404).send({ error: 'Plex not configured' })

    let token = ''
    if (row.encryptedApiKey) {
      try { token = decrypt(row.encryptedApiKey, SEED) } catch { return reply.status(500).send({ error: 'Failed to decrypt Plex token' }) }
    }

    const baseUrl = row.baseUrl.replace(/\/$/, '')
    const https = (await import('node:https')).default
    const agent = new https.Agent({ rejectUnauthorized: false })
    const results: Record<string, unknown> = {}

    for (const timespan of [1, 2, 3, 6]) {
      try {
        const res = await axios.get(
          `${baseUrl}/statistics/resources?timespan=${timespan}&X-Plex-Token=${token}`,
          { headers: { Accept: 'application/json' }, httpsAgent: agent, timeout: 5000 },
        )
        const entries = res.data?.MediaContainer?.StatisticsResources
        results[`timespan_${timespan}`] = {
          entryCount: Array.isArray(entries) ? entries.length : 'not_array',
          firstEntry: Array.isArray(entries) ? entries[0] : null,
          lastEntry: Array.isArray(entries) && entries.length > 0 ? entries[entries.length - 1] : null,
          mediaContainerKeys: Object.keys(res.data?.MediaContainer ?? {}),
          rawSize: JSON.stringify(res.data).length,
        }
      } catch (e: unknown) {
        results[`timespan_${timespan}`] = { error: String(e) }
      }
    }

    // Also hit /status/sessions to confirm session bandwidth source
    try {
      const res = await axios.get(
        `${baseUrl}/status/sessions?X-Plex-Token=${token}`,
        { headers: { Accept: 'application/json' }, httpsAgent: agent, timeout: 5000 },
      )
      const sessions = res.data?.MediaContainer?.Metadata ?? []
      results['sessions'] = {
        count: sessions.length,
        bandwidths: sessions.map((s: { Session?: { bandwidth?: number }; title?: string }) => ({
          title: s.title,
          bandwidth: s.Session?.bandwidth,
        })),
      }
    } catch (e: unknown) {
      results['sessions'] = { error: String(e) }
    }

    return reply.send(results)
  })

  /**
   * GET /debug/unifi
   * Walks through each UniFi API call step-by-step and returns raw responses.
   * Use this to diagnose auth, siteId, and endpoint availability issues.
   */
  fastify.get('/debug/unifi', async (_request, reply) => {
    const db = getDb()
    const row = db.select().from(serviceConfig).where(eq(serviceConfig.serviceName, 'unifi')).get()

    if (!SEED) return reply.status(500).send({ error: 'ENCRYPTION_KEY_SEED not configured' })
    if (!row?.baseUrl) return reply.status(404).send({ error: 'UniFi not configured' })

    let apiKey = ''
    if (row.encryptedApiKey) {
      try { apiKey = decrypt(row.encryptedApiKey, SEED) } catch { return reply.status(500).send({ error: 'Failed to decrypt UniFi API key' }) }
    }

    const baseUrl = row.baseUrl.replace(/\/$/, '')
    const opts = { headers: { 'X-API-KEY': apiKey }, timeout: 10_000, httpsAgent: unifiAgent }
    const result: Record<string, unknown> = { baseUrl, hasApiKey: apiKey !== '' }

    // Step 1: GET /sites
    let siteId: string | null = null
    try {
      const res = await axios.get(`${baseUrl}/proxy/network/integration/v1/sites`, opts)
      const sites = res.data?.data ?? []
      result['step1_sites'] = { status: res.status, siteCount: sites.length, sites, raw: res.data }
      const defaultSite = sites.find((s: Record<string, unknown>) => s.internalReference === 'default')
        ?? sites.find((s: Record<string, unknown>) => String(s.name ?? '').toLowerCase() === 'default')
        ?? sites[0]
      siteId = defaultSite?.id ?? null
      result['resolvedSiteId'] = siteId
    } catch (e: unknown) {
      result['step1_sites'] = { error: String(e) }
    }

    // Step 2: GET /sites/{siteId}/devices
    if (siteId) {
      try {
        const res = await axios.get(`${baseUrl}/proxy/network/integration/v1/sites/${siteId}/devices`, opts)
        const devices = res.data?.data ?? []
        result['step2_devices'] = { status: res.status, deviceCount: devices.length, firstDevice: devices[0] ?? null }
      } catch (e: unknown) {
        result['step2_devices'] = { error: String(e) }
      }

      // Step 3: GET /sites/{siteId}/clients
      try {
        const res = await axios.get(`${baseUrl}/proxy/network/integration/v1/sites/${siteId}/clients`, opts)
        result['step3_clients'] = { status: res.status, totalCount: res.data?.totalCount, raw: res.data }
      } catch (e: unknown) {
        result['step3_clients'] = { error: String(e) }
      }
    }

    // Step 4: GET /proxy/network/api/s/default/stat/health (WAN throughput)
    try {
      const res = await axios.get(`${baseUrl}/proxy/network/api/s/default/stat/health`, opts)
      const data = res.data?.data ?? []
      const wan = data.find((s: Record<string, unknown>) => s.subsystem === 'wan')
      result['step4_stat_health'] = { status: res.status, subsystems: data.map((s: Record<string, unknown>) => s.subsystem), wan }
    } catch (e: unknown) {
      result['step4_stat_health'] = { error: String(e) }
    }

    return reply.send(result)
  })
}
