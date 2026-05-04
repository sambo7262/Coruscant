import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import { eq } from 'drizzle-orm'
import { getDb } from '../db.js'
import { serviceConfig } from '../schema.js'
import { decrypt } from '../crypto.js'
import { fetchNasProcesses } from '../adapters/nas.js'

const SEED = process.env.ENCRYPTION_KEY_SEED

export async function nasProcessesRoutes(fastify: FastifyInstance) {
  // Production endpoint: returns parsed, labeled, sorted top 5
  fastify.get('/api/nas/processes', async (_request, reply) => {
    const db = getDb()
    const row = db.select().from(serviceConfig).where(eq(serviceConfig.serviceName, 'nas')).get()

    if (!SEED) return reply.status(500).send({ error: 'ENCRYPTION_KEY_SEED not configured' })
    if (!row?.baseUrl) return reply.status(404).send({ error: 'NAS not configured' })

    const baseUrl = row.baseUrl.replace(/\/$/, '')
    const username = row.username ?? ''
    let password = ''
    if (row.encryptedApiKey) {
      try {
        password = decrypt(row.encryptedApiKey, SEED)
      } catch (decryptErr) {
        fastify.log.error({ err: decryptErr }, 'nas-processes: failed to decrypt NAS password')
        return reply.status(500).send({ error: 'Failed to decrypt NAS credentials' })
      }
    }

    const cpuOverall = Number((_request.query as Record<string, string>).cpu) || undefined

    try {
      const processes = await fetchNasProcesses(baseUrl, username, password, cpuOverall)
      return reply.send({ processes })
    } catch (err) {
      fastify.log.error({ err }, 'nas-processes: fetch failed')
      return reply.status(502).send({ error: 'DSM unreachable' })
    }
  })

  // Debug passthrough: returns raw DSM response for field-name inspection
  fastify.get('/debug/nas-processes', async (_request, reply) => {
    const db = getDb()
    const row = db.select().from(serviceConfig).where(eq(serviceConfig.serviceName, 'nas')).get()

    if (!SEED) return reply.status(500).send({ error: 'ENCRYPTION_KEY_SEED not configured' })
    if (!row?.baseUrl) return reply.status(404).send({ error: 'NAS not configured' })

    const baseUrl = row.baseUrl.replace(/\/$/, '')
    const username = row.username ?? ''
    let password = ''
    if (row.encryptedApiKey) {
      try {
        password = decrypt(row.encryptedApiKey, SEED)
      } catch (decryptErr) {
        fastify.log.error({ err: decryptErr }, 'debug/nas-processes: failed to decrypt NAS password')
        return reply.status(500).send({ error: 'Failed to decrypt NAS credentials' })
      }
    }

    // Step 1: Authenticate (own session, not sharing ensureSession — debug route is standalone)
    let sid: string
    try {
      const authRes = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
        params: { api: 'SYNO.API.Auth', version: 3, method: 'login', account: username, passwd: password, format: 'sid' },
        timeout: 5000,
      })
      sid = authRes.data?.data?.sid
      if (!sid) return reply.status(502).send({ error: 'DSM auth failed — no SID', raw: authRes.data })
    } catch (authErr) {
      return reply.status(502).send({ error: 'DSM auth failed', detail: String(authErr) })
    }

    // Step 2: Query SYNO.API.Info for Process API availability
    let apiInfo: unknown = null
    try {
      const infoRes = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
        params: { api: 'SYNO.API.Info', version: 1, method: 'query', query: 'SYNO.Core.System.Process', _sid: sid },
        timeout: 5000,
      })
      apiInfo = infoRes.data
    } catch { /* non-fatal */ }

    // Step 3: Call SYNO.Core.System.Process list — return raw
    try {
      const procRes = await axios.get(`${baseUrl}/webapi/entry.cgi`, {
        params: { api: 'SYNO.Core.System.Process', version: 1, method: 'list', _sid: sid },
        timeout: 10000,
      })
      return reply.send({
        apiInfo,
        rawProcessResponse: procRes.data,
        sampleKeys: Array.isArray(procRes.data?.data?.processes)
          ? Object.keys(procRes.data.data.processes[0] ?? {})
          : Array.isArray(procRes.data?.data)
          ? Object.keys(procRes.data.data[0] ?? {})
          : [],
      })
    } catch (procErr) {
      return reply.status(502).send({ error: 'SYNO.Core.System.Process call failed', detail: String(procErr), apiInfo })
    }
  })
}
