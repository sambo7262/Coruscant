import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDb } from '../db.js'
import { serviceConfig } from '../schema.js'
import { encrypt } from '../crypto.js'
import { pollManager } from '../poll-manager.js'

const VALID_SERVICES = [
  'radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd',
  'pihole', 'plex', 'nas',
] as const

type ValidService = (typeof VALID_SERVICES)[number]

function isValidService(id: string): id is ValidService {
  return (VALID_SERVICES as readonly string[]).includes(id)
}

export async function settingsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/settings — list config status for all managed services.
   * Never returns plaintext API keys.
   */
  fastify.get('/api/settings', async (_request, reply) => {
    const db = getDb()
    const rows = db.select().from(serviceConfig).all()
    const rowMap = new Map(rows.map((r) => [r.serviceName, r]))

    const result = VALID_SERVICES.map((id) => {
      const row = rowMap.get(id)
      if (!row) {
        return { serviceName: id, baseUrl: '', hasApiKey: false, username: '', enabled: false }
      }
      return {
        serviceName: row.serviceName,
        baseUrl: row.baseUrl,
        hasApiKey: row.encryptedApiKey !== '',
        username: row.username,
        enabled: row.enabled,
      }
    })

    return reply.send(result)
  })

  /**
   * GET /api/settings/:serviceId — read config for one service.
   * Never returns plaintext API keys.
   */
  fastify.get<{ Params: { serviceId: string } }>(
    '/api/settings/:serviceId',
    async (request, reply) => {
      const { serviceId } = request.params

      if (!isValidService(serviceId)) {
        return reply.code(400).send({ error: `Unknown service: ${serviceId}` })
      }

      const db = getDb()
      const rows = db
        .select()
        .from(serviceConfig)
        .where(eq(serviceConfig.serviceName, serviceId))
        .all()

      if (rows.length === 0) {
        return reply.send({
          serviceName: serviceId,
          baseUrl: '',
          hasApiKey: false,
          username: '',
          enabled: false,
        })
      }

      const row = rows[0]!
      return reply.send({
        serviceName: row.serviceName,
        baseUrl: row.baseUrl,
        hasApiKey: row.encryptedApiKey !== '',
        username: row.username,
        enabled: row.enabled,
      })
    },
  )

  /**
   * POST /api/settings/:serviceId — upsert service config.
   * Encrypts API key before storage. Triggers PollManager hot-reload.
   * username is stored plaintext (DSM login name, not a secret).
   */
  fastify.post<{
    Params: { serviceId: string }
    Body: { baseUrl?: string; apiKey?: string; username?: string }
  }>('/api/settings/:serviceId', async (request, reply) => {
    const { serviceId } = request.params

    if (!isValidService(serviceId)) {
      return reply.code(400).send({ error: `Unknown service: ${serviceId}` })
    }

    const seed = process.env.ENCRYPTION_KEY_SEED
    if (!seed) {
      return reply.code(500).send({ error: 'ENCRYPTION_KEY_SEED is not configured' })
    }

    const baseUrl = (request.body.baseUrl ?? '').trim()
    const apiKey = (request.body.apiKey ?? '').trim()
    const username = (request.body.username ?? '').trim()

    // Both empty → disable the service
    if (baseUrl === '' && apiKey === '') {
      const db = getDb()
      db.insert(serviceConfig)
        .values({
          serviceName: serviceId,
          baseUrl: '',
          encryptedApiKey: '',
          username: '',
          enabled: false,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: serviceConfig.serviceName,
          set: {
            baseUrl: '',
            encryptedApiKey: '',
            username: '',
            enabled: false,
            updatedAt: new Date().toISOString(),
          },
        })
        .run()

      // Stop polling for this service
      await pollManager.reload(serviceId, null)
      return reply.send({ ok: true })
    }

    const db = getDb()

    // Encrypt new API key if provided.
    // If apiKey is empty and an existing row already has an encrypted key, preserve it
    // rather than overwriting with '' — otherwise a save without re-entering credentials
    // would silently wipe the stored password (affects NAS DSM password, Plex token, etc.).
    let encryptedApiKey: string
    if (apiKey !== '') {
      encryptedApiKey = encrypt(apiKey, seed)
    } else {
      // Check for an existing encrypted key to preserve
      const existing = db
        .select({ encryptedApiKey: serviceConfig.encryptedApiKey })
        .from(serviceConfig)
        .where(eq(serviceConfig.serviceName, serviceId))
        .all()
      encryptedApiKey = existing[0]?.encryptedApiKey ?? ''
    }

    db.insert(serviceConfig)
      .values({
        serviceName: serviceId,
        baseUrl,
        encryptedApiKey,
        username,
        enabled: true,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: serviceConfig.serviceName,
        set: {
          baseUrl,
          encryptedApiKey,
          username,
          enabled: true,
          updatedAt: new Date().toISOString(),
        },
      })
      .run()

    // Hot-reload polling with the new config (D-06)
    await pollManager.reload(serviceId, { baseUrl, apiKey, username })

    return reply.send({ ok: true })
  })
}
