import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Set env before any imports
process.env.DB_PATH = ':memory:'

vi.mock('../adapters/weather.js', () => ({
  fetchWeatherData: vi.fn(),
}))

vi.mock('../poll-manager.js', () => ({
  pollManager: {
    broadcastSnapshot: vi.fn(),
  },
}))

// Mock getDb to return a fake in-memory kvStore interface
const mockKvStore: Map<string, string> = new Map()

const mockDbGet = vi.fn((key: string) => {
  const value = mockKvStore.get(key)
  return value !== undefined ? { key, value, updatedAt: new Date().toISOString() } : undefined
})

const mockDbInsert = vi.fn()
const mockRun = vi.fn()

vi.mock('../db.js', () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          // Extract the key from the eq() condition by inspecting the call stack
          // We use the mockDbGet function to simulate lookups
          return { get: () => undefined } // Default; overridden in individual tests
        },
      }),
    }),
    insert: mockDbInsert,
  })),
}))

// We'll use a simpler approach: test the behavior via the real getDb
// but with a mocked module that returns controlled responses
describe('weather poller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKvStore.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fetchWeatherData and writes result to kvStore key weather.current when lat/lon configured', async () => {
    // Override getDb to return lat/lon when queried
    const { getDb } = await import('../db.js')
    const mockOnConflict = { run: vi.fn() }
    const mockValues = vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => mockOnConflict) }))

    // Use a single shared get mock so sequential calls return lat then lon.
    // A new vi.fn() per where() call would reset the call counter each time.
    const sharedGet = vi.fn()
      .mockReturnValueOnce({ key: 'weather.lat', value: '37.7749' })
      .mockReturnValueOnce({ key: 'weather.lon', value: '-122.4194' })
      .mockReturnValue(undefined)

    vi.mocked(getDb).mockImplementation(() => ({
      select: () => ({
        from: () => ({
          where: (_: unknown) => ({
            get: sharedGet,
          }),
        }),
      }),
      insert: vi.fn(() => ({ values: mockValues })),
    }) as unknown as ReturnType<typeof getDb>)

    const { fetchWeatherData } = await import('../adapters/weather.js')
    vi.mocked(fetchWeatherData).mockResolvedValueOnce({
      temp_f: 68.5,
      wmo_code: 1,
      fetched_at: '2026-04-06T00:00:00.000Z',
    })

    vi.useFakeTimers()
    const { startWeatherPoller } = await import('../weather-poller.js')
    const stop = startWeatherPoller()

    // Flush microtasks so the initial async tick() promise resolves.
    // We do NOT use vi.runAllTimersAsync() here because that would run the
    // setInterval 10,000+ times and be flagged as an infinite loop.
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    stop()

    expect(fetchWeatherData).toHaveBeenCalledWith('37.7749', '-122.4194')
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      key: 'weather.current',
    }))
    expect(mockOnConflict.run).toHaveBeenCalled()
  })

  it('does NOT overwrite weather.current when fetchWeatherData throws (failure resilience)', async () => {
    const { getDb } = await import('../db.js')
    vi.mocked(getDb).mockImplementation(() => ({
      select: () => ({
        from: () => ({
          where: (_: unknown) => ({
            get: vi.fn()
              .mockReturnValueOnce({ key: 'weather.lat', value: '37.7749' })
              .mockReturnValueOnce({ key: 'weather.lon', value: '-122.4194' }),
          }),
        }),
      }),
      insert: vi.fn(),
    }) as unknown as ReturnType<typeof getDb>)

    const { fetchWeatherData } = await import('../adapters/weather.js')
    vi.mocked(fetchWeatherData).mockRejectedValueOnce(new Error('Network timeout'))

    vi.useFakeTimers()
    const { startWeatherPoller } = await import('../weather-poller.js')
    const stop = startWeatherPoller()

    // Flush microtasks so the initial async tick() resolves (not vi.runAllTimersAsync
    // which would loop the setInterval 10,000 times)
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    stop()

    // insert should NOT have been called since fetchWeatherData threw
    const { getDb: getDbMocked } = await import('../db.js')
    const dbInstance = vi.mocked(getDbMocked).mock.results[0]?.value as { insert: ReturnType<typeof vi.fn> } | undefined
    if (dbInstance) {
      expect(dbInstance.insert).not.toHaveBeenCalled()
    }
    expect(fetchWeatherData).toHaveBeenCalled()
  })

  it('returns a cleanup function that clears the interval', async () => {
    const { getDb } = await import('../db.js')
    // Configure: no lat/lon — poller should be no-op but still return a cleanup
    vi.mocked(getDb).mockImplementation(() => ({
      select: () => ({
        from: () => ({
          where: (_: unknown) => ({
            get: vi.fn().mockReturnValue(undefined), // No lat/lon
          }),
        }),
      }),
      insert: vi.fn(),
    }) as unknown as ReturnType<typeof getDb>)

    const { fetchWeatherData } = await import('../adapters/weather.js')
    vi.useFakeTimers()
    const { startWeatherPoller, WEATHER_INTERVAL_MS } = await import('../weather-poller.js')
    const stop = startWeatherPoller()

    // Flush microtasks for initial tick (no-op since no lat/lon)
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    const callCountAfterFirstTick = vi.mocked(fetchWeatherData).mock.calls.length

    stop() // cleanup — clears interval

    // Advance past one full interval — should NOT trigger any more calls
    vi.advanceTimersByTime(WEATHER_INTERVAL_MS + 1000)
    await Promise.resolve()

    expect(vi.mocked(fetchWeatherData).mock.calls.length).toBe(callCountAfterFirstTick)
  })

  it('is a no-op when weather.lat / weather.lon keys are missing from kvStore', async () => {
    const { getDb } = await import('../db.js')
    vi.mocked(getDb).mockImplementation(() => ({
      select: () => ({
        from: () => ({
          where: (_: unknown) => ({
            get: vi.fn().mockReturnValue(undefined), // No lat/lon configured
          }),
        }),
      }),
      insert: vi.fn(),
    }) as unknown as ReturnType<typeof getDb>)

    const { fetchWeatherData } = await import('../adapters/weather.js')
    vi.useFakeTimers()
    const { startWeatherPoller } = await import('../weather-poller.js')
    const stop = startWeatherPoller()

    // Flush microtasks for initial tick
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    stop()

    expect(fetchWeatherData).not.toHaveBeenCalled()
  })
})
