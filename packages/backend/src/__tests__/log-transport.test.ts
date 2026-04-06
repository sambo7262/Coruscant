import { describe, it, expect, beforeEach } from 'vitest'

// Set in-memory DB before any imports that call getDb()
process.env.DB_PATH = ':memory:'

import { initDb, getDb } from '../db.js'
import { SqliteLogStream } from '../log-transport.js'
import { appLogs } from '../schema.js'
import { logEvents } from '../log-events.js'

function bootstrapTestDb() {
  initDb()
}

function writeToStream(stream: SqliteLogStream, obj: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    const chunk = Buffer.from(JSON.stringify(obj) + '\n')
    stream._write(chunk, 'utf8', () => resolve())
  })
}

describe('SqliteLogStream', () => {
  let stream: SqliteLogStream

  beforeEach(() => {
    bootstrapTestDb()
    // Clear existing log entries
    getDb().delete(appLogs).run()
    stream = new SqliteLogStream()
  })

  it('inserts an info-level pino log line (level 30) into app_logs', async () => {
    await writeToStream(stream, { level: 30, msg: 'test message', service: 'nas', time: Date.now() })

    const rows = getDb().select().from(appLogs).all()
    expect(rows.length).toBe(1)
    expect(rows[0]!.level).toBe('info')
    expect(rows[0]!.service).toBe('nas')
    expect(rows[0]!.message).toBe('test message')
  })

  it('inserts a warn-level line (level 40) with level="warn"', async () => {
    await writeToStream(stream, { level: 40, msg: 'warning occurred', service: 'plex' })

    const rows = getDb().select().from(appLogs).all()
    expect(rows.length).toBe(1)
    expect(rows[0]!.level).toBe('warn')
    expect(rows[0]!.service).toBe('plex')
  })

  it('inserts an error-level line (level 50) with level="error"', async () => {
    await writeToStream(stream, { level: 50, msg: 'something failed', service: 'system' })

    const rows = getDb().select().from(appLogs).all()
    expect(rows.length).toBe(1)
    expect(rows[0]!.level).toBe('error')
  })

  it('skips debug-level lines (level 20 < 30)', async () => {
    await writeToStream(stream, { level: 20, msg: 'debug noise', service: 'system' })

    const rows = getDb().select().from(appLogs).all()
    expect(rows.length).toBe(0)
  })

  it('skips trace-level lines (level 10 < 30)', async () => {
    await writeToStream(stream, { level: 10, msg: 'trace noise', service: 'system' })

    const rows = getDb().select().from(appLogs).all()
    expect(rows.length).toBe(0)
  })

  it('does not throw on malformed JSON', async () => {
    await expect(
      new Promise<void>((resolve) => {
        stream._write(Buffer.from('not json at all'), 'utf8', () => resolve())
      }),
    ).resolves.toBeUndefined()

    const rows = getDb().select().from(appLogs).all()
    expect(rows.length).toBe(0)
  })

  it('emits a log-entry event on successful insert', async () => {
    const emitted: unknown[] = []
    const handler = (entry: unknown) => emitted.push(entry)
    logEvents.on('entry', handler)

    await writeToStream(stream, { level: 30, msg: 'event test', service: 'pihole' })

    logEvents.off('entry', handler)
    expect(emitted.length).toBe(1)
    expect((emitted[0] as { level: string }).level).toBe('info')
  })

  it('uses "system" as default service when obj.service is not a string', async () => {
    await writeToStream(stream, { level: 30, msg: 'no service field' })

    const rows = getDb().select().from(appLogs).all()
    expect(rows.length).toBe(1)
    expect(rows[0]!.service).toBe('system')
  })
})
