import type { DashboardSnapshot } from '@coruscant/shared'
import { CardGrid } from '../components/cards/CardGrid.js'

interface DashboardPageProps {
  snapshot: DashboardSnapshot | null
}

export function DashboardPage({ snapshot }: DashboardPageProps) {
  // D-01: no-scroll layout at 800x480 — scroll restoration removed (overflow: hidden enforced by App.tsx main)
  return <CardGrid snapshot={snapshot} />
}
