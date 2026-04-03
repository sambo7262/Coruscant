import { describe, it, expect } from 'vitest'
import { generateMockSnapshot } from '../mock/generator.js'

describe('generateMockSnapshot', () => {
  it('returns services array of length >= 8', () => {
    const snapshot = generateMockSnapshot()
    expect(Array.isArray(snapshot.services)).toBe(true)
    expect(snapshot.services.length).toBeGreaterThanOrEqual(8)
  })

  it('each service has id, name, tier, status, lastPollAt fields', () => {
    const snapshot = generateMockSnapshot()
    for (const service of snapshot.services) {
      expect(service).toHaveProperty('id')
      expect(service).toHaveProperty('name')
      expect(service).toHaveProperty('tier')
      expect(service).toHaveProperty('status')
      expect(service).toHaveProperty('lastPollAt')
      expect(typeof service.id).toBe('string')
      expect(typeof service.name).toBe('string')
      expect(typeof service.lastPollAt).toBe('string')
    }
  })

  it('snapshot.nas has cpu (0-100), ram (0-100), volumes array with at least 1 entry', () => {
    const snapshot = generateMockSnapshot()
    expect(snapshot.nas).toBeDefined()
    expect(typeof snapshot.nas.cpu).toBe('number')
    expect(snapshot.nas.cpu).toBeGreaterThanOrEqual(0)
    expect(snapshot.nas.cpu).toBeLessThanOrEqual(100)
    expect(typeof snapshot.nas.ram).toBe('number')
    expect(snapshot.nas.ram).toBeGreaterThanOrEqual(0)
    expect(snapshot.nas.ram).toBeLessThanOrEqual(100)
    expect(Array.isArray(snapshot.nas.volumes)).toBe(true)
    expect(snapshot.nas.volumes.length).toBeGreaterThanOrEqual(1)
  })

  it('snapshot.streams is an array with 2 mock PlexStream entries', () => {
    const snapshot = generateMockSnapshot()
    expect(Array.isArray(snapshot.streams)).toBe(true)
    expect(snapshot.streams.length).toBe(2)
  })

  it('calling generateMockSnapshot() twice produces different cpu values (jitter proof)', () => {
    // Run many times — with Math.random() jitter, the probability of matching 100 times is astronomically low
    const cpus = new Set<number>()
    for (let i = 0; i < 20; i++) {
      cpus.add(generateMockSnapshot().nas.cpu)
    }
    expect(cpus.size).toBeGreaterThan(1)
  })

  it('snapshot.timestamp is a valid ISO 8601 string', () => {
    const snapshot = generateMockSnapshot()
    expect(typeof snapshot.timestamp).toBe('string')
    const parsed = new Date(snapshot.timestamp)
    expect(isNaN(parsed.getTime())).toBe(false)
    expect(snapshot.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('all service status values are one of the valid states', () => {
    const validStatuses = new Set(['online', 'offline', 'warning', 'stale'])
    const snapshot = generateMockSnapshot()
    for (const service of snapshot.services) {
      expect(validStatuses.has(service.status)).toBe(true)
    }
  })

  it('all tier values are one of the valid tiers', () => {
    const validTiers = new Set(['status', 'activity', 'rich'])
    const snapshot = generateMockSnapshot()
    for (const service of snapshot.services) {
      expect(validTiers.has(service.tier)).toBe(true)
    }
  })
})
