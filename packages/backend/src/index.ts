import Fastify from 'fastify'
import staticPlugin from '@fastify/static'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'
import { initDb, getDb } from './db.js'
import { healthRoutes } from './routes/health.js'
import { sseRoutes } from './routes/sse.js'
import { healthProbe } from './schema.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const DB_PATH = process.env.DB_PATH ?? '/app/data/coruscant.db'

// Ensure data directory exists
const dataDir = DB_PATH.substring(0, DB_PATH.lastIndexOf('/'))
if (dataDir && !existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const fastify = Fastify({ logger: true })

// Register API routes
await fastify.register(healthRoutes)
await fastify.register(sseRoutes)

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

// Initialise database — run migrations and perform round-trip probe (D-05)
try {
  initDb(join(__dirname, '../../../drizzle'))
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
  fastify.log.warn({ err }, 'Database migration or probe skipped (migrations may not exist yet)')
}

// Start server — host 0.0.0.0 is MANDATORY in Docker (research Pitfall 3)
await fastify.listen({ port: PORT, host: '0.0.0.0' })
