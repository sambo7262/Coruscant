import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StatusDot } from '../components/ui/StatusDot.js'
import type { DashboardSnapshot, ServiceStatus } from '@coruscant/shared'

// LOGS tab component — Log retention configuration (D-27)
function LogsTab() {
  const [retentionDays, setRetentionDays] = useState<number>(7)
  const [inputValue, setInputValue] = useState<string>('7')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/settings/logs-retention')
        if (res.ok) {
          const data = await res.json() as { retentionDays: number }
          setRetentionDays(data.retentionDays)
          setInputValue(String(data.retentionDays))
        }
      } catch {
        // use default
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const parsedValue = parseInt(inputValue, 10)
  const isValid = !isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 365

  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(false)
    try {
      const res = await fetch('/api/settings/logs-retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionDays: parsedValue }),
      })
      if (res.ok) {
        setRetentionDays(parsedValue)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      } else {
        setSaveError(true)
        setTimeout(() => setSaveError(false), 3000)
      }
    } catch {
      setSaveError(true)
      setTimeout(() => setSaveError(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const inputBorderColor = !isValid && inputValue !== ''
    ? 'var(--cockpit-red)'
    : 'var(--border-rest)'

  return (
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
            color: 'var(--cockpit-amber)',
            marginBottom: '8px',
            fontSize: '12px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          LOG RETENTION
        </label>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-offwhite)',
          marginBottom: '12px',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.5,
        }}>
          Log entries older than this many days will be deleted during the nightly purge.
        </p>
        {loading ? (
          <p style={{ fontSize: '13px', color: 'var(--text-offwhite)', fontFamily: "'JetBrains Mono', monospace" }}>
            Loading...
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="number"
              min={1}
              max={365}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{
                width: '100px',
                background: 'var(--bg-surface)',
                border: `1px solid ${inputBorderColor}`,
                color: 'var(--text-offwhite)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '14px',
                padding: '8px 12px',
                borderRadius: '4px',
                outline: 'none',
                minHeight: '44px',
              }}
              aria-label="Log retention days"
            />
            <span style={{
              fontSize: '13px',
              color: 'var(--text-offwhite)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              days (1–365)
            </span>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !isValid}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                padding: '8px 20px',
                borderRadius: '4px',
                cursor: saving || !isValid ? 'not-allowed' : 'pointer',
                border: '1px solid var(--cockpit-amber)',
                textTransform: 'uppercase',
                background: 'rgba(232,160,32,0.15)',
                color: 'var(--cockpit-amber)',
                opacity: saving || !isValid ? 0.6 : 1,
                minHeight: '44px',
              }}
            >
              {saving ? 'SAVING...' : 'SAVE RETENTION'}
            </button>
            {saveSuccess && (
              <span style={{
                fontSize: '13px',
                color: 'var(--cockpit-green)',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}>
                &#10003; SAVED
              </span>
            )}
            {saveError && (
              <span style={{
                fontSize: '13px',
                color: 'var(--cockpit-red)',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}>
                SAVE FAILED
              </span>
            )}
          </div>
        )}
        {!isValid && inputValue !== '' && (
          <p style={{
            fontSize: '12px',
            color: 'var(--cockpit-red)',
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: '6px',
          }}>
            Value must be between 1 and 365.
          </p>
        )}
        <p style={{
          fontSize: '12px',
          color: '#666',
          fontStyle: 'italic',
          marginTop: '8px',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Current retention: {retentionDays} day{retentionDays === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )
}

const SERVICES = [
  { id: 'radarr', label: 'RADARR' },
  { id: 'sonarr', label: 'SONARR' },
  { id: 'lidarr', label: 'LIDARR' },
  { id: 'bazarr', label: 'BAZARR' },
  { id: 'prowlarr', label: 'PROWLARR' },
  { id: 'readarr', label: 'READARR [RETIRED]' },
  { id: 'sabnzbd', label: 'SABNZBD' },
  { id: 'pihole', label: 'PI-HOLE' },
  { id: 'plex', label: 'PLEX' },
  { id: 'nas', label: 'NAS' },
  { id: 'unifi', label: 'UBIQUITI' },
] as const

type ServiceId = (typeof SERVICES)[number]['id']

// Webhook services listed in Notifications tab (order per UI-SPEC)
const WEBHOOK_SERVICES = [
  { id: 'radarr', label: 'RADARR' },
  { id: 'sonarr', label: 'SONARR' },
  { id: 'lidarr', label: 'LIDARR' },
  { id: 'bazarr', label: 'BAZARR' },
  { id: 'prowlarr', label: 'PROWLARR' },
  { id: 'readarr', label: 'READARR' },
  { id: 'sabnzbd', label: 'SABNZBD' },
] as const

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

/** Returns the credential field label for each service */
function getCredentialLabel(serviceId: ServiceId): string {
  if (serviceId === 'pihole') return 'Password'
  if (serviceId === 'plex') return 'Plex Token'
  if (serviceId === 'nas') return 'DSM Password'
  if (serviceId === 'unifi') return 'API Token'
  return 'API KEY'
}

export function SettingsPage({ snapshot }: SettingsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawService = searchParams.get('service') ?? 'radarr'
  // 'notifications' and 'logs' are special non-service tabs
  const isNotificationsTab = rawService === 'notifications'
  const isLogsTab = rawService === 'logs'
  const activeTab: ServiceId = (!isNotificationsTab && !isLogsTab && SERVICES.some((s) => s.id === rawService))
    ? (rawService as ServiceId)
    : 'radarr'

  // Notifications tab state
  const [copiedService, setCopiedService] = useState<string | null>(null)

  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [username, setUsername] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)

  const loadTabConfig = useCallback(async (serviceId: string) => {
    try {
      const res = await fetch(`/api/settings/${serviceId}`)
      if (res.ok) {
        const data = await res.json() as { baseUrl: string; hasApiKey: boolean; enabled: boolean; username?: string }
        setUrl(data.baseUrl ?? '')
        setApiKey('')
        setUsername(data.username ?? '')
        setHasExistingKey(data.hasApiKey ?? false)
      } else {
        setUrl('')
        setApiKey('')
        setUsername('')
        setHasExistingKey(false)
      }
    } catch {
      setUrl('')
      setApiKey('')
      setUsername('')
      setHasExistingKey(false)
    }
    setTestResult(null)
    setShowKey(false)
    setSaved(false)
  }, [])

  useEffect(() => {
    void loadTabConfig(activeTab)
  }, [activeTab, loadTabConfig])

  const handleTabClick = (serviceId: ServiceId | 'notifications' | 'logs') => {
    setSearchParams({ service: serviceId })
  }

  // D-18: Webhook URLs use configured base URL, not window.location.host
  // Use placeholder if no base URL configured — user must configure manually
  const webhookBase = 'http://<coruscant-ip>:1688'

  const handleCopyWebhookUrl = async (url: string, serviceId: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedService(serviceId)
      setTimeout(() => setCopiedService(null), 1500)
    } catch {
      // clipboard write failed — silently ignore
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    setTestResult(null)
  }

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
    setTestResult(null)
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value)
    setTestResult(null)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/test-connection/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: url, apiKey, username }),
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
      const res = await fetch(`/api/settings/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: url, apiKey, username }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        await loadTabConfig(activeTab)
      } else {
        setTestResult({ success: false, message: `Save failed (${res.status})` })
      }
    } catch {
      setTestResult({ success: false, message: 'Save failed — network error' })
    } finally {
      setSaving(false)
    }
  }

  const webhookUrl = `http://${window.location.hostname}:1688/api/webhooks/tautulli`

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setWebhookCopied(true)
      setTimeout(() => setWebhookCopied(false), 2000)
    } catch {
      // clipboard write failed — silently ignore
    }
  }

  const credLabel = getCredentialLabel(activeTab)

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
          const isActive = !isNotificationsTab && svc.id === activeTab
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
        {/* NOTIFICATIONS special tab */}
        <button
          role="tab"
          aria-selected={isNotificationsTab}
          onClick={() => handleTabClick('notifications')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-rest)',
            borderBottom: isNotificationsTab
              ? '2px solid var(--cockpit-amber)'
              : '1px solid var(--border-rest)',
            color: isNotificationsTab ? 'var(--cockpit-amber)' : 'var(--text-offwhite)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: isNotificationsTab ? 600 : 400,
            letterSpacing: '0.06em',
            padding: '8px 16px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            marginRight: '4px',
            borderRadius: '4px 4px 0 0',
            transition: 'color 0.15s, border-bottom-color 0.15s',
          }}
        >
          NOTIFICATIONS
        </button>
        {/* LOGS special tab */}
        <button
          role="tab"
          aria-selected={isLogsTab}
          onClick={() => handleTabClick('logs')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-rest)',
            borderBottom: isLogsTab
              ? '2px solid var(--cockpit-amber)'
              : '1px solid var(--border-rest)',
            color: isLogsTab ? 'var(--cockpit-amber)' : 'var(--text-offwhite)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: isLogsTab ? 600 : 400,
            letterSpacing: '0.06em',
            padding: '8px 16px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            marginRight: '4px',
            borderRadius: '4px 4px 0 0',
            transition: 'color 0.15s, border-bottom-color 0.15s',
          }}
        >
          LOGS
        </button>
      </div>

      {/* NOTIFICATIONS tab panel */}
      {isNotificationsTab && (
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
          <p style={{
            fontSize: '14px',
            color: 'var(--text-offwhite)',
            margin: 0,
            marginBottom: '16px',
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.5,
          }}>
            Configure arr apps to POST events to these endpoints. Paste the URL into each app&apos;s Connections settings.
          </p>
          {WEBHOOK_SERVICES.map((svc) => {
            const webhookUrl = `${webhookBase}/api/webhooks/${svc.id}`
            const isCopied = copiedService === svc.id
            return (
              <div
                key={svc.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {/* Service label */}
                <div style={{
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 400,
                  color: 'rgba(232,160,32,0.6)',
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                }}>
                  {svc.label}
                </div>
                {/* URL row: URL display + COPY URL button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    flex: 1,
                    fontSize: '12px',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'rgba(200,200,200,0.8)',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(232,160,32,0.15)',
                    padding: '4px 8px',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {webhookUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyWebhookUrl(webhookUrl, svc.id)}
                    aria-label={`Copy webhook URL for ${svc.label}`}
                    style={{
                      flexShrink: 0,
                      fontSize: '12px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: 'var(--cockpit-amber)',
                      border: '1px solid rgba(232,160,32,0.3)',
                      padding: '4px 8px',
                      background: isCopied ? 'rgba(232,160,32,0.1)' : 'transparent',
                      cursor: 'pointer',
                      borderRadius: '2px',
                      minHeight: '32px',
                      transition: 'border-color 0.15s, background 0.15s',
                      letterSpacing: '0.06em',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(232,160,32,0.7)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(232,160,32,0.3)'
                    }}
                  >
                    {isCopied ? 'COPIED' : 'COPY URL'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LOGS tab panel */}
      {isLogsTab && <LogsTab />}

      {/* Service config panel */}
      {!isNotificationsTab && !isLogsTab && (
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

        {/* NAS-only: DSM Username field (between URL and password) */}
        {activeTab === 'nas' && (
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
              DSM Username
            </label>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="admin"
              style={inputStyle}
              autoComplete="username"
            />
          </div>
        )}

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
            {credLabel.toUpperCase()}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder={hasExistingKey ? '(saved — enter new value to change)' : credLabel}
              style={{ ...inputStyle, paddingRight: '42px' }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? `Hide ${credLabel}` : `Show ${credLabel}`}
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

        {/* Plex-only: read-only Webhook URL with copy button (D-32) */}
        {activeTab === 'plex' && (
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
              Webhook URL
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={webhookUrl}
                readOnly
                style={{
                  ...inputStyle,
                  paddingRight: '80px',
                  cursor: 'default',
                  opacity: 0.8,
                  background: 'rgba(255,255,255,0.03)',
                }}
              />
              <button
                type="button"
                onClick={() => void handleCopyWebhook()}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: webhookCopied ? 'rgba(74,222,128,0.2)' : 'rgba(232,160,32,0.15)',
                  border: `1px solid ${webhookCopied ? 'var(--cockpit-green)' : 'var(--cockpit-amber)'}`,
                  cursor: 'pointer',
                  color: webhookCopied ? 'var(--cockpit-green)' : 'var(--cockpit-amber)',
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  padding: '3px 8px',
                  borderRadius: '3px',
                }}
                aria-label="Copy webhook URL to clipboard"
              >
                {webhookCopied ? 'COPIED!' : 'COPY'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginTop: '4px' }}>
              In Tautulli &gt; Settings &gt; Notification Agents &gt; Add &gt; Webhook &gt; paste URL above. Enable: Playback Start, Playback Stop, Playback Pause, Playback Resume.
            </p>
          </div>
        )}

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

        {/* Pi-hole note */}
        {activeTab === 'pihole' && (
          <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginTop: '8px' }}>
            Pi-hole v6 or higher required.
          </p>
        )}

        {/* NAS note */}
        {activeTab === 'nas' && (
          <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginTop: '8px' }}>
            Requires an admin-level DSM account.
          </p>
        )}
      </div>
      )}
    </div>
  )
}
