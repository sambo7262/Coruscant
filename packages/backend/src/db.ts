import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema.js'

export function createDb(dbPath: string = process.env.DB_PATH ?? '/app/data/coruscant.db') {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = normal')
  sqlite.pragma('cache_size = -10000')

  return drizzle({ client: sqlite, schema })
}

export type AppDb = ReturnType<typeof createDb>

let _db: AppDb | null = null
let _sqlite: Database.Database | null = null

export function getDb(): AppDb {
  if (!_db) {
    const dbPath = process.env.DB_PATH ?? '/app/data/coruscant.db'
    _sqlite = new Database(dbPath)
    _sqlite.pragma('journal_mode = WAL')
    _sqlite.pragma('synchronous = normal')
    _sqlite.pragma('cache_size = -10000')
    _db = drizzle({ client: _sqlite, schema })
  }
  return _db
}

/**
 * Idempotent schema bootstrap — uses CREATE TABLE IF NOT EXISTS so it works
 * on both fresh databases and existing ones that predate Drizzle migration tracking.
 */
export function initDb(): void {
  getDb()
  if (!_sqlite) return
  _sqlite.exec(`
    CREATE TABLE IF NOT EXISTS health_probe (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      checked_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS service_config (
      service_name TEXT PRIMARY KEY NOT NULL,
      base_url TEXT NOT NULL DEFAULT '',
      encrypted_api_key TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      service TEXT NOT NULL DEFAULT 'system',
      message TEXT NOT NULL,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
    CREATE INDEX IF NOT EXISTS idx_app_logs_service ON app_logs(service);
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  // Phase 4 migration: add username column if it doesn't exist yet.
  // SQLite does not support IF NOT EXISTS on ALTER TABLE, so we use PRAGMA table_info
  // to check before issuing the ALTER. This is idempotent and safe on any existing DB.
  const columns = (_sqlite.prepare('PRAGMA table_info(service_config)').all() as Array<{ name: string }>).map(c => c.name)
  if (!columns.includes('username')) {
    _sqlite.exec(`ALTER TABLE service_config ADD COLUMN username TEXT NOT NULL DEFAULT '';`)
  }
}
