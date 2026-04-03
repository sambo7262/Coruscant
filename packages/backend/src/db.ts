import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
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

export function getDb(): AppDb {
  if (!_db) {
    _db = createDb()
  }
  return _db
}

export function initDb(migrationsFolder: string): void {
  const db = getDb()
  migrate(db, { migrationsFolder })
}
