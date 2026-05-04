import { motion } from 'framer-motion'
import type { ForecastDay } from '@coruscant/shared'
import { WeatherIcon } from '../weather/WeatherIcon.js'

interface WeatherForecastPanelProps {
  forecast: ForecastDay[]
  fetchedAt?: string
  isStale: boolean
}

function getDayLabel(dateStr: string, isToday: boolean): string {
  if (isToday) return 'TODAY'
  const d = new Date(dateStr + 'T12:00:00')  // noon prevents DST off-by-one
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

function getConditionLabel(wmoCode: number): string {
  if (wmoCode === 0) return 'Clear'
  if (wmoCode === 1) return 'Mostly Clear'
  if (wmoCode === 2) return 'Partly Cloudy'
  if (wmoCode === 3) return 'Overcast'
  if (wmoCode === 45 || wmoCode === 48) return 'Foggy'
  if (wmoCode === 51 || wmoCode === 53 || wmoCode === 55) return 'Drizzle'
  if (wmoCode === 56 || wmoCode === 57) return 'Freezing Drizzle'
  if (wmoCode === 61 || wmoCode === 63 || wmoCode === 65) return 'Rain'
  if (wmoCode === 66 || wmoCode === 67) return 'Freezing Rain'
  if (wmoCode === 71 || wmoCode === 73 || wmoCode === 75) return 'Snow'
  if (wmoCode === 77) return 'Snow Grains'
  if (wmoCode === 80 || wmoCode === 81 || wmoCode === 82) return 'Showers'
  if (wmoCode === 85 || wmoCode === 86) return 'Snow Showers'
  if (wmoCode === 95) return 'Thunderstorm'
  if (wmoCode === 96 || wmoCode === 99) return 'Severe Storm'
  return 'Cloudy'
}

function DayColumn({ day, isToday }: { day: ForecastDay; isToday: boolean }) {
  return (
    <div className="weather-forecast-panel__day">
      <span className="weather-forecast-panel__day-name">{getDayLabel(day.date, isToday)}</span>
      <WeatherIcon wmoCode={day.wmo_code} size={24} />
      <span className="weather-forecast-panel__high">{Math.round(day.temp_max_f)}°</span>
      <span className="weather-forecast-panel__low">{Math.round(day.temp_min_f)}°</span>
      <span className="weather-forecast-panel__condition">{getConditionLabel(day.wmo_code)}</span>
    </div>
  )
}

export function WeatherForecastPanel({ forecast, fetchedAt, isStale }: WeatherForecastPanelProps) {
  const staleMinutes = fetchedAt
    ? Math.max(0, Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60_000))
    : null

  return (
    <motion.div
      className="weather-forecast-panel"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <div className="weather-forecast-panel__inner">
        <div className="weather-forecast-panel__header">
          5-DAY FORECAST
          {isStale && staleMinutes !== null && staleMinutes > 0 && (
            <span className="weather-forecast-panel__stale-label">
              {' '}&mdash; LAST UPDATED {staleMinutes}m AGO
            </span>
          )}
        </div>
        {forecast.length === 0 ? (
          <div className="weather-forecast-panel__empty">FORECAST UNAVAILABLE</div>
        ) : (
          <div className="weather-forecast-panel__days">
            {forecast.map((day, i) => (
              <DayColumn key={day.date} day={day} isToday={i === 0} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
