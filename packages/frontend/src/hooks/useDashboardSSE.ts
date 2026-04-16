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
  const [activeOutages, setActiveOutages] = useState<Map<string, { message?: string; since: string }>>(new Map())
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
        const event = JSON.parse(e.data) as ArrWebhookEvent
        setLastArrEvent(event)

        if (event.eventCategory === 'health_issue') {
          setActiveOutages(prev => {
            const next = new Map(prev)
            next.set(event.service, { message: event.title, since: new Date().toISOString() })
            return next
          })
        } else if (event.eventCategory === 'health_restored') {
          setActiveOutages(prev => {
            const next = new Map(prev)
            next.delete(event.service)
            return next
          })
        }
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

  return { snapshot, connected, lastArrEvent, activeOutages, lastLogEntry }
}
