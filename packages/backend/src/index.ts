import pino from 'pino'
import Fastify from 'fastify'
import staticPlugin from '@fastify/static'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'
import { schedule } from 'node-cron'
import { eq, lt } from 'drizzle-orm'
import { initDb, getDb } from './db.js'
import { healthRoutes } from './routes/health.js'
import { sseRoutes } from './routes/sse.js'
import { settingsRoutes } from './routes/settings.js'
import { testConnectionRoutes } from './routes/test-connection.js'
import { tautulliWebhookRoutes } from './routes/tautulli-webhook.js'
import { arrWebhookRoutes } from './routes/arr-webhooks.js'
import { debugRoutes } from './routes/debug.js'
import { piHealthRestartRoutes } from './routes/pi-health-restart.js'
import { logRoutes } from './routes/logs.js'
import { weatherSettingsRoutes } from './routes/weather-settings.js'
import { startWeatherPoller } from './weather-poller.js'
import { healthProbe, serviceConfig, appLogs, kvStore } from './schema.js'
import { pollManager } from './poll-manager.js'
import { decrypt } from './crypto.js'
import { SqliteLogStream } from './log-transport.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const DB_PATH = process.env.DB_PATH ?? '/app/data/coruscant.db'

// Ensure data directory exists
const dataDir = DB_PATH.substring(0, DB_PATH.lastIndexOf('/'))
if (dataDir && !existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const fastify = Fastify({
  logger: {
    stream: pino.multistream([
      { stream: process.stdout },
      { stream: new SqliteLogStream() },
    ]),
    level: 'info',
  },
})

// Register API routes
await fastify.register(healthRoutes)
await fastify.register(sseRoutes)
await fastify.register(settingsRoutes)
await fastify.register(testConnectionRoutes)
await fastify.register(tautulliWebhookRoutes)
await fastify.register(arrWebhookRoutes)
await fastify.register(debugRoutes)
await fastify.register(piHealthRestartRoutes)
await fastify.register(logRoutes)
await fastify.register(weatherSettingsRoutes)

// Serve compiled Vite bundle in production (D-23)
const frontendDist = join(__dirname, '../../frontend/dist')
if (existsSync(frontendDist)) {
  await fastify.register(staticPlugin, {
    root: frontendDist,
    prefix: '/',
    wildcard: false,
  })

  // SPA catch-all: serve index.html for non-API routes
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/health') || request.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'Not found' })
    }
    return reply.sendFile('index.html')
  })
}

// Initialise database — idempotent schema bootstrap + round-trip probe (D-05)
try {
  initDb()
  const db = getDb()
  // SQLite round-trip: write a probe row and read it back
  db.insert(healthProbe).values({ checkedAt: new Date().toISOString() }).run()
  const rows = db.select().from(healthProbe).limit(1).all()
  if (rows.length > 0) {
    fastify.log.info('SQLite persistence verified: round-trip probe succeeded')
  } else {
    fastify.log.warn('SQLite round-trip probe failed: no rows returned')
  }
} catch (err) {
  fastify.log.error({ err }, 'Database init failed')
  process.exit(1)
}

// Load saved service configs and start polling (D-06)
try {
  const db = getDb()
  const configs = db.select().from(serviceConfig).all()
  const seed = process.env.ENCRYPTION_KEY_SEED ?? ''
  for (const cfg of configs) {
    // piHealth has no API key (D-12) — skip encryptedApiKey check
    if (cfg.serviceName === 'piHealth' && cfg.enabled && cfg.baseUrl) {
      await pollManager.reload(cfg.serviceName, {
        baseUrl: cfg.baseUrl,
        apiKey: '',
        username: cfg.username ?? undefined,
      })
      continue
    }
    if (cfg.enabled && cfg.baseUrl && cfg.encryptedApiKey) {
      const apiKey = decrypt(cfg.encryptedApiKey, seed)
      await pollManager.reload(cfg.serviceName, {
        baseUrl: cfg.baseUrl,
        apiKey,
        username: cfg.username ?? undefined,
      })
    }
  }
} catch (err) {
  fastify.log.warn({ err }, 'Failed to load service configs for polling')
}

// Start weather poller (15-minute interval; no-op if not configured)
const stopWeather = startWeatherPoller()

// Nightly log prune at 3am — deletes entries older than retention_days (D-26, D-27)
schedule('0 3 * * *', () => {
  try {
    const db = getDb()
    const row = db.select().from(kvStore).where(eq(kvStore.key, 'logs.retention_days')).get()
    const retentionDays = row ? parseInt(row.value, 10) : 7
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
    const result = db.delete(appLogs).where(lt(appLogs.timestamp, cutoff)).run()
    fastify.log.info({ service: 'system', msg: 'log_prune_complete', cutoff, deleted: result.changes })
  } catch (err) {
    fastify.log.error({ err, service: 'system' }, 'Nightly log prune failed')
  }
})

// Graceful shutdown
const shutdown = async (signal: string) => {
  fastify.log.info({ signal }, 'Graceful shutdown initiated')
  stopWeather()
  pollManager.stopAll()
  await fastify.close()
  process.exit(0)
}
process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })

// Start server — host 0.0.0.0 is MANDATORY in Docker (research Pitfall 3)
await fastify.listen({ port: PORT, host: '0.0.0.0' })
