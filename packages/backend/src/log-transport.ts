import { Writable } from 'node:stream'
import { getDb } from './db.js'
import { appLogs } from './schema.js'
import { logEvents, type LogEntry } from './log-events.js'

const LEVEL_MAP: Record<number, string> = { 30: 'info', 40: 'warn', 50: 'error' }

export class SqliteLogStream extends Writable {
  _write(chunk: Buffer, _enc: string, cb: () => void) {
    try {
      const line = chunk.toString().trim()
      if (!line) { cb(); return }
      const obj = JSON.parse(line) as Record<string, unknown>
      const numLevel = typeof obj.level === 'number' ? obj.level : 0
      if (numLevel < 30) { cb(); return } // skip debug/trace per D-25
      const levelStr = LEVEL_MAP[numLevel] ?? (numLevel >= 50 ? 'error' : 'info')
      const service = typeof obj.service === 'string' ? obj.service : 'system'
      const message = typeof obj.msg === 'string' ? obj.msg : ''
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: levelStr,
        service,
        message,
        payload: JSON.stringify(obj),
      }
      const result = getDb().insert(appLogs).values(entry).run()
      entry.id = Number(result.lastInsertRowid)
      logEvents.emit('entry', entry)
    } catch { /* malformed line — skip */ }
    cb()
  }
}
