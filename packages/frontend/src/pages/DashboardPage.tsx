import { useEffect } from 'react'
import type { DashboardSnapshot } from '@coruscant/shared'
import { CardGrid } from '../components/cards/CardGrid.js'

interface DashboardPageProps {
  snapshot: DashboardSnapshot | null
}

export function DashboardPage({ snapshot }: DashboardPageProps) {
  // Restore scroll position when returning from detail view (D-20, UI-SPEC Scroll behavior)
  useEffect(() => {
    const savedY = sessionStorage.getItem('dashboardScrollY')
    if (savedY) {
      window.scrollTo(0, parseInt(savedY, 10))
      sessionStorage.removeItem('dashboardScrollY')
    }
  }, [])

  return <CardGrid snapshot={snapshot} />
}
