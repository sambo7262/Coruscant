process.env.DB_PATH = ':memory:'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initDb, getSqlite } from '../db.js'
import { PollManager } from '../poll-manager.js'

describe('PollManager metric buffer (PERF-01)', () => {
  let pm: PollManager

  beforeEach(() => {
    vi.useFakeTimers()
    initDb()
    const sqlite = getSqlite()!
    sqlite.exec('DELETE FROM metrics_history')
    pm = new PollManager()
  })

  afterEach(() => {
    pm.stopAll()
    vi.useRealTimers()
  })

  it('does not write to SQLite immediately on writeMetricsSnapshot', () => {
    // writeMetricsSnapshot is private — access via bracket notation for testing
    ;(pm as any).writeMetricsSnapshot('nas', { cpu: 50, ram: 60 })

    const sqlite = getSqlite()!
    const count = sqlite.prepare('SELECT COUNT(*) as c FROM metrics_history').get() as { c: number }
    expect(count.c).toBe(0)  // buffered, not written yet
  })

  it('flushes all buffered rows after 5 seconds', () => {
    ;(pm as any).writeMetricsSnapshot('nas', { cpu: 50 })
    ;(pm as any).writeMetricsSnapshot('nas', { cpu: 55 })
    ;(pm as any).writeMetricsSnapshot('pihole', { queriesPerSecond: 10 })

    vi.advanceTimersByTime(5_000)

    const sqlite = getSqlite()!
    const count = sqlite.prepare('SELECT COUNT(*) as c FROM metrics_history').get() as { c: number }
    expect(count.c).toBe(3)
  })

  it('reduces write syscalls — 10 writes in 5s become 1 flush', () => {
    const sqlite = getSqlite()!
    let transactionCallCount = 0
    const origTransaction = sqlite.transaction.bind(sqlite)
    sqlite.transaction = function (...args: any[]) {
      transactionCallCount++
      return (origTransaction as any)(...args)
    } as any

    for (let i = 0; i < 10; i++) {
      ;(pm as any).writeMetricsSnapshot('nas', { cpu: i })
    }
    vi.advanceTimersByTime(5_000)

    expect(transactionCallCount).toBe(1)  // 10 writes, 1 transaction
    sqlite.transaction = origTransaction  // restore
  })

  it('stopAll() flushes buffer synchronously before clearing timers', () => {
    ;(pm as any).writeMetricsSnapshot('nas', { cpu: 99 })
    // Do NOT advance timer — call stopAll directly
    pm.stopAll()

    const sqlite = getSqlite()!
    const count = sqlite.prepare('SELECT COUNT(*) as c FROM metrics_history').get() as { c: number }
    expect(count.c).toBe(1)  // flushed on shutdown
  })

  it('handles flush failure without crashing', () => {
    ;(pm as any).writeMetricsSnapshot('nas', { cpu: 50 })

    // Sabotage the table
    const sqlite = getSqlite()!
    sqlite.exec('DROP TABLE metrics_history')

    // Should not throw
    expect(() => vi.advanceTimersByTime(5_000)).not.toThrow()
  })
})
