import type { FastifyInstance } from 'fastify'
import { and, eq, lt, or, desc, count, inArray } from 'drizzle-orm'
import { getDb } from '../db.js'
import { appLogs } from '../schema.js'

export async function logRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/logs?limit=500&offset=0&level=all&service=all
   * Returns { entries: LogEntry[], total: number }
   */
  fastify.get<{
    Querystring: { limit?: string; offset?: string; level?: string; service?: string }
  }>('/api/logs', async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit ?? '500', 10) || 500, 1000)
    const offset = parseInt(request.query.offset ?? '0', 10) || 0
    const level = request.query.level ?? 'all'
    const service = request.query.service ?? 'all'

    const db = getDb()

    const filters = []

    // Level filter
    if (level === 'warn') {
      filters.push(inArray(appLogs.level, ['warn', 'error']))
    } else if (level === 'error') {
      filters.push(eq(appLogs.level, 'error'))
    }

    // Service filter
    if (service !== 'all') {
      filters.push(eq(appLogs.service, service))
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined

    const [entries, totalResult] = await Promise.all([
      db.select().from(appLogs)
        .where(whereClause)
        .orderBy(desc(appLogs.timestamp))
        .limit(limit)
        .offset(offset)
        .all(),
      db.select({ count: count() }).from(appLogs).where(whereClause).get(),
    ])

    return reply.send({
      entries,
      total: totalResult?.count ?? 0,
    })
  })

  /**
   * GET /api/logs/services
   * Returns { services: string[] } — all distinct service names in the logs table
   */
  fastify.get('/api/logs/services', async (_request, reply) => {
    const db = getDb()
    const rows = db.selectDistinct({ service: appLogs.service }).from(appLogs).all()
    const services = rows.map((r) => r.service).filter(Boolean).sort()
    return reply.send({ services })
  })

  /**
   * POST /api/logs/purge
   * Body: { olderThanDays: number }
   * Returns { deleted: number }
   */
  fastify.post<{ Body: { olderThanDays?: number } }>('/api/logs/purge', async (request, reply) => {
    const olderThanDays = request.body.olderThanDays ?? 7
    if (typeof olderThanDays !== 'number' || olderThanDays < 0) {
      return reply.code(400).send({ error: 'olderThanDays must be a non-negative number' })
    }

    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
    const db = getDb()
    const result = db.delete(appLogs).where(lt(appLogs.timestamp, cutoff)).run()

    return reply.send({ deleted: result.changes })
  })

  /**
   * GET /api/logs/export?level=all&service=all&format=json
   * Returns Content-Disposition attachment with all matching entries as JSON array.
   */
  fastify.get<{
    Querystring: { level?: string; service?: string; format?: string }
  }>('/api/logs/export', async (request, reply) => {
    const level = request.query.level ?? 'all'
    const service = request.query.service ?? 'all'

    const db = getDb()

    const filters = []

    if (level === 'warn') {
      filters.push(inArray(appLogs.level, ['warn', 'error']))
    } else if (level === 'error') {
      filters.push(eq(appLogs.level, 'error'))
    }

    if (service !== 'all') {
      filters.push(eq(appLogs.service, service))
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined

    const entries = db.select().from(appLogs)
      .where(whereClause)
      .orderBy(desc(appLogs.timestamp))
      .all()

    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `coruscant-logs-${dateStr}.json`

    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    reply.header('Content-Type', 'application/json')
    return reply.send(JSON.stringify(entries, null, 2))
  })
}
