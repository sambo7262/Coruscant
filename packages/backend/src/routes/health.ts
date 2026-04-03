import type { FastifyInstance } from 'fastify'
import { getDb } from '../db.js'
import { sql } from 'drizzle-orm'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    const db = getDb()
    // Simple SELECT to confirm DB is readable
    const result = db.get(sql`SELECT 1 as ping`)
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: result ? 'connected' : 'error',
    }
  })
}
