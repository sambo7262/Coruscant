import { useState, useEffect } from 'react'
import type { DashboardSnapshot, ArrWebhookEvent } from '@coruscant/shared'

export interface LogEntry {
  id?: number
  timestamp: string
  level: string
  service: string
  message: string
  payload?: string | null
}

export function useDashboardSSE() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastArrEvent, setLastArrEvent] = useState<ArrWebhookEvent | null>(null)
  const [lastLogEntry, setLastLogEntry] = useState<LogEntry | null>(null)

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      es = new EventSource('/api/sse')

      es.addEventListener('dashboard-update', (e: MessageEvent) => {
        setSnapshot(JSON.parse(e.data) as DashboardSnapshot)
        setConnected(true)
      })

      es.addEventListener('arr-event', (e: MessageEvent) => {
        setLastArrEvent(JSON.parse(e.data) as ArrWebhookEvent)
      })

      es.addEventListener('log-entry', (e: MessageEvent) => {
        setLastLogEntry(JSON.parse(e.data) as LogEntry)
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

  return { snapshot, connected, lastArrEvent, lastLogEntry }
}
