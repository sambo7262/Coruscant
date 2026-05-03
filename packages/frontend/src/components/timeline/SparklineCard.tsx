import {
  AreaChart,
  Area,
  LineChart,
  Line,
  YAxis,
  ResponsiveContainer,
} from 'recharts'

export interface MetricConfig {
  key: string
  label: string
  color: string
  fillOpacity?: number
  domain?: [number, number] | ['auto', 'auto']
  chartType: 'area' | 'line'
  unit?: string
}

interface SparklineCardProps {
  service: string
  points: Array<Record<string, number | string>>
  metrics: MetricConfig[]
  loading?: boolean
}

function formatValue(val: number | string | undefined, unit?: string): string {
  if (val === undefined || val === null) return '--'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return '--'
  const formatted = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)
  return unit ? `${formatted}${unit}` : formatted
}

function SparklineRow({
  config,
  points,
  loading,
}: {
  config: MetricConfig
  points: Array<Record<string, number | string>>
  loading?: boolean
}) {
  const hasData = points.length > 0 && points.some(p => p[config.key] !== undefined)
  const latestPoint = points.length > 0 ? points[points.length - 1] : null
  const latestValue = latestPoint ? latestPoint[config.key] : undefined

  return (
    <div className="sparkline-row">
      <span className="sparkline-row__label">{config.label}</span>
      <div className="sparkline-row__chart">
        {loading ? (
          <div className="sparkline-loading" />
        ) : !hasData ? (
          <div className="sparkline-empty">NO HISTORY</div>
        ) : config.chartType === 'area' ? (
          <ResponsiveContainer width="100%" height={32}>
            <AreaChart data={points} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <YAxis domain={config.domain ?? ['auto', 'auto']} hide />
              <Area
                type="monotone"
                dataKey={config.key}
                stroke={config.color}
                strokeWidth={1.5}
                fill={config.color}
                fillOpacity={config.fillOpacity ?? 0.3}
                dot={false}
                isAnimationActive={true}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={32}>
            <LineChart data={points} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <YAxis domain={config.domain ?? ['auto', 'auto']} hide />
              <Line
                type="monotone"
                dataKey={config.key}
                stroke={config.color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={true}
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <span className="sparkline-row__value">
        {loading ? '...' : formatValue(latestValue as number | string | undefined, config.unit)}
      </span>
    </div>
  )
}

export function SparklineCard({ service, points, metrics, loading }: SparklineCardProps) {
  if (metrics.length === 0) return null

  return (
    <div className="sparkline-card">
      <div className="sparkline-card__ribbon">
        <span className="sparkline-card__ribbon-label">{service.toUpperCase()}</span>
      </div>
      <div className="sparkline-card__body">
        {metrics.map((metric) => (
          <SparklineRow
            key={metric.key}
            config={metric}
            points={points}
            loading={loading}
          />
        ))}
      </div>
    </div>
  )
}
