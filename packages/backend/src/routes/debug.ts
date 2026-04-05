import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import { eq } from 'drizzle-orm'
import { getDb } from '../db.js'
import { serviceConfig } from '../schema.js'
import { decrypt } from '../crypto.js'

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

    // Step 3: SYNO.Docker.Container list — POST with JSON body (requestFormat=JSON requires this)
    const containerListAttempts: Record<string, unknown>[] = []
    for (const method of ['list', 'getinfo']) {
      try {
        const res = await axios.post(
          `${baseUrl}/webapi/entry.cgi`,
          { api: 'SYNO.Docker.Container', version: 1, method, _sid: sid },
          { headers: { 'Content-Type': 'application/json' }, timeout: 5000 },
        )
        containerListAttempts.push({ method, via: 'POST/JSON', success: res.data?.success, dataKeys: Object.keys(res.data?.data ?? {}), raw: res.data })
      } catch (e: unknown) {
        containerListAttempts.push({ method, via: 'POST/JSON', error: String(e) })
      }
    }

    // Step 4: SYNO.Docker.Container.Resource — CPU/RAM stats per container
    const resourceAttempts: Record<string, unknown>[] = []
    for (const method of ['list', 'get', 'getinfo']) {
      try {
        const res = await axios.post(
          `${baseUrl}/webapi/entry.cgi`,
          { api: 'SYNO.Docker.Container.Resource', version: 1, method, _sid: sid },
          { headers: { 'Content-Type': 'application/json' }, timeout: 5000 },
        )
        resourceAttempts.push({ method, success: res.data?.success, dataKeys: Object.keys(res.data?.data ?? {}), raw: res.data })
      } catch (e: unknown) {
        resourceAttempts.push({ method, error: String(e) })
      }
    }

    // Step 5: SYNO.Docker.Project list — Docker Compose projects
    let projectList: unknown = null
    try {
      const res = await axios.post(
        `${baseUrl}/webapi/entry.cgi`,
        { api: 'SYNO.Docker.Project', version: 1, method: 'list', _sid: sid },
        { headers: { 'Content-Type': 'application/json' }, timeout: 5000 },
      )
      projectList = { success: res.data?.success, dataKeys: Object.keys(res.data?.data ?? {}), raw: res.data }
    } catch (e: unknown) {
      projectList = { error: String(e) }
    }

    return reply.send({ discoveryAll, containerListAttempts, resourceAttempts, projectList })
  })
}
