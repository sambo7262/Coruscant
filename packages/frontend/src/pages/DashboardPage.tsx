import type { DashboardSnapshot, ArrWebhookEvent } from '@coruscant/shared'
import { CardGrid } from '../components/cards/CardGrid.js'

interface DashboardPageProps {
  snapshot: DashboardSnapshot | null
  lastArrEvent?: ArrWebhookEvent | null
  activeOutages?: Map<string, { message?: string; since: string }>
}

export function DashboardPage({ snapshot, lastArrEvent, activeOutages }: DashboardPageProps) {
  // D-01: no-scroll layout at 800x480 — scroll restoration removed (overflow: hidden enforced by App.tsx main)
  return <CardGrid snapshot={snapshot} lastArrEvent={lastArrEvent} activeOutages={activeOutages} nasStatus={snapshot?.nas ?? null} />
}
