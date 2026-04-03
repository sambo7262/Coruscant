import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StatusDot } from '../components/ui/StatusDot.js'
import type { DashboardSnapshot, ServiceStatus } from '@coruscant/shared'

const SERVICES = [
  { id: 'radarr', label: 'RADARR' },
  { id: 'sonarr', label: 'SONARR' },
  { id: 'lidarr', label: 'LIDARR' },
  { id: 'bazarr', label: 'BAZARR' },
  { id: 'prowlarr', label: 'PROWLARR' },
  { id: 'readarr', label: 'READARR [RETIRED]' },
  { id: 'sabnzbd', label: 'SABNZBD' },
] as const

type ServiceId = (typeof SERVICES)[number]['id']

interface TestResult {
  success: boolean
  message: string
}

interface SettingsPageProps {
  snapshot: DashboardSnapshot | null
}

function getServiceStatus(
  snapshot: DashboardSnapshot | null,
  serviceId: string,
): ServiceStatus['status'] {
  if (!snapshot) return 'stale'
  const svc = snapshot.services.find((s) => s.id === serviceId)
  if (!svc || svc.configured === false) return 'stale'
  return svc.status
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-rest)',
  color: 'var(--text-offwhite)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '14px',
  padding: '8px 12px',
  borderRadius: '4px',
  outline: 'none',
}

const btnBaseStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  padding: '8px 20px',
  borderRadius: '4px',
  cursor: 'pointer',
  border: '1px solid var(--cockpit-amber)',
  textTransform: 'uppercase' as const,
}

const testBtnStyle: React.CSSProperties = {
  ...btnBaseStyle,
  background: 'rgba(232,160,32,0.15)',
  color: 'var(--cockpit-amber)',
}

const saveBtnStyle: React.CSSProperties = {
  ...btnBaseStyle,
  background: 'var(--cockpit-amber)',
  color: '#0D0D0D',
}

const disabledBtnStyle: React.CSSProperties = {
  ...testBtnStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
}

export function SettingsPage({ snapshot }: SettingsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawService = searchParams.get('service') ?? 'radarr'
  const activeTab: ServiceId = SERVICES.some((s) => s.id === rawService)
    ? (rawService as ServiceId)
    : 'radarr'

  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const loadTabConfig = useCallback(async (serviceId: string) => {
    try {
      const res = await fetch(`/api/settings/${serviceId}`)
      if (res.ok) {
        const data = await res.json() as { baseUrl: string; hasApiKey: boolean; enabled: boolean }
        setUrl(data.baseUrl ?? '')
        setApiKey('')
        setHasExistingKey(data.hasApiKey ?? false)
      } else {
        setUrl('')
        setApiKey('')
        setHasExistingKey(false)
      }
    } catch {
      setUrl('')
      setApiKey('')
      setHasExistingKey(false)
    }
    setTestResult(null)
    setShowKey(false)
    setSaved(false)
  }, [])

  useEffect(() => {
    void loadTabConfig(activeTab)
  }, [activeTab, loadTabConfig])

  const handleTabClick = (serviceId: ServiceId) => {
    setSearchParams({ service: serviceId })
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    setTestResult(null)
  }

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
    setTestResult(null)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/test-connection/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: url, apiKey }),
      })
      const data = await res.json() as TestResult
      setTestResult(data)
    } catch {
      setTestResult({ success: false, message: 'Network error' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/settings/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: url, apiKey }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      if (apiKey) {
        setHasExistingKey(true)
        setApiKey('')
      }
    } catch {
      // save failed silently — no network error display for save
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '0 16px', maxWidth: '640px', margin: '0 auto' }}>
      <h1
        className="text-heading"
        style={{ marginBottom: '20px', color: 'var(--cockpit-amber)' }}
      >
        Settings
      </h1>

      {/* Tab bar */}
      <div
        style={{
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch',
          marginBottom: '24px',
          borderBottom: '1px solid var(--border-rest)',
        }}
        role="tablist"
        aria-label="Service configuration tabs"
      >
        {SERVICES.map((svc) => {
          const isActive = svc.id === activeTab
          const status = getServiceStatus(snapshot, svc.id)
          return (
            <button
              key={svc.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(svc.id as ServiceId)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-rest)',
                borderBottom: isActive
                  ? '2px solid var(--cockpit-amber)'
                  : '1px solid var(--border-rest)',
                color: isActive ? 'var(--cockpit-amber)' : 'var(--text-offwhite)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '0.06em',
                padding: '8px 16px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginRight: '4px',
                borderRadius: '4px 4px 0 0',
                transition: 'color 0.15s, border-bottom-color 0.15s',
              }}
            >
              <StatusDot status={status} />
              {svc.label}
            </button>
          )
        })}
      </div>

      {/* Service config panel */}
      <div
        role="tabpanel"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-rest)',
          borderRadius: '4px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div>
          <label
            className="text-label"
            style={{
              display: 'block',
              color: 'var(--text-offwhite)',
              marginBottom: '6px',
              fontSize: '12px',
              letterSpacing: '0.06em',
            }}
          >
            URL
          </label>
          <input
            type="text"
            value={url}
            onChange={handleUrlChange}
            placeholder="http://192.168.1.x:7878"
            style={inputStyle}
            autoComplete="off"
          />
        </div>

        <div>
          <label
            className="text-label"
            style={{
              display: 'block',
              color: 'var(--text-offwhite)',
              marginBottom: '6px',
              fontSize: '12px',
              letterSpacing: '0.06em',
            }}
          >
            API KEY
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder={hasExistingKey ? '(key saved — enter new key to change)' : 'API Key'}
              style={{ ...inputStyle, paddingRight: '42px' }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-offwhite)',
                fontSize: '16px',
                lineHeight: 1,
                padding: '2px 4px',
              }}
            >
              {showKey ? '\u{1F441}\u{FE0F}' : '\u{1F441}'}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || !url}
            style={testing || !url ? disabledBtnStyle : testBtnStyle}
          >
            {testing ? 'TESTING...' : 'TEST'}
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={saving ? { ...saveBtnStyle, opacity: 0.6, cursor: 'not-allowed' } : saveBtnStyle}
          >
            {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>

        {/* Inline test result */}
        {testResult !== null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: testResult.success
                  ? 'var(--cockpit-green)'
                  : 'var(--cockpit-red)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: testResult.success ? 'var(--cockpit-green)' : 'var(--cockpit-red)',
              }}
            >
              {testResult.success ? `CONNECTED  ${testResult.message}` : `FAILED: ${testResult.message}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
