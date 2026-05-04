import type { FastifyInstance } from 'fastify'
import { and, eq, gte } from 'drizzle-orm'
import { getDb } from '../db.js'
import { metricsHistory } from '../schema.js'

// PERF-02: In-memory TTL cache — 9 possible keys (3 services x 3 windows), plain Map suffices
interface CacheEntry {
  result: { service: string; window: string; points: Array<Record<string, number | string>> }
  expiresAt: number
}
const responseCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 45_000  // 45s — midpoint of 30-60s success criteria

/** Exported for test isolation only — clears all cached entries. */
export function clearMetricsCache(): void {
  responseCache.clear()
}

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: { service?: string; window?: string }
  }>('/api/metrics/history', async (request, reply) => {
    const service = request.query.service ?? 'all'
    const window = request.query.window ?? '24h'

    const validWindows = ['24h', '3d', '7d'] as const
    if (!validWindows.includes(window as typeof validWindows[number])) {
      return reply.code(400).send({ error: 'window must be one of: 24h, 3d, 7d' })
    }

    // PERF-02: return cached result if within TTL
    const cacheKey = `${service}:${window}`
    const cached = responseCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return reply.send(cached.result)
    }

    const windowMs = window === '24h' ? 24 * 60 * 60 * 1000
                   : window === '3d'  ? 3 * 24 * 60 * 60 * 1000
                   :                    7 * 24 * 60 * 60 * 1000
    const bucketMs = window === '24h' ? 60_000 : window === '3d' ? 300_000 : 900_000

    const cutoff = new Date(Date.now() - windowMs).toISOString()
    const db = getDb()

    const filters = [gte(metricsHistory.timestamp, cutoff)]
    if (service !== 'all') {
      filters.push(eq(metricsHistory.service, service))
    }

    const rows = db.select().from(metricsHistory)
      .where(and(...filters))
      .orderBy(metricsHistory.timestamp)
      .all()

    const points = bucketPoints(rows, bucketMs)
    const response = { service, window, points }
    responseCache.set(cacheKey, { result: response, expiresAt: Date.now() + CACHE_TTL_MS })
    return reply.send(response)
  })
}

function bucketPoints(
  rows: Array<{ timestamp: string; metrics: string }>,
  bucketMs: number
): Array<Record<string, number | string>> {
  const buckets = new Map<number, { sum: Record<string, number>; count: number }>()
  for (const row of rows) {
    const ts = new Date(row.timestamp).getTime()
    const bucket = Math.floor(ts / bucketMs) * bucketMs
    let metrics: Record<string, unknown>
    try { metrics = JSON.parse(row.metrics) } catch { continue }
    const existing = buckets.get(bucket) ?? { sum: {}, count: 0 }
    for (const [k, v] of Object.entries(metrics)) {
      if (typeof v === 'number') {
        existing.sum[k] = (existing.sum[k] ?? 0) + v
      }
    }
    existing.count++
    buckets.set(bucket, existing)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ts, { sum, count }]) => ({
      timestamp: new Date(ts).toISOString(),
      ...Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v / count])),
    }))
}
