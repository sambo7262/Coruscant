import { EventEmitter } from 'node:events'

export interface LogEntry {
  id?: number
  timestamp: string
  level: string
  service: string
  message: string
  payload?: string | null
}

export const logEvents = new EventEmitter()
logEvents.setMaxListeners(50)
