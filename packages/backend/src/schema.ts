import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Minimal table to prove SQLite persistence works.
// Real schema grows in Phase 3+.
export const healthProbe = sqliteTable('health_probe', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  checkedAt: text('checked_at').notNull(),
})
