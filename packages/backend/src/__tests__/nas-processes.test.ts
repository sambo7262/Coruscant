import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')

const mockAxios = vi.mocked(axios)

// Mock DSM process list with 7 entries — expect top 5 sorted by CPU descending
const mockProcessResponse = {
  success: true,
  data: {
    processes: [
      { pid: 100, cmd: 'nginx', cpu: 2.1 },
      { pid: 101, cmd: 'ffmpeg', cpu: 45.2 },
      { pid: 102, cmd: 'smbd', cpu: 12.0 },
      { pid: 103, cmd: 'unknown_daemon', cpu: 8.5 },
      { pid: 104, cmd: 'node', cpu: 5.3 },
      { pid: 105, cmd: 'python', cpu: 3.1 },
      { pid: 106, cmd: 'sshd', cpu: 0.1 },
    ],
  },
}

// Helper: mock auth response then process response
function mockAuthThenProcesses(processData: unknown) {
  mockAxios.get = vi.fn()
    .mockImplementationOnce(() => Promise.resolve({
      data: { success: true, data: { sid: 'dsm-test-sid' } },
    }))
    .mockImplementationOnce(() => Promise.resolve({
      data: processData,
    }))
}

describe('NAS processes — fetchNasProcesses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns top 5 processes sorted by CPU descending', async () => {
    mockAuthThenProcesses(mockProcessResponse)

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result).toHaveLength(5)
    // Sorted descending by CPU: ffmpeg(45.2), smbd(12.0), unknown_daemon(8.5), node(5.3), python(3.1)
    expect(result[0].cpuPercent).toBe(45.2)
    expect(result[0].name).toBe('ffmpeg')
    expect(result[1].cpuPercent).toBe(12.0)
    expect(result[1].name).toBe('smbd')
    expect(result[2].cpuPercent).toBe(8.5)
    expect(result[2].name).toBe('unknown_daemon')
    expect(result[3].cpuPercent).toBe(5.3)
    expect(result[3].name).toBe('node')
    expect(result[4].cpuPercent).toBe(3.1)
    expect(result[4].name).toBe('python')
  })

  it('applies label lookup to known processes (exact match)', async () => {
    mockAuthThenProcesses(mockProcessResponse)

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    const ffmpeg = result.find(p => p.name === 'ffmpeg')
    expect(ffmpeg?.label).toBe('Plex transcoding')

    const smbd = result.find(p => p.name === 'smbd')
    expect(smbd?.label).toBe('Network file sharing (SMB)')

    const node = result.find(p => p.name === 'node')
    expect(node?.label).toBe('Node.js application')
  })

  it('returns raw name as label for unknown process', async () => {
    mockAuthThenProcesses(mockProcessResponse)

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    const unknown = result.find(p => p.name === 'unknown_daemon')
    expect(unknown?.label).toBe('unknown_daemon')
  })

  it('applies prefix-match label: "Plex Media Server" starts with "Plex Media" -> Plex media server', async () => {
    mockAxios.get = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        data: { success: true, data: { sid: 'dsm-test-sid' } },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        data: {
          success: true,
          data: {
            processes: [
              { pid: 200, cmd: 'Plex Media Server', cpu: 30.0 },
            ],
          },
        },
      }))

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Plex Media Server')
    expect(result[0].label).toBe('Plex media server')
  })

  it('returns empty array when DSM success=false', async () => {
    mockAuthThenProcesses({ success: false, error: { code: 102 } })

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result).toHaveLength(0)
  })

  it('returns empty array when process list is empty', async () => {
    mockAuthThenProcesses({ success: true, data: { processes: [] } })

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result).toHaveLength(0)
  })

  it('handles cmd field name for process name', async () => {
    mockAxios.get = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        data: { success: true, data: { sid: 'dsm-test-sid' } },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        data: {
          success: true,
          data: {
            processes: [{ pid: 300, cmd: 'dockerd', cpu: 10.0 }],
          },
        },
      }))

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result[0].name).toBe('dockerd')
    expect(result[0].label).toBe('Docker engine')
  })

  it('handles name field name as fallback when cmd is absent', async () => {
    mockAxios.get = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        data: { success: true, data: { sid: 'dsm-test-sid' } },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        data: {
          success: true,
          data: {
            // Using 'name' field (not 'cmd') — alternate DSM field name
            processes: [{ pid: 301, name: 'nginx', cpu: 1.5 }],
          },
        },
      }))

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result[0].name).toBe('nginx')
    expect(result[0].label).toBe('Web server / reverse proxy')
  })

  it('handles cpu_percent field name as fallback when cpu is absent', async () => {
    mockAxios.get = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        data: { success: true, data: { sid: 'dsm-test-sid' } },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        data: {
          success: true,
          data: {
            processes: [
              { pid: 302, cmd: 'rsync', cpu_percent: 22.5 },
              { pid: 303, cmd: 'sshd', cpu_percent: 5.0 },
            ],
          },
        },
      }))

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result[0].name).toBe('rsync')
    expect(result[0].cpuPercent).toBe(22.5)
    expect(result[0].label).toBe('File sync / backup')
  })

  it('filters out entries with empty names', async () => {
    mockAxios.get = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        data: { success: true, data: { sid: 'dsm-test-sid' } },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        data: {
          success: true,
          data: {
            processes: [
              { pid: 400, cmd: '', cpu: 99.9 },      // empty cmd — should be filtered
              { pid: 401, cmd: 'nginx', cpu: 2.0 },  // valid
            ],
          },
        },
      }))

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('nginx')
  })

  it('returns empty array when axios throws (DSM unreachable)', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result).toHaveLength(0)
  })

  it('handles data.data as flat array (alternate DSM response shape)', async () => {
    mockAxios.get = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({
        data: { success: true, data: { sid: 'dsm-test-sid' } },
      }))
      .mockImplementationOnce(() => Promise.resolve({
        data: {
          success: true,
          // data.data is array (not data.data.processes)
          data: [
            { pid: 500, cmd: 'containerd', cpu: 7.7 },
            { pid: 501, cmd: 'postgres', cpu: 3.3 },
          ],
        },
      }))

    const { fetchNasProcesses } = await import('../adapters/nas.js')
    const result = await fetchNasProcesses('http://nas.local:5000', 'admin', 'pass')

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('containerd')
    expect(result[0].label).toBe('Docker container runtime')
    expect(result[1].name).toBe('postgres')
    expect(result[1].label).toBe('Database (PostgreSQL)')
  })
})
