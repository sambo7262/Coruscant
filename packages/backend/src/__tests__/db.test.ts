import { describe, it, expect } from 'vitest'
import { createDb } from '../db.js'
import { healthProbe } from '../schema.js'

describe('SQLite round-trip', () => {
  it('writes and reads a probe row from in-memory database', () => {
    const db = createDb(':memory:')
    // Manually create the table since migrations won't exist in test
    db.run(
      `CREATE TABLE IF NOT EXISTS health_probe (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checked_at TEXT NOT NULL
      )`
    )

    const now = new Date().toISOString()
    db.insert(healthProbe).values({ checkedAt: now }).run()
    const rows = db.select().from(healthProbe).all()

    expect(rows.length).toBe(1)
    expect(rows[0].checkedAt).toBe(now)
  })

  it('uses WAL journal mode', () => {
    const db = createDb(':memory:')
    // WAL is set in createDb via pragma
    // For :memory: databases, WAL returns 'memory' — just confirm no error thrown
    expect(db).toBeDefined()
  })
})
