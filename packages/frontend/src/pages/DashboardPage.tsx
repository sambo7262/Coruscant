import type { DashboardSnapshot, ArrWebhookEvent } from '@coruscant/shared'
import { CardGrid } from '../components/cards/CardGrid.js'

interface DashboardPageProps {
  snapshot: DashboardSnapshot | null
  lastArrEvent?: ArrWebhookEvent | null
}

export function DashboardPage({ snapshot, lastArrEvent }: DashboardPageProps) {
  // D-01: no-scroll layout at 800x480 — scroll restoration removed (overflow: hidden enforced by App.tsx main)
  return <CardGrid snapshot={snapshot} lastArrEvent={lastArrEvent} />
}
