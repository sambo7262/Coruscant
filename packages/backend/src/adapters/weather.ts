import axios from 'axios'
import type { ForecastDay } from '@coruscant/shared'

export interface WeatherFetchResult {
  temp_f: number
  wmo_code: number
  fetched_at: string
  forecast: ForecastDay[]  // always present — empty array when daily block absent
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  name: string
  timezone: string
}

/**
 * Fetch current weather data from Open-Meteo for the given lat/lon.
 * Returns temperature in Fahrenheit and WMO weather code.
 * Throws on network errors or malformed response.
 */
export async function fetchWeatherData(lat: string, lon: string, timezone?: string): Promise<WeatherFetchResult> {
  const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code',
      temperature_unit: 'fahrenheit',
      forecast_days: 5,
      timezone: timezone ?? 'auto',
    },
    timeout: 10_000,
  })
  const current = res.data?.current
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Invalid weather response from Open-Meteo')
  }
  const daily = res.data?.daily
  const forecast: ForecastDay[] = Array.isArray(daily?.time)
    ? (daily.time as string[]).slice(0, Math.min(
        daily.time.length,
        daily.temperature_2m_max?.length ?? 0,
        daily.temperature_2m_min?.length ?? 0,
        daily.weather_code?.length ?? 0,
      )).map((date: string, i: number) => ({
        date,
        temp_max_f: daily.temperature_2m_max[i] as number,
        temp_min_f: daily.temperature_2m_min[i] as number,
        wmo_code: daily.weather_code[i] as number,
      }))
    : []
  return {
    temp_f: current.temperature_2m,
    wmo_code: current.weather_code,
    fetched_at: new Date().toISOString(),
    forecast,
  }
}

/**
 * Geocode a zip code (or city name) to latitude/longitude using Open-Meteo geocoding API.
 * For numeric-only inputs (US zip codes), appends country_code=US to narrow results.
 * Throws Error("No location found for zip") when the API returns no results.
 */
export async function geocodeZip(zip: string): Promise<GeocodeResult> {
  const isNumericOnly = /^\d+$/.test(zip)
  const params: Record<string, string | number> = {
    name: zip,
    count: 1,
    language: 'en',
    format: 'json',
  }
  if (isNumericOnly) params.country_code = 'US'

  const res = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params,
    timeout: 10_000,
  })
  if (!res.data?.results?.length) {
    throw new Error('No location found for zip')
  }
  const match = res.data.results[0]
  return {
    latitude: match.latitude,
    longitude: match.longitude,
    name: match.name,
    timezone: match.timezone ?? 'America/New_York',
  }
}
