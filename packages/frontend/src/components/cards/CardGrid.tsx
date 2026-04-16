import { motion } from 'framer-motion'
import type { DashboardSnapshot, ArrWebhookEvent, NasStatus } from '@coruscant/shared'
import { ServiceCard, MediaStackRow } from './ServiceCard.js'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js'

const ARR_IDS = new Set(['radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr'])

// Download-active arr services (have activeDownloads/downloadProgress in metrics)
const DOWNLOAD_ARR_IDS = ['radarr', 'sonarr', 'lidarr']

// Ordered columns for the arr tile (D-09, D-12)
const LEFT_COL_IDS = ['radarr', 'sonarr', 'lidarr']
const RIGHT_COL_IDS = ['prowlarr', 'bazarr', 'readarr']

interface CardGridProps {
  snapshot: DashboardSnapshot | null
  lastArrEvent?: ArrWebhookEvent | null
  activeOutages?: Map<string, { message?: string; since: string }>
  nasStatus?: NasStatus | null
}

/** Clean NZB/torrent filename into a human-readable title.
 *  "Movie.Name.2024.1080p.WEB-DL.DDP5.1.x264-GROUP.mkv" → "Movie Name"
 *  Strips: year (4 digits), quality tags, codec, group, extension.
 */
function cleanFilename(filename: string): string {
  // Remove file extension
  let name = filename.replace(/\.\w{2,4}$/, '')
  // Replace dots and underscores with spaces
  name = name.replace(/[._]/g, ' ')
  // Truncate at first 4-digit year (e.g. 2024) or common quality tag
  name = name.replace(/\s+(19|20)\d{2}\b.*$/i, '')
  name = name.replace(/\s+(480|720|1080|2160|4k)\s*p?\b.*$/i, '')
  name = name.replace(/\s+(web|bluray|bdrip|hdtv|dvdrip|webrip|web-dl)\b.*$/i, '')
  // Trim
  return name.trim() || filename
}

/** Inline download activity section inside the Media tile */
function DownloadActivity({ snapshot }: { snapshot: DashboardSnapshot }) {
  const arrServices = snapshot.services.filter(s => DOWNLOAD_ARR_IDS.includes(s.id))
  const sabnzbd = snapshot.services.find(s => s.id === 'sabnzbd')

  // Active arr downloads (for title extraction)
  const activeArr = arrServices.filter(s => {
    const m = s.metrics as Record<string, unknown> | undefined
    return m?.downloading === true && typeof m?.activeDownloads === 'number' && (m.activeDownloads as number) > 0
  })

  // SABnzbd activity
  const sabMetrics = sabnzbd?.metrics as Record<string, unknown> | undefined
  const sabSpeedMBs = typeof sabMetrics?.speedMBs === 'number' ? sabMetrics.speedMBs : 0
  const sabQueueCount = typeof sabMetrics?.queueCount === 'number' ? sabMetrics.queueCount : 0
  const sabProgressPercent = typeof sabMetrics?.progressPercent === 'number' ? sabMetrics.progressPercent : 0
  const sabHasActivity = sabSpeedMBs > 0 || sabQueueCount > 0
  const sabCurrentFilename = typeof sabMetrics?.currentFilename === 'string' ? sabMetrics.currentFilename : ''

  // Animated speed — count-up tween on value change (D-19)
  // Multiply by 10 to retain one decimal of precision in the integer animation
  const animSpeedTimes10 = useAnimatedNumber(Math.round(sabSpeedMBs * 10))

  const hasAnyActivity = activeArr.length > 0 || sabHasActivity

  // Derive active title: three-tier lookup
  // Priority 1: arr service actively downloading with a title
  // Priority 2: any arr service with an activeTitle (may not be in "downloading" state yet)
  // Priority 3: clean the SABnzbd filename as last resort
  const activeTitle = (() => {
    for (const s of activeArr) {
      const m = s.metrics as Record<string, unknown>
      if (typeof m.activeTitle === 'string' && m.activeTitle) return m.activeTitle
    }
    for (const s of arrServices) {
      const m = s.metrics as Record<string, unknown> | undefined
      if (typeof m?.activeTitle === 'string' && m.activeTitle) return m.activeTitle
    }
    return sabCurrentFilename ? cleanFilename(sabCurrentFilename) : ''
  })()

  // Derive time remaining: arr first, then SABnzbd fallback
  const timeLeft = (() => {
    for (const s of activeArr) {
      const m = s.metrics as Record<string, unknown>
      if (typeof m.timeLeft === 'string' && m.timeLeft) return m.timeLeft
    }
    const sabTime = typeof sabMetrics?.timeLeft === 'string' ? sabMetrics.timeLeft : ''
    return sabTime
  })()

  return (
    <div className="downloads">
      {/* Divider */}
      <div className="downloads__divider" />

      {/* DOWNLOADS sub-label + time remaining on same line */}
      <div className="downloads__label-row">
        <span className="downloads__label">
          DOWNLOADS
        </span>
        {timeLeft && (
          <span className="downloads__time-left">
            {timeLeft}
          </span>
        )}
      </div>

      {/* Active state: title + SABnzbd bar + speed only */}
      {hasAnyActivity && (
        <div className="downloads__active">
          {/* Download title — 22px bold purple with marquee scroll for long titles */}
          {activeTitle && (
            <div className="downloads__title-wrap">
              <span
                className="downloads__title"
                style={activeTitle.length > 25
                  ? { animation: 'downloadsMarquee 8s linear infinite', animationDelay: '2s' }
                  : undefined}
              >
                {activeTitle}
              </span>
            </div>
          )}
          {/* SABnzbd progress bar + speed */}
          <div className="downloads__bar-row">
            <div className="downloads__bar-track">
              <div
                className="downloads__bar-fill"
                style={{ width: `${Math.min(Math.max(sabProgressPercent, 5), 100)}%` }}
              />
            </div>
            <span className="downloads__speed">
              {(animSpeedTimes10 / 10).toFixed(1)} <span className="downloads__speed-unit">MB/s</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function CardGrid({ snapshot, lastArrEvent, activeOutages, nasStatus }: CardGridProps) {
  if (!snapshot) {
    // Skeleton state: two placeholder cards
    return (
      <div className="card-grid--skeleton">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="chamfer-card card-grid__placeholder"
          />
        ))}
      </div>
    )
  }

  // Exclude nas-detail (legacy), Plex (in NowPlayingBanner), UniFi (embedded in NETWORK card)
  // SABnzbd is absorbed into Media tile
  const allServices = snapshot.services.filter(
    (s) => s.id !== 'nas-detail' && s.id !== 'plex' && s.id !== 'unifi',
  )
  const arrServices = allServices.filter((s) => ARR_IDS.has(s.id))

  // NAS service for full-width tile
  const nasService = allServices.find(s => s.id === 'nas')
  // Pi-hole service for network tile
  const piholeService = allServices.find(s => s.id === 'pihole')

  // Build ordered columns — only include services that exist in the snapshot
  const leftColArr = LEFT_COL_IDS
    .map((id) => arrServices.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
  const rightColArr = RIGHT_COL_IDS
    .map((id) => arrServices.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)

  let globalIndex = 0

  return (
    <div className="card-grid">

      {/* Row 1: NAS tile — full width */}
      {nasService && (
        <ServiceCard
          key={nasService.id}
          service={nasService}
          index={globalIndex++}
          allServices={snapshot.services}
          nasStatus={nasStatus}
        />
      )}

      {/* Row 2: 2-column — Media tile left, Network tile right */}
      <div className="card-grid__row-2col">

        {/* Media tile — arr LED rows + download activity section */}
        {arrServices.length > 0 && (
          <motion.div
            className="chamfer-card media-tile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: globalIndex * 0.08, duration: 0.3, ease: 'easeOut' }}
          >
            {/* 20px amber header strip with MEDIA label */}
            <div className="media-tile__header">
              <span className="ribbon-label">MEDIA</span>
            </div>
            {/* Two-column layout: L = Radarr/Sonarr/Lidarr, R = Prowlarr/Bazarr/Readarr */}
            <div className="media-tile__cols">
              <div className="media-tile__col">
                {leftColArr.map((service) => (
                  <MediaStackRow key={service.id} service={service} index={globalIndex++} lastArrEvent={lastArrEvent} activeOutages={activeOutages} />
                ))}
              </div>
              <div className="media-tile__col">
                {rightColArr.map((service) => (
                  <MediaStackRow key={service.id} service={service} index={globalIndex++} lastArrEvent={lastArrEvent} activeOutages={activeOutages} />
                ))}
              </div>
            </div>
            {/* Download activity section */}
            <div className="downloads__wrap">
              <DownloadActivity snapshot={snapshot} />
            </div>
          </motion.div>
        )}

        {/* Network tile — Pi-hole with Ubiquiti */}
        {piholeService && (
          <ServiceCard
            key={piholeService.id}
            service={piholeService}
            index={globalIndex++}
            allServices={snapshot.services}
          />
        )}
      </div>
    </div>
  )
}
