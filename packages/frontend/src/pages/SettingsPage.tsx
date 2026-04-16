import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StatusDot } from '../components/ui/StatusDot.js'
import { useViewport } from '../viewport/index.js'
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

// WEATHER tab component — ZIP code / location settings
function WeatherTab() {
  const [zip, setZip] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [location, setLocation] = useState<{ name: string; lat: number; lon: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/settings/weather')
        if (res.ok) {
          const data = await res.json() as { zip?: string; location?: { name: string; lat: number; lon: number } }
          setZip(data.zip ?? '')
          setLocation(data.location ?? null)
        }
      } catch {
        // backend route may not exist yet — ignore
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async () => {
    if (!zip.trim()) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)
    try {
      const res = await fetch('/api/settings/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip: zip.trim() }),
      })
      if (res.ok) {
        const data = await res.json() as { success?: boolean; location?: string; lat?: number; lon?: number }
        if (data.location && data.lat !== undefined && data.lon !== undefined) {
          setLocation({ name: data.location, lat: data.lat, lon: data.lon })
        }
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      } else {
        const errData = await res.json().catch(() => ({})) as { error?: string; message?: string }
        setSaveError(errData.error ?? errData.message ?? `Save failed (${res.status})`)
        setTimeout(() => setSaveError(null), 4000)
      }
    } catch {
      setSaveError('Weather settings not yet available')
      setTimeout(() => setSaveError(null), 4000)
    } finally {
      setSaving(false)
    }
  }

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
          ZIP CODE
        </label>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-offwhite)',
          marginBottom: '12px',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.5,
        }}>
          Enter your US ZIP code to enable local weather on the dashboard.
        </p>
        {loading ? (
          <p style={{ fontSize: '13px', color: 'var(--text-offwhite)', fontFamily: "'JetBrains Mono', monospace" }}>
            Loading...
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="90210"
              style={{
                width: '120px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-rest)',
                color: 'var(--text-offwhite)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '14px',
                padding: '8px 12px',
                borderRadius: '4px',
                outline: 'none',
                minHeight: '44px',
              }}
              aria-label="ZIP code"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || zip.length !== 5}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                padding: '8px 20px',
                borderRadius: '4px',
                cursor: saving || zip.length !== 5 ? 'not-allowed' : 'pointer',
                border: '1px solid var(--cockpit-amber)',
                textTransform: 'uppercase',
                background: 'var(--cockpit-amber)',
                color: '#0D0D0D',
                opacity: saving || zip.length !== 5 ? 0.6 : 1,
                minHeight: '44px',
              }}
            >
              {saving ? 'SAVING...' : 'SAVE'}
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
          </div>
        )}
        {saveError && (
          <p style={{
            fontSize: '12px',
            color: 'var(--cockpit-red)',
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: '8px',
          }}>
            {saveError}
          </p>
        )}
        {location && (
          <p style={{
            fontSize: '12px',
            color: '#666',
            fontStyle: 'italic',
            marginTop: '8px',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Location: {location.name} ({location.lat.toFixed(4)}, {location.lon.toFixed(4)})
          </p>
        )}
      </div>
    </div>
  )
}

// Section groupings (D-15)
const SECTIONS = [
  { id: 'media', label: 'MEDIA', services: ['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'plex', 'sabnzbd'] },
  { id: 'network', label: 'NETWORK', services: ['pihole', 'unifi'] },
  { id: 'system', label: 'SYSTEM', services: ['nas', 'piHealth', 'weather'] },
  { id: 'notifications', label: 'NOTIFICATIONS', services: ['notifications'] },
  { id: 'logs', label: 'LOGS', services: ['logs'] },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

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
  { id: 'piHealth', label: 'PI HEALTH' },
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

/** Find which section a service ID belongs to */
function sectionForService(serviceId: string): SectionId {
  for (const section of SECTIONS) {
    if ((section.services as readonly string[]).includes(serviceId)) {
      return section.id
    }
  }
  return 'media'
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
  if (serviceId === 'piHealth') return ''
  return 'API KEY'
}

export function SettingsPage({ snapshot }: SettingsPageProps) {
  const viewport = useViewport()
  const isPortrait = viewport === 'iphone-portrait'
  const [searchParams, setSearchParams] = useSearchParams()

  const rawService = searchParams.get('service') ?? 'radarr'
  const rawSection = searchParams.get('section')

  // Derive active section: use ?section= param if present, else derive from ?service=
  const derivedSection: SectionId = rawSection && SECTIONS.some(s => s.id === rawSection)
    ? (rawSection as SectionId)
    : sectionForService(rawService)

  const [activeSection, setActiveSection] = useState<SectionId>(derivedSection)

  // Sync activeSection when URL params change (e.g., external navigation)
  useEffect(() => {
    setActiveSection(derivedSection)
  }, [derivedSection])

  // 'notifications' and 'logs' are special non-service tabs
  const isNotificationsTab = rawService === 'notifications'
  const isLogsTab = rawService === 'logs'
  const isWeatherTab = rawService === 'weather'

  const activeTab: ServiceId = (!isNotificationsTab && !isLogsTab && !isWeatherTab && SERVICES.some((s) => s.id === rawService))
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
    if (!isNotificationsTab && !isLogsTab && !isWeatherTab) {
      void loadTabConfig(activeTab)
    }
  }, [activeTab, isNotificationsTab, isLogsTab, isWeatherTab, loadTabConfig])

  const handleSectionClick = (sectionId: SectionId) => {
    const section = SECTIONS.find(s => s.id === sectionId)
    if (!section) return
    const firstService = section.services[0]
    setSearchParams({ section: sectionId, service: firstService })
  }

  const handleTabClick = (serviceId: ServiceId | 'notifications' | 'logs' | 'weather') => {
    setSearchParams({ section: activeSection, service: serviceId })
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

  // Compute services shown in the tab bar for the active section
  const currentSection = SECTIONS.find(s => s.id === activeSection) ?? SECTIONS[0]
  const currentSectionServices = currentSection.services

  // Side rail button style helper
  const sideRailBtnStyle = (isActive: boolean): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    borderLeft: isActive
      ? '3px solid var(--cockpit-amber)'
      : '3px solid transparent',
    padding: '8px 12px',
    color: isActive ? 'var(--cockpit-amber)' : 'var(--text-secondary)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    letterSpacing: '0.1em',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: isActive
      ? '-4px 0 8px -2px rgba(232, 160, 32, 0.3)'
      : 'none',
    width: '100%',
  })

  return (
    <div style={{ padding: '0 16px', maxWidth: '760px', margin: '0 auto' }}>
      <h1
        className="text-heading"
        style={{ marginBottom: '20px', color: 'var(--cockpit-amber)' }}
      >
        Settings
      </h1>

      {/* Two-column layout: side rail (left) + content panel (right); stacks vertically in portrait */}
      <div className="settings-layout" style={{
        display: 'flex',
        flexDirection: isPortrait ? 'column' : 'row',
        gap: '16px',
        alignItems: 'flex-start',
      }}>

        {/* Left column — Side rail (D-17); horizontal scroll bar in portrait */}
        <div className="settings-sidebar" style={{
          width: isPortrait ? '100%' : '120px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: isPortrait ? 'row' : 'column',
          overflowX: isPortrait ? 'auto' : undefined,
          gap: isPortrait ? '4px' : '2px',
          paddingTop: '4px',
        }}>
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => handleSectionClick(section.id)}
              style={sideRailBtnStyle(activeSection === section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Right column — Content panel */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Tab bar — scoped to active section's services (only if multiple services in section) */}
          {currentSectionServices.length > 1 && !isNotificationsTab && !isLogsTab && (
            <div
              style={{
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                WebkitOverflowScrolling: 'touch',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-rest)',
              }}
              role="tablist"
              aria-label="Service configuration tabs"
            >
              {currentSectionServices.map((serviceId) => {
                const svc = serviceId === 'weather'
                  ? { id: 'weather', label: 'WEATHER' }
                  : SERVICES.find(s => s.id === serviceId)
                if (!svc) return null
                const isActive = rawService === serviceId
                const status = serviceId === 'weather'
                  ? ('stale' as ServiceStatus['status'])
                  : getServiceStatus(snapshot, serviceId)
                return (
                  <button
                    key={serviceId}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTabClick(serviceId as ServiceId | 'weather')}
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
          )}

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

          {/* WEATHER tab panel */}
          {isWeatherTab && <WeatherTab />}

          {/* Service config panel */}
          {!isNotificationsTab && !isLogsTab && !isWeatherTab && (
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

            {/* NAS/piHealth: Username field (between URL and password) */}
            {(activeTab === 'nas' || activeTab === 'piHealth') && (
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
                  {activeTab === 'piHealth' ? 'SSH Username' : 'DSM Username'}
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

            {/* Hide API key/password field for piHealth — no credentials needed */}
            {activeTab !== 'piHealth' && (
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
            )}

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
      </div>
    </div>
  )
}
