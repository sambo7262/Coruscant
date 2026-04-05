import axios from 'axios'
import https from 'node:https'
import type { PlexStream } from '@coruscant/shared'

const TIMEOUT_MS = 5_000

// Self-signed cert support — Plex servers often use self-signed TLS certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

interface PlexMetadataItem {
  type: string            // 'movie' | 'episode' | 'track'
  title: string           // episode title or movie title or track title
  grandparentTitle?: string  // show name (TV) or artist name (music)
  parentTitle?: string    // album name (music) or season name (TV)
  year?: number
  parentIndex?: number    // season number
  index?: number          // episode number
  state?: string          // 'playing' | 'paused' | 'buffering'
  User: { title: string }
  Player: { title: string }
  TranscodeSession?: { videoDecision?: string }
  Media?: Array<{
    videoResolution?: string
    audioCodec?: string   // e.g. 'flac', 'aac', 'mp3'
    bitrate?: number      // Kbps
  }>
}

interface PlexSessionsResponse {
  MediaContainer: {
    Metadata?: PlexMetadataItem[]
  }
}

function deriveTitle(item: PlexMetadataItem): string {
  if (item.type === 'episode' || item.type === 'track') {
    return `${item.grandparentTitle ?? ''} - ${item.title}`
  }
  return item.title
}

/**
 * Fetches current Plex sessions directly from the Plex Media Server.
 *
 * GET /status/sessions?X-Plex-Token=<token>
 * Headers: Accept: application/json
 *
 * Maps each session to a PlexStream. Returns [] on any error or when no streams
 * are active. Never throws.
 */
export async function fetchPlexSessions(baseUrl: string, token: string): Promise<PlexStream[]> {
  try {
    const response = await axios.get<PlexSessionsResponse>(
      `${baseUrl}/status/sessions?X-Plex-Token=${token}`,
      {
        headers: { Accept: 'application/json' },
        httpsAgent,
        timeout: TIMEOUT_MS,
      },
    )

    const metadata = response.data.MediaContainer?.Metadata
    if (!metadata || metadata.length === 0) {
      return []
    }

    return metadata.map((item): PlexStream => {
      const isAudio = item.type === 'track'
      const mediaType: PlexStream['mediaType'] = isAudio ? 'audio' : 'video'

      let quality: string
      if (isAudio) {
        const codec = item.Media?.[0]?.audioCodec ?? 'Unknown'
        const bitrate = item.Media?.[0]?.bitrate
        quality = bitrate ? `${codec.toUpperCase()} ${bitrate}k` : codec.toUpperCase()
      } else {
        quality = item.Media?.[0]?.videoResolution ?? 'Unknown'
      }

      return {
        user: item.User.title,
        title: deriveTitle(item),
        deviceName: item.Player.title,
        year: item.year ?? undefined,
        season: isAudio ? undefined : (item.parentIndex ?? undefined),
        episode: isAudio ? undefined : (item.index ?? undefined),
        progressPercent: 0,
        quality,
        transcode: item.TranscodeSession !== undefined,
        mediaType,
        albumName: isAudio ? (item.parentTitle ?? undefined) : undefined,
        trackTitle: isAudio ? item.title : undefined,
        state: (item.state === 'playing' || item.state === 'paused' || item.state === 'buffering')
          ? item.state
          : undefined,
      }
    })
  } catch {
    // Network error, parse error, non-200 — return empty (idle state)
    return []
  }
}
