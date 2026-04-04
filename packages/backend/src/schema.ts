import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Minimal table to prove SQLite persistence works.
// Real schema grows in Phase 3+.
export const healthProbe = sqliteTable('health_probe', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  checkedAt: text('checked_at').notNull(),
})

/**
 * Stores per-service connection config with encrypted API credentials.
 * Valid serviceName values: 'radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd',
 *   'pihole', 'plex', 'nas'
 * encryptedApiKey is AES-256-GCM encrypted using the ENCRYPTION_KEY_SEED env var.
 * username is used by the NAS service for the DSM login username; empty string for all other services.
 */
export const serviceConfig = sqliteTable('service_config', {
  serviceName: text('service_name').primaryKey(),
  baseUrl: text('base_url').notNull().default(''),
  encryptedApiKey: text('encrypted_api_key').notNull().default(''),
  username: text('username').notNull().default(''),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
})
