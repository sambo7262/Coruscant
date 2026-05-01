import { motion } from 'framer-motion'
import type { ImageUpdateDetail } from '@coruscant/shared'

interface DockerUpdatePanelProps {
  images: ImageUpdateDetail[]
  checkedAt?: string
  hasUpdates: boolean
}

export function DockerUpdatePanel({ images, checkedAt, hasUpdates }: DockerUpdatePanelProps) {
  const pendingUpdates = images.filter(img => img.updateAvailable)
  const lastCheckedText = checkedAt
    ? `${Math.round((Date.now() - new Date(checkedAt).getTime()) / 60_000)}m ago`
    : 'Checking...'

  return (
    <motion.div
      className="docker-update-panel"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      <div className="docker-update-panel__inner">
        <div className="docker-update-panel__header">
          DOCKER IMAGES — {lastCheckedText}
        </div>
        {!hasUpdates ? (
          <div className="docker-update-panel__all-good">ALL IMAGES UP TO DATE</div>
        ) : (
          pendingUpdates.map(img => (
            <div key={img.tag} className="docker-update-panel__row">
              <span className="docker-update-panel__tag">{img.tag}</span>
              <span className="docker-update-panel__status">UPDATE AVAILABLE</span>
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}
