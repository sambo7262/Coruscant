import axios from 'axios'
import https from 'node:https'
import type { PlexStream, PlexServerStats } from '@coruscant/shared'

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
  Player: { title: string; state?: string }
  TranscodeSession?: { videoDecision?: string }
  Media?: Array<{
    videoResolution?: string
    audioCodec?: string   // e.g. 'flac', 'aac', 'mp3'
    bitrate?: number      // Kbps
  }>
  Session?: { bandwidth?: number }  // kbps — present when session is active
}

interface PlexSessionsResponse {
  MediaContainer: {
    Metadata?: PlexMetadataItem[]
  }
}

interface PlexStatisticsResponse {
  MediaContainer: {
    StatisticsResources?: Array<{
      timeAt: number
      cpuPercentage: number    // 0-100 float — Plex process CPU
      physMemMB: number        // Plex process RAM usage in MB
      totalPhysMemMB: number   // Total system RAM in MB
    }>
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
 * Maps each session to a PlexStream and computes total session bandwidth (kbps).
 * Returns { streams: [], totalBandwidthKbps: 0 } on any error or when no streams
 * are active. Never throws.
 */
export async function fetchPlexSessions(
  baseUrl: string,
  token: string,
): Promise<{ streams: PlexStream[]; totalBandwidthKbps: number }> {
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
      return { streams: [], totalBandwidthKbps: 0 }
    }

    const streams = metadata.map((item): PlexStream => {
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
        state: (item.Player.state === 'playing' || item.Player.state === 'paused' || item.Player.state === 'buffering')
          ? item.Player.state
          : undefined,
      }
    })

    const totalBandwidthKbps = metadata.reduce(
      (sum, item) => sum + (item.Session?.bandwidth ?? 0),
      0,
    )

    return { streams, totalBandwidthKbps }
  } catch {
    // Network error, parse error, non-200 — return empty (idle state)
    return { streams: [], totalBandwidthKbps: 0 }
  }
}

/**
 * Fetches Plex server resource stats from the PMS /statistics/resources endpoint.
 *
 * GET /statistics/resources?timespan=6&X-Plex-Token=<token>
 * Headers: Accept: application/json
 *
 * Combines the CPU/RAM data from the most recent StatisticsResources entry with
 * the pre-computed session bandwidth (kbps) from fetchPlexSessions.
 *
 * Returns undefined when:
 * - /statistics/resources returns no entries
 * - Network error or non-200 response
 * Never throws.
 */
export async function fetchPlexServerStats(
  baseUrl: string,
  token: string,
  sessionBandwidthKbps: number,
): Promise<PlexServerStats | undefined> {
  try {
    const response = await axios.get<PlexStatisticsResponse>(
      `${baseUrl}/statistics/resources?timespan=1&X-Plex-Token=${token}`,
      {
        headers: { Accept: 'application/json' },
        httpsAgent,
        timeout: TIMEOUT_MS,
      },
    )

    const bandwidthMbps = Math.round((sessionBandwidthKbps / 1000) * 10) / 10

    const entries = response.data.MediaContainer?.StatisticsResources
    if (!entries || entries.length === 0) {
      // PMS returned a 200 OK but no resource entries — common in idle state when
      // /statistics/resources has no data yet. Return zeroed stats so the stats
      // block always renders while Plex is configured, rather than disappearing.
      return { processCpuPercent: 0, processRamPercent: 0, bandwidthMbps }
    }

    // PMS returns entries ascending by timeAt — take the LAST entry (most recent)
    const entry = entries[entries.length - 1]!

    const processCpuPercent = Math.round(entry.cpuPercentage * 10) / 10
    const processRamPercent = Math.round((entry.physMemMB / entry.totalPhysMemMB) * 1000) / 10

    return { processCpuPercent, processRamPercent, bandwidthMbps }
  } catch {
    // Network error, parse error, non-200 — return undefined (graceful degradation).
    // Only truly unreachable PMS → undefined; a 200 with empty entries is handled above.
    return undefined
  }
}
