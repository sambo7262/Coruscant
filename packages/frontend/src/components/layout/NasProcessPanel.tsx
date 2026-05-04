import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { NasProcess } from '@coruscant/shared'

interface NasProcessPanelProps {
  cpu: number  // overall NAS CPU % for header display (per D-07)
}

function getProcBarColor(pct: number): string {
  if (pct > 85) return 'var(--cockpit-red)'     // #FF3B3B -- per D-11
  if (pct > 60) return '#FF9500'                 // warm orange -- per D-11
  return 'var(--cockpit-amber)'                  // #E8A020 -- per D-11
}

export function NasProcessPanel({ cpu, onDismiss }: NasProcessPanelProps & { onDismiss?: () => void }) {
  const [processes, setProcesses] = useState<NasProcess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch(`/api/nas/processes?cpu=${Math.round(cpu)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!cancelled) {
          setProcesses((data as { processes: NasProcess[] }).processes ?? [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])  // empty deps -- runs once on mount; panel unmounts between opens per D-02

  return (
    <motion.div
      className="nas-process-panel"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      onClick={() => onDismiss?.()}
    >
      <div className="nas-process-panel__inner">
        <div className="nas-process-panel__header">
          NAS LOAD &mdash; CPU {Math.round(cpu)}%
        </div>
        {loading && (
          <div className="nas-process-panel__skeleton" />
        )}
        {!loading && error && (
          <div className="nas-process-panel__error">DSM UNREACHABLE &mdash; CHECK NAS CONNECTION</div>
        )}
        {!loading && !error && processes.length === 0 && (
          <div className="nas-process-panel__empty">NO PROCESS DATA</div>
        )}
        {!loading && !error && (() => {
          const maxPct = Math.max(cpu, ...processes.map(p => p.cpuPercent), 1)
          return processes.map((proc) => (
            <div key={proc.pid} className="nas-process-panel__row">
              <span className="nas-process-panel__label">{proc.label}</span>
              <div className="nas-process-panel__bar-wrap">
                <div className="nas-process-panel__track">
                  <div
                    className="nas-process-panel__fill"
                    style={{
                      width: `${(proc.cpuPercent / maxPct) * 100}%`,
                      background: getProcBarColor(proc.cpuPercent),
                    }}
                  />
                </div>
              </div>
              <span className="nas-process-panel__pct">{proc.cpuPercent.toFixed(1)}%</span>
            </div>
          ))
        })()}
      </div>
    </motion.div>
  )
}
