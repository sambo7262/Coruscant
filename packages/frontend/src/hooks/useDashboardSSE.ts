import { useState, useEffect } from 'react'
import type { DashboardSnapshot } from '@coruscant/shared'

export function useDashboardSSE() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      es = new EventSource('/api/sse')

      es.addEventListener('dashboard-update', (e: MessageEvent) => {
        setSnapshot(JSON.parse(e.data) as DashboardSnapshot)
        setConnected(true)
      })

      es.onerror = () => {
        setConnected(false)
        es?.close()
        // Auto-reconnect after 5 seconds (UI-SPEC Interaction Contract)
        reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      es?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])

  return { snapshot, connected }
}
