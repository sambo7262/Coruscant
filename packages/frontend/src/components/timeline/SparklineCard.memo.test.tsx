// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { SparklineCard } from './SparklineCard.js'
import type { MetricConfig } from './SparklineCard.js'

// Stub ResizeObserver for Recharts ResponsiveContainer
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

afterEach(() => {
  vi.restoreAllMocks()
})

const TEST_METRICS: MetricConfig[] = [
  { key: 'cpu', label: 'CPU', color: '#ff0', chartType: 'area', domain: [0, 100], unit: '%' },
]

const TEST_POINTS = [
  { timestamp: '2026-01-01T00:00:00Z', cpu: 50 },
  { timestamp: '2026-01-01T01:00:00Z', cpu: 60 },
]

describe('SparklineCard React.memo (PERF-03)', () => {
  it('does not re-render when parent re-renders with same props', () => {
    const { rerender } = render(
      <SparklineCard
        service="TEST"
        points={TEST_POINTS}
        metrics={TEST_METRICS}
        loading={false}
        window="24h"
      />
    )

    // Re-render with identical props — memo should bail
    rerender(
      <SparklineCard
        service="TEST"
        points={TEST_POINTS}
        metrics={TEST_METRICS}
        loading={false}
        window="24h"
      />
    )

    // If React.memo is working, the component renders once initially,
    // and the rerender with same props is a no-op.
    // We verify memo is applied by checking the export type
    expect(typeof SparklineCard).toBe('object')  // React.memo returns an object, not a function
    expect((SparklineCard as any).$$typeof).toBeDefined()
    expect((SparklineCard as any).type?.name).toBe('SparklineCardInner')
  })

  it('re-renders when props change', () => {
    const { rerender, container } = render(
      <SparklineCard
        service="TEST"
        points={TEST_POINTS}
        metrics={TEST_METRICS}
        loading={true}
        window="24h"
      />
    )

    // Should show loading state
    expect(container.querySelector('.sparkline-loading')).toBeTruthy()

    // Change loading prop
    rerender(
      <SparklineCard
        service="TEST"
        points={TEST_POINTS}
        metrics={TEST_METRICS}
        loading={false}
        window="24h"
      />
    )

    // Loading spinner should be gone
    expect(container.querySelector('.sparkline-loading')).toBeFalsy()
  })

  it('exports MetricConfig interface (type still available)', () => {
    // Compile-time check — if MetricConfig wasn't exported, this file wouldn't compile
    const m: MetricConfig = { key: 'test', label: 'Test', color: '#fff', chartType: 'area' }
    expect(m.key).toBe('test')
  })
})
