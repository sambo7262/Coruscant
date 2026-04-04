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

export default function App() {
  const { snapshot, connected } = useDashboardSSE()
  const location = useLocation()
  const showBack = location.pathname !== '/'

  // Derive whether NAS has been configured in Settings
  // Uses strict !== false check so legacy/mock services without the flag are not treated as unconfigured
  const nasConfigured = snapshot?.services.find(s => s.id === 'nas')?.configured !== false

  // D-11: Plex rail only shows when Plex is configured
  // Uses strict !== false check so legacy/mock services without the flag are not treated as unconfigured
  const plexConfigured = snapshot?.services.find(s => s.id === 'plex')?.configured !== false

  return (
    <>
      <GridBackground />
      <WiringOverlay />
      <AppHeader nas={snapshot?.nas ?? null} connected={connected} showBack={showBack} nasConfigured={nasConfigured} />
      <main style={{ position: 'relative', zIndex: 1, paddingTop: '88px', paddingBottom: '64px' }}>
        <Routes>
          <Route path="/" element={<DashboardPage snapshot={snapshot} />} />
          <Route path="/services/:serviceId" element={<ServiceDetailPage snapshot={snapshot} />} />
          <Route path="/settings" element={<SettingsPage snapshot={snapshot} />} />
          <Route path="/logs" element={<LogsPage />} />
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
