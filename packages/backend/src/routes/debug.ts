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

    // Step 2: try all known Container Manager API paths
    const attempts: Record<string, unknown>[] = []
    for (const api of ['SYNO.Docker.Container', 'SYNO.ContainerManager.Container']) {
      for (const version of ['1', '2']) {
        try {
          const res = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
            params: { api, version, method: 'list', _sid: sid },
            timeout: 5000,
          })
          attempts.push({ api, version, success: res.data?.success, dataKeys: Object.keys(res.data?.data ?? {}), raw: res.data })
        } catch (e: unknown) {
          attempts.push({ api, version, error: String(e) })
        }
      }
    }

    return reply.send({ attempts })
  })
}
