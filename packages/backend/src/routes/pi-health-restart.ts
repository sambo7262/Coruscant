import type { FastifyInstance } from 'fastify'
import { Client } from 'ssh2'
import { eq } from 'drizzle-orm'
import { getDb } from '../db.js'
import { serviceConfig } from '../schema.js'

const SSH_TIMEOUT_MS = 10_000
const RESTART_COMMAND = 'sudo systemctl restart coruscant-health'

function sshExec(
  host: string,
  username: string,
  password: string,
  command: string,
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const conn = new Client()
    const timer = setTimeout(() => {
      conn.end()
      resolve({ success: false, message: 'SSH connection timed out' })
    }, SSH_TIMEOUT_MS)

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer)
          conn.end()
          resolve({ success: false, message: err.message })
          return
        }
        let stderr = ''
        stream.on('close', (code: number) => {
          clearTimeout(timer)
          conn.end()
          resolve(
            code === 0
              ? { success: true, message: 'Service restarted successfully' }
              : { success: false, message: stderr || `Exit code: ${code}` },
          )
        })
        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })
      })
    })
      .on('error', (err) => {
        clearTimeout(timer)
        resolve({ success: false, message: `SSH error: ${err.message}` })
      })
      .connect({ host, port: 22, username, password })
  })
}

export async function piHealthRestartRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/pi-health/restart
   * Accepts { password } in body (D-14, D-16).
   * SSH into Pi using stored config (host, username) + provided password.
   * Runs: sudo systemctl restart coruscant-health
   * Password is ephemeral — used once, never stored (D-12, D-14).
   */
  fastify.post<{ Body: { password?: string } }>(
    '/api/pi-health/restart',
    async (request, reply) => {
      const password = (request.body.password ?? '').trim()
      if (!password) {
        return reply.send({ success: false, message: 'Password is required' })
      }

      const db = getDb()
      const row = db
        .select()
        .from(serviceConfig)
        .where(eq(serviceConfig.serviceName, 'piHealth'))
        .get()

      if (!row?.baseUrl) {
        return reply.send({ success: false, message: 'Pi health not configured' })
      }

      // Validate username — alphanumeric, dash, underscore only (prevent shell injection T-12-04)
      const username = row.username || 'admin'
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return reply.send({ success: false, message: 'Invalid SSH username in config' })
      }

      // Extract host from baseUrl (e.g., "http://192.168.86.233:7575" -> "192.168.86.233")
      let host: string
      try {
        const url = new URL(row.baseUrl)
        host = url.hostname
      } catch {
        return reply.send({ success: false, message: 'Invalid Pi health baseUrl in config' })
      }

      const result = await sshExec(host, username, password, RESTART_COMMAND)
      return reply.send(result)
    },
  )
}
