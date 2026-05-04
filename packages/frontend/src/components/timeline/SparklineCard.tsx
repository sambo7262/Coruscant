import { useState } from 'react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { TimeWindow } from './TimeWindowSelector.js'

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
  window?: TimeWindow
  multiLine?: boolean
}

function formatValue(val: number | string | undefined, unit?: string): string {
  if (val === undefined || val === null) return '--'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return '--'
  const formatted = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)
  return unit ? `${formatted}${unit}` : formatted
}

function formatTimeTick(iso: string, window?: TimeWindow): string {
  try {
    const d = new Date(iso)
    if (window === '7d' || window === '3d') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    const now = Date.now()
    const hoursAgo = Math.round((now - d.getTime()) / (60 * 60 * 1000))
    if (hoursAgo === 0) return 'now'
    return `-${hoursAgo}h`
  } catch {
    return ''
  }
}

function formatYTick(val: number, unit?: string): string {
  if (!unit) return String(val)
  return `${val}${unit.trim()}`
}

export function SparklineCard({ service, points, metrics, loading, window, multiLine }: SparklineCardProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  if (metrics.length === 0) return null

  const activeMetric = metrics[activeIdx]
  const hasData = points.length > 0 && points.some(p => p[activeMetric.key] !== undefined)
  const latestPoint = points.length > 0 ? points[points.length - 1] : null
  const latestValue = latestPoint ? latestPoint[activeMetric.key] : undefined

  const yUnit = multiLine ? metrics[0]?.unit : activeMetric.unit

  return (
    <div className="sparkline-card">
      <div className="sparkline-card__ribbon">
        <span className="sparkline-card__ribbon-label">{service.toUpperCase()}</span>
        {!multiLine && (
          <span className="sparkline-card__current-value">
            {loading ? '...' : formatValue(latestValue as number | string | undefined, activeMetric.unit)}
          </span>
        )}
      </div>

      {/* Metric toggle pills — only for non-multiLine cards with multiple metrics */}
      {!multiLine && metrics.length > 1 && (
        <div className="sparkline-card__toggles">
          {metrics.map((m, idx) => (
            <button
              key={m.key}
              className={`sparkline-card__toggle${idx === activeIdx ? ' sparkline-card__toggle--active' : ''}`}
              onClick={() => setActiveIdx(idx)}
              aria-pressed={idx === activeIdx}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="sparkline-card__chart">
        {loading ? (
          <div className="sparkline-loading" />
        ) : multiLine && points.length === 0 ? (
          <div className="sparkline-empty">NO HISTORY</div>
        ) : !hasData && !multiLine ? (
          <div className="sparkline-empty">NO HISTORY</div>
        ) : multiLine ? (
          /* Multi-line: all metrics as separate colored lines on one chart */
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,160,32,0.08)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v: string) => formatTimeTick(v, window)}
                tick={{ fontSize: 10, fill: 'rgba(200,200,200,0.5)' }}
                axisLine={{ stroke: 'rgba(232,160,32,0.15)' }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis
                domain={metrics[0]?.domain ?? ['auto', 'auto']}
                tickFormatter={(v: number) => formatYTick(v, yUnit)}
                tick={{ fontSize: 10, fill: 'rgba(200,200,200,0.5)' }}
                axisLine={{ stroke: 'rgba(232,160,32,0.15)' }}
                tickLine={false}
                width={54}
              />
              <Legend
                verticalAlign="top"
                height={20}
                iconType="line"
                iconSize={10}
                wrapperStyle={{ fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
              />
              {metrics.map(m => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={300}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : activeMetric.chartType === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,160,32,0.08)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v: string) => formatTimeTick(v, window)}
                tick={{ fontSize: 10, fill: 'rgba(200,200,200,0.5)' }}
                axisLine={{ stroke: 'rgba(232,160,32,0.15)' }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis
                domain={activeMetric.domain ?? ['auto', 'auto']}
                tickFormatter={(v: number) => formatYTick(v, activeMetric.unit)}
                tick={{ fontSize: 10, fill: 'rgba(200,200,200,0.5)' }}
                axisLine={{ stroke: 'rgba(232,160,32,0.15)' }}
                tickLine={false}
                width={54}
              />
              <Area
                type="monotone"
                dataKey={activeMetric.key}
                stroke={activeMetric.color}
                strokeWidth={1.5}
                fill={activeMetric.color}
                fillOpacity={activeMetric.fillOpacity ?? 0.25}
                dot={false}
                isAnimationActive={true}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,160,32,0.08)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v: string) => formatTimeTick(v, window)}
                tick={{ fontSize: 10, fill: 'rgba(200,200,200,0.5)' }}
                axisLine={{ stroke: 'rgba(232,160,32,0.15)' }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis
                domain={activeMetric.domain ?? ['auto', 'auto']}
                tickFormatter={(v: number) => formatYTick(v, activeMetric.unit)}
                tick={{ fontSize: 10, fill: 'rgba(200,200,200,0.5)' }}
                axisLine={{ stroke: 'rgba(232,160,32,0.15)' }}
                tickLine={false}
                width={54}
              />
              <Line
                type="monotone"
                dataKey={activeMetric.key}
                stroke={activeMetric.color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={true}
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
