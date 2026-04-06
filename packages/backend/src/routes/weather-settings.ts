import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { getDb } from '../db.js'
import { kvStore } from '../schema.js'
import { geocodeZip } from '../adapters/weather.js'

/**
 * GET /api/settings/weather — returns current weather location config status.
 * POST /api/settings/weather — geocodes a zip code and stores lat/lon in kvStore.
 */
export async function weatherSettingsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/settings/weather
   * Returns: { zip: string | null, configured: boolean }
   */
  fastify.get('/api/settings/weather', async (_request, reply) => {
    const db = getDb()
    const zipRow = db.select().from(kvStore).where(eq(kvStore.key, 'weather.zip')).get()
    if (!zipRow) {
      return reply.send({ zip: null, configured: false })
    }
    return reply.send({ zip: zipRow.value, configured: true })
  })

  /**
   * POST /api/settings/weather
   * Body: { zip: string }
   * On success: geocodes zip, stores weather.zip, weather.lat, weather.lon in kvStore.
   * Returns: { success: true, location: string, lat: number, lon: number }
   * On geocode failure: returns { success: false, error: string }
   * On invalid input: returns 400
   */
  fastify.post<{ Body: { zip?: string } }>('/api/settings/weather', async (request, reply) => {
    const { zip } = request.body ?? {}

    if (!zip || typeof zip !== 'string' || zip.trim() === '') {
      return reply.code(400).send({ error: 'zip is required' })
    }

    try {
      const geocodeResult = await geocodeZip(zip.trim())
      const db = getDb()
      const now = new Date().toISOString()

      // Upsert weather.zip, weather.lat, weather.lon
      for (const [key, value] of [
        ['weather.zip', zip.trim()],
        ['weather.lat', String(geocodeResult.latitude)],
        ['weather.lon', String(geocodeResult.longitude)],
        ['weather.timezone', geocodeResult.timezone],
      ] as [string, string][]) {
        db.insert(kvStore)
          .values({ key, value, updatedAt: now })
          .onConflictDoUpdate({ target: kvStore.key, set: { value, updatedAt: now } })
          .run()
      }

      return reply.send({
        success: true,
        location: geocodeResult.name,
        lat: geocodeResult.latitude,
        lon: geocodeResult.longitude,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Geocoding failed'
      return reply.send({ success: false, error: message })
    }
  })
}
