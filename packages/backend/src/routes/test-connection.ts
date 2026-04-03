import type { FastifyInstance } from 'fastify'
import axios from 'axios'

const VALID_SERVICES = [
  'radarr', 'sonarr', 'lidarr', 'bazarr', 'prowlarr', 'readarr', 'sabnzbd',
] as const

const ARR_SERVICES = new Set(['radarr', 'sonarr', 'lidarr', 'prowlarr', 'readarr'])

type ValidService = (typeof VALID_SERVICES)[number]

function isValidService(id: string): id is ValidService {
  return (VALID_SERVICES as readonly string[]).includes(id)
}

export async function testConnectionRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/test-connection/:serviceId
   *
   * Makes a live connectivity check against the service using the provided
   * credentials. Always returns HTTP 200 — success/failure is in the body.
   */
  fastify.post<{
    Params: { serviceId: string }
    Body: { baseUrl?: string; apiKey?: string }
  }>('/api/test-connection/:serviceId', async (request, reply) => {
    const { serviceId } = request.params

    if (!isValidService(serviceId)) {
      return reply.code(400).send({ error: `Unknown service: ${serviceId}` })
    }

    const baseUrl = (request.body.baseUrl ?? '').replace(/\/$/, '')
    const apiKey = request.body.apiKey ?? ''
    const timeout = 10_000

    try {
      if (ARR_SERVICES.has(serviceId)) {
        // *arr services: hit /api/v3/health with X-Api-Key header
        const response = await axios.get<Array<{ type: string; message: string }>>(
          `${baseUrl}/api/v3/health`,
          {
            headers: { 'X-Api-Key': apiKey },
            timeout,
          },
        )

        const healthItems = Array.isArray(response.data) ? response.data : []
        const warningCount = healthItems.filter(
          (item) => item.type === 'warning' || item.type === 'error'
            || item.type === 'Warning' || item.type === 'Error',
        ).length

        return reply.send({
          success: true,
          message: `Connected v3 - ${warningCount} warning${warningCount !== 1 ? 's' : ''}`,
        })
      }

      if (serviceId === 'bazarr') {
        // Bazarr: GET /api/system/status with apikey query param
        await axios.get(`${baseUrl}/api/system/status`, {
          params: { apikey: apiKey },
          timeout,
        })

        return reply.send({ success: true, message: 'Connected' })
      }

      if (serviceId === 'sabnzbd') {
        // SABnzbd: GET /api?mode=queue&output=json&apikey=...
        const response = await axios.get<{ queue?: { noofslots?: number } }>(
          `${baseUrl}/api`,
          {
            params: { mode: 'queue', output: 'json', apikey: apiKey },
            timeout,
          },
        )

        const queueCount = response.data?.queue?.noofslots ?? 0
        return reply.send({
          success: true,
          message: `Connected - queue has ${queueCount} item${queueCount !== 1 ? 's' : ''}`,
        })
      }

      // Should not reach here given the valid service list
      return reply.send({ success: false, message: 'Unsupported service' })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error'
      return reply.send({ success: false, message })
    }
  })
}
