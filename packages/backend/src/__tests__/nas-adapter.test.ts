import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')

const mockAxios = vi.mocked(axios)

describe('NAS adapter', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('pollNas', () => {
    it('authenticates via SYNO.API.Auth and returns NasStatus with cpu/ram/network/volumes', async () => {
      // Auth GET
      mockAxios.get = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({
          // SYNO.API.Auth login
          status: 200,
          data: { success: true, data: { sid: 'dsm-sid-001' } },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          // SYNO.Core.System.Utilization
          status: 200,
          data: {
            success: true,
            data: {
              cpu: { user_load: 15, system_load: 5, other_load: 2 },
              memory: { real_usage: 65 },
              network: [{ device: 'eth0', rx: 1_250_000, tx: 625_000 }],
            },
          },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          // SYNO.Core.System info type=storage
          status: 200,
          data: {
            success: true,
            data: {
              temperature: 38,
              hdd_info: [
                { id: 'disk1', name: 'Disk 1 (SATA 1)', temp: 35 },
                { id: 'disk2', name: 'Disk 2 (SATA 2)', temp: 37 },
              ],
              vol_info: [
                { name: 'volume1', used_size: '500000000000', total_size: '1000000000000' },
              ],
            },
          },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          // SYNO.Core.Hardware.FanSpeed
          status: 200,
          data: {
            success: true,
            data: { fan_speed: [{ id: 'fan1', rpm: 1200 }, { id: 'fan2', rpm: 1100 }] },
          },
        }))

      const { pollNas } = await import('../adapters/nas.js')
      const result = await pollNas('http://nas.local:5000', 'admin', 'password')

      expect(result.cpu).toBe(22) // 15 + 5 + 2
      expect(result.ram).toBe(65)
      expect(result.networkMbpsUp).toBeCloseTo(5, 0) // 625000 * 8 / 1_000_000
      expect(result.networkMbpsDown).toBeCloseTo(10, 0) // 1250000 * 8 / 1_000_000
      expect(result.volumes).toHaveLength(1)
      expect(result.volumes[0].name).toBe('volume1')
      expect(result.volumes[0].usedPercent).toBe(50)
    })

    it('includes disks with tempC from SYNO.Core.System info type=storage', async () => {
      mockAxios.get = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({
          data: { success: true, data: { sid: 'dsm-sid-002' } },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: {
            success: true,
            data: {
              cpu: { user_load: 10, system_load: 3, other_load: 0 },
              memory: { real_usage: 40 },
              network: [{ device: 'eth0', rx: 500_000, tx: 250_000 }],
            },
          },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: {
            success: true,
            data: {
              temperature: 40,
              hdd_info: [
                { id: 'disk1', name: 'WD Red 4TB', temp: 38 },
                { id: 'disk2', name: 'WD Red 4TB', temp: 41 },
              ],
              vol_info: [
                { name: 'volume1', used_size: '200000000000', total_size: '4000000000000' },
              ],
            },
          },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: { success: true, data: { fan_speed: [] } },
        }))

      const { pollNas } = await import('../adapters/nas.js')
      const result = await pollNas('http://nas.local:5000', 'admin', 'pass')

      expect(result.disks).toBeDefined()
      expect(result.disks).toHaveLength(2)
      expect(result.disks![0].tempC).toBe(38)
      expect(result.disks![1].tempC).toBe(41)
      expect(result.cpuTempC).toBe(40)
    })

    it('omits fans field (undefined, not []) when FanSpeed returns empty or fails', async () => {
      mockAxios.get = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({
          data: { success: true, data: { sid: 'dsm-sid-003' } },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: {
            success: true,
            data: {
              cpu: { user_load: 5, system_load: 2, other_load: 0 },
              memory: { real_usage: 30 },
              network: [{ device: 'eth0', rx: 100_000, tx: 50_000 }],
            },
          },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: {
            success: true,
            data: {
              temperature: 35,
              hdd_info: [],
              vol_info: [],
            },
          },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          // Fan speed returns empty array — should result in undefined fans, not []
          data: { success: true, data: { fan_speed: [] } },
        }))

      const { pollNas } = await import('../adapters/nas.js')
      const result = await pollNas('http://nas.local:5000', 'admin', 'pass')

      expect(result.fans).toBeUndefined() // NOT an empty array (per D-19)
    })

    it('re-authenticates on DSM error code 119 (invalid session) and retries', async () => {
      // Simulate: auth succeeds, then first parallel data call gets 119, triggers re-auth, retry succeeds
      let getCallIndex = 0
      mockAxios.get = vi.fn().mockImplementation(() => {
        const idx = getCallIndex++

        // Call 0: initial auth
        if (idx === 0) {
          return Promise.resolve({ data: { success: true, data: { sid: 'dsm-sid-001' } } })
        }
        // Calls 1-3: the 3 parallel data calls — first one returns 119 (simulates session expiry)
        if (idx === 1) {
          return Promise.resolve({ data: { success: false, error: { code: 119 } } })
        }
        if (idx === 2 || idx === 3) {
          return Promise.resolve({
            data: {
              success: true,
              data: { temperature: 36, hdd_info: [], vol_info: [] },
            },
          })
        }
        // Call 4: re-auth after invalidation
        if (idx === 4) {
          return Promise.resolve({ data: { success: true, data: { sid: 'dsm-sid-002' } } })
        }
        // Calls 5-7: retry data calls succeed
        if (idx === 5) {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                cpu: { user_load: 8, system_load: 2, other_load: 0 },
                memory: { real_usage: 45 },
                network: [{ device: 'eth0', rx: 200_000, tx: 100_000 }],
              },
            },
          })
        }
        if (idx === 6) {
          return Promise.resolve({
            data: {
              success: true,
              data: { temperature: 36, hdd_info: [], vol_info: [] },
            },
          })
        }
        // Fan speed
        return Promise.resolve({ data: { success: true, data: { fan_speed: [] } } })
      })

      const { pollNas } = await import('../adapters/nas.js')
      const result = await pollNas('http://nas.local:5000', 'admin', 'pass')

      // Should have been called at least 5 times (auth + 3 data + re-auth)
      expect(getCallIndex).toBeGreaterThanOrEqual(5)
      expect(result.cpu).toBeGreaterThanOrEqual(0)
    })
  })

  describe('checkNasImageUpdates', () => {
    it('returns boolean from SYNO.Docker.Image list', async () => {
      mockAxios.get = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({
          data: { success: true, data: { sid: 'dsm-sid-img' } },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: {
            success: true,
            data: {
              images: [
                { name: 'coruscant:latest', is_update_available: false },
                { name: 'nginx:latest', is_update_available: true },
              ],
            },
          },
        }))

      const { checkNasImageUpdates } = await import('../adapters/nas.js')
      const result = await checkNasImageUpdates('http://nas.local:5000', 'admin', 'pass')

      expect(result).toBe(true) // nginx has update available
    })

    it('detects update via canUpgrade field (ContainerManager namespace)', async () => {
      mockAxios.get = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({
          data: { success: true, data: { sid: 'dsm-sid-img2' } },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: {
            success: true,
            data: {
              images: [
                { name: 'coruscant:latest', canUpgrade: true },
              ],
            },
          },
        }))

      const { checkNasImageUpdates } = await import('../adapters/nas.js')
      const result = await checkNasImageUpdates('http://nas.local:5000', 'admin', 'pass')

      expect(result).toBe(true)
    })
  })

  describe('fetchNasDockerStats', () => {
    it('aggregates cpu and ram across running containers', async () => {
      mockAxios.get = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({
          data: { success: true, data: { sid: 'dsm-sid-docker' } },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: {
            success: true,
            data: {
              containers: [
                { status: 'running', cpu_usage: 12.5, memory_usage: 512_000_000, memory_limit: 2_000_000_000, up_bytes: 0, down_bytes: 0 },
                { status: 'running', cpu_usage: 7.0, memory_usage: 256_000_000, memory_limit: 2_000_000_000, up_bytes: 0, down_bytes: 0 },
                { status: 'stopped', cpu_usage: 0, memory_usage: 0, memory_limit: 0, up_bytes: 0, down_bytes: 0 },
              ],
            },
          },
        }))

      const { fetchNasDockerStats } = await import('../adapters/nas.js')
      const result = await fetchNasDockerStats('http://nas.local:5000', 'admin', 'pass')

      expect(result).toBeDefined()
      expect(result!.cpuPercent).toBe(19.5) // 12.5 + 7.0
      // RAM: (512M + 256M) / (2G + 2G) * 100 = 768M / 4G * 100 = 19.2%
      expect(result!.ramPercent).toBeCloseTo(19.2, 0)
    })

    it('returns undefined when Docker API fails', async () => {
      mockAxios.get = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({
          data: { success: true, data: { sid: 'dsm-sid-docker2' } },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: { success: false, error: { code: 103 } },
        }))
        .mockImplementationOnce(() => Promise.resolve({
          data: { success: false, error: { code: 103 } },
        }))

      const { fetchNasDockerStats } = await import('../adapters/nas.js')
      const result = await fetchNasDockerStats('http://nas.local:5000', 'admin', 'pass')

      expect(result).toBeUndefined()
    })
  })
})
