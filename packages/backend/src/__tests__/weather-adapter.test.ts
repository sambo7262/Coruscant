import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')

const mockAxios = vi.mocked(axios)

describe('weather adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('fetchWeatherData', () => {
    it('returns temp_f, wmo_code, and fetched_at when Open-Meteo returns valid data', async () => {
      mockAxios.get = vi.fn().mockResolvedValueOnce({
        status: 200,
        data: {
          current: {
            temperature_2m: 72.5,
            weather_code: 3,
          },
        },
      })

      const { fetchWeatherData } = await import('../adapters/weather.js')
      const result = await fetchWeatherData('37.7749', '-122.4194')

      expect(result.temp_f).toBe(72.5)
      expect(result.wmo_code).toBe(3)
      expect(result.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('throws on axios timeout / network error', async () => {
      mockAxios.get = vi.fn().mockRejectedValueOnce(new Error('ECONNABORTED timeout'))

      const { fetchWeatherData } = await import('../adapters/weather.js')
      await expect(fetchWeatherData('37.7749', '-122.4194')).rejects.toThrow('ECONNABORTED timeout')
    })

    it('throws when Open-Meteo returns response without temperature_2m', async () => {
      mockAxios.get = vi.fn().mockResolvedValueOnce({
        status: 200,
        data: {
          current: {
            weather_code: 1,
            // no temperature_2m
          },
        },
      })

      const { fetchWeatherData } = await import('../adapters/weather.js')
      await expect(fetchWeatherData('37.7749', '-122.4194')).rejects.toThrow('Invalid weather response from Open-Meteo')
    })

    it('returns forecast array with 5 days when API returns daily block', async () => {
      mockAxios.get = vi.fn().mockResolvedValueOnce({
        status: 200,
        data: {
          current: { temperature_2m: 72.5, weather_code: 3 },
          daily: {
            time: ['2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'],
            temperature_2m_max: [72.5, 68.0, 75.1, 80.2, 65.4],
            temperature_2m_min: [55.0, 52.1, 58.9, 60.4, 48.3],
            weather_code: [3, 1, 0, 80, 61],
          },
        },
      })
      const { fetchWeatherData } = await import('../adapters/weather.js')
      const result = await fetchWeatherData('37.7749', '-122.4194', 'America/New_York')

      expect(result.forecast).toHaveLength(5)
      expect(result.forecast[0]).toEqual({
        date: '2026-05-03',
        temp_max_f: 72.5,
        temp_min_f: 55.0,
        wmo_code: 3,
      })
    })

    it('returns empty forecast array when API response has no daily field', async () => {
      mockAxios.get = vi.fn().mockResolvedValueOnce({
        status: 200,
        data: {
          current: { temperature_2m: 72.5, weather_code: 3 },
        },
      })
      const { fetchWeatherData } = await import('../adapters/weather.js')
      const result = await fetchWeatherData('37.7749', '-122.4194')

      expect(result.forecast).toEqual([])
    })

    it('passes timezone parameter to Open-Meteo API', async () => {
      mockAxios.get = vi.fn().mockResolvedValueOnce({
        status: 200,
        data: {
          current: { temperature_2m: 72.5, weather_code: 3 },
          daily: {
            time: ['2026-05-03'],
            temperature_2m_max: [72.5],
            temperature_2m_min: [55.0],
            weather_code: [3],
          },
        },
      })
      const { fetchWeatherData } = await import('../adapters/weather.js')
      await fetchWeatherData('37.7749', '-122.4194', 'America/Chicago')

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.open-meteo.com/v1/forecast',
        expect.objectContaining({
          params: expect.objectContaining({
            timezone: 'America/Chicago',
            daily: 'temperature_2m_max,temperature_2m_min,weather_code',
            forecast_days: 5,
          }),
        }),
      )
    })
  })

  describe('geocodeZip', () => {
    it('returns latitude, longitude, and name from geocoding API for a valid zip', async () => {
      mockAxios.get = vi.fn().mockResolvedValueOnce({
        status: 200,
        data: {
          results: [
            { latitude: 37.7749, longitude: -122.4194, name: 'San Francisco' },
          ],
        },
      })

      const { geocodeZip } = await import('../adapters/weather.js')
      const result = await geocodeZip('94102')

      expect(result.latitude).toBe(37.7749)
      expect(result.longitude).toBe(-122.4194)
      expect(result.name).toBe('San Francisco')
    })

    it('throws Error("No location found for zip") when geocoding API returns no results', async () => {
      mockAxios.get = vi.fn().mockResolvedValueOnce({
        status: 200,
        data: {
          // no results key — simulates empty object response for invalid zip
        },
      })

      const { geocodeZip } = await import('../adapters/weather.js')
      await expect(geocodeZip('00000')).rejects.toThrow('No location found for zip')
    })

    it('appends country_code=US to request params for numeric-only zip', async () => {
      mockAxios.get = vi.fn().mockResolvedValueOnce({
        status: 200,
        data: {
          results: [
            { latitude: 34.0522, longitude: -118.2437, name: 'Los Angeles' },
          ],
        },
      })

      const { geocodeZip } = await import('../adapters/weather.js')
      await geocodeZip('90001')

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://geocoding-api.open-meteo.com/v1/search',
        expect.objectContaining({
          params: expect.objectContaining({
            country_code: 'US',
          }),
        }),
      )
    })
  })
})
