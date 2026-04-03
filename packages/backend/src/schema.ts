import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Minimal table to prove SQLite persistence works.
// Real schema grows in Phase 3+.
export const healthProbe = sqliteTable('health_probe', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  checkedAt: text('checked_at').notNull(),
})

/**
 * Stores per-service connection config with encrypted API credentials.
 * Valid serviceName values: 'radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd'
 * encryptedApiKey is AES-256-GCM encrypted using the ENCRYPTION_KEY_SEED env var.
 */
export const serviceConfig = sqliteTable('service_config', {
  serviceName: text('service_name').primaryKey(),
  baseUrl: text('base_url').notNull().default(''),
  encryptedApiKey: text('encrypted_api_key').notNull().default(''),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
})
