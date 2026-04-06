import { fetchWeatherData } from './adapters/weather.js'
import { getDb } from './db.js'
import { kvStore } from './schema.js'
import { eq } from 'drizzle-orm'
import { pollManager } from './poll-manager.js'

export const WEATHER_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes (D-03)

/**
 * Start the weather polling timer.
 * - Reads weather.lat and weather.lon from kvStore to determine if configured.
 * - If not configured, the initial tick and all subsequent ticks are no-ops.
 * - On success: writes result to kvStore key `weather.current` and broadcasts snapshot.
 * - On failure: preserves last-known `weather.current` value (D-03 failure resilience).
 * Returns a cleanup function that clears the interval.
 */
export function startWeatherPoller(): () => void {
  const tick = async () => {
    const db = getDb()
    const latRow = db.select().from(kvStore).where(eq(kvStore.key, 'weather.lat')).get()
    const lonRow = db.select().from(kvStore).where(eq(kvStore.key, 'weather.lon')).get()
    if (!latRow || !lonRow) return // not configured yet — no-op

    try {
      const result = await fetchWeatherData(latRow.value, lonRow.value)
      const payload = JSON.stringify(result)
      db.insert(kvStore)
        .values({ key: 'weather.current', value: payload, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: kvStore.key, set: { value: payload, updatedAt: new Date().toISOString() } })
        .run()
      pollManager.broadcastSnapshot() // push to SSE clients immediately
    } catch {
      // D-03: On failure, do NOT overwrite weather.current — keep last known value
      // Frontend detects stale data via fetched_at age
    }
  }

  void tick() // immediate first poll
  const timer = setInterval(() => void tick(), WEATHER_INTERVAL_MS)
  return () => clearInterval(timer)
}
