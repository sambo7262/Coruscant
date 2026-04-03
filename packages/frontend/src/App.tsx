import { Routes, Route } from 'react-router-dom'
import { AppHeader } from './components/layout/AppHeader.js'
import { GridBackground } from './components/layout/GridBackground.js'
import { NowPlayingBanner } from './components/layout/NowPlayingBanner.js'
import { DashboardPage } from './pages/DashboardPage.js'
import { ServiceDetailPage } from './pages/ServiceDetailPage.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { LogsPage } from './pages/LogsPage.js'
import { useDashboardSSE } from './hooks/useDashboardSSE.js'

export default function App() {
  const { snapshot } = useDashboardSSE()

  return (
    <>
      <GridBackground />
      <AppHeader nas={snapshot?.nas ?? null} />
      <main style={{ position: 'relative', zIndex: 1, paddingTop: '88px', paddingBottom: '64px' }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/services/:serviceId" element={<ServiceDetailPage snapshot={snapshot} />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </main>
      <NowPlayingBanner streams={snapshot?.streams ?? []} />
    </>
  )
}
