import axios from 'axios'

export interface WeatherFetchResult {
  temp_f: number
  wmo_code: number
  fetched_at: string
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
export async function fetchWeatherData(lat: string, lon: string): Promise<WeatherFetchResult> {
  const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,weather_code',
      temperature_unit: 'fahrenheit',
    },
    timeout: 10_000,
  })
  const current = res.data?.current
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Invalid weather response from Open-Meteo')
  }
  return {
    temp_f: current.temperature_2m,
    wmo_code: current.weather_code,
    fetched_at: new Date().toISOString(),
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
