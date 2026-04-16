import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AppHeader } from './components/layout/AppHeader.js'
import { GridBackground } from './components/layout/GridBackground.js'
import { WiringOverlay } from './components/layout/WiringOverlay.js'
import { NowPlayingBanner } from './components/layout/NowPlayingBanner.js'
import { DashboardPage } from './pages/DashboardPage.js'
import { ServiceDetailPage } from './pages/ServiceDetailPage.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { LogsPage } from './pages/LogsPage.js'
import { useDashboardSSE } from './hooks/useDashboardSSE.js'
import { useViewport } from './viewport/index.js'

export default function App() {
  const { snapshot, connected, lastArrEvent, activeOutages, lastLogEntry } = useDashboardSSE()
  const location = useLocation()
  const showBack = location.pathname !== '/'
  const isDashboard = location.pathname === '/'
  const viewport = useViewport()
  const isIphone = viewport.startsWith('iphone')

  // Lock body scroll on dashboard route to prevent viewport overflow on kiosk (800x480)
  // iPhone portrait allows free scroll (D-03) so only lock when NOT on iPhone
  useEffect(() => {
    document.body.style.overflow = isDashboard && !isIphone ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isDashboard, isIphone])

  // D-11: Plex rail only shows when Plex is configured
  // Uses strict !== false check so legacy/mock services without the flag are not treated as unconfigured
  const plexConfigured = snapshot?.services.find(s => s.id === 'plex')?.configured !== false

  return (
    <>
      <div className="crt-sweep" aria-hidden="true" />
      <GridBackground />
      <WiringOverlay />
      <AppHeader connected={connected} showBack={showBack} lastArrEvent={lastArrEvent} activeOutages={activeOutages} weatherData={snapshot?.weather ?? null} piHealth={snapshot?.piHealth ?? null} />
      <main className="app-main" style={{
        position: 'relative',
        zIndex: 1,
        paddingTop: isIphone ? 'calc(44px + env(safe-area-inset-top) + 8px)' : '52px',
        paddingBottom: isIphone ? 'calc(56px + env(safe-area-inset-bottom) + 8px)' : '40px',
      }}>
        <Routes>
          <Route path="/" element={<DashboardPage snapshot={snapshot} lastArrEvent={lastArrEvent} activeOutages={activeOutages} />} />
          <Route path="/services/:serviceId" element={<ServiceDetailPage snapshot={snapshot} />} />
          <Route path="/settings" element={<SettingsPage snapshot={snapshot} />} />
          <Route path="/logs" element={<LogsPage lastLogEntry={lastLogEntry} />} />
        </Routes>
      </main>
      <NowPlayingBanner
        streams={snapshot?.streams ?? []}
        plexServerStats={snapshot?.plexServerStats}
        plexConfigured={plexConfigured}
      />
    </>
  )
}
