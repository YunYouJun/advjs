import type { IFileSystem } from '../utils/fs'
import { describe, expect, it, vi } from 'vitest'
import { initializeStudioAudioCatalog } from '../utils/projectAudio'

function filesystem(config: Record<string, unknown> = {}) {
  const files = new Map<string, string>([['adv.config.json', JSON.stringify({ id: 'test', ...config })]])
  const writes = vi.fn(async (path: string, content: string) => {
    files.set(path, content)
  })
  const fs = { backend: 'memory', exists: async (path: string) => files.has(path), readFile: async (path: string) => files.get(path)!, collectAllFiles: async () => [...files].map(([path, content]) => ({ path, content, lastModified: new Date() })), writeFile: writes, deleteFile: async (path: string) => {
    files.delete(path)
  }, flush: vi.fn(async () => {}) } as unknown as IFileSystem
  return { fs, files, writes }
}

describe('explicit native audio catalog initialization', () => {
  it('does not resolve initialization before the durable barrier completes', async () => {
    const f = filesystem()
    let release!: () => void
    const gate = new Promise<void>(resolve => release = resolve)
    vi.mocked(f.fs.flush!).mockReturnValueOnce(gate)
    let done = false
    const pending = initializeStudioAudioCatalog(f.fs, 'durable').then(() => {
      done = true
    })
    await vi.waitFor(() => expect(f.fs.flush).toHaveBeenCalledOnce())
    expect(done).toBe(false)
    release()
    await pending
    expect(done).toBe(true)
  })

  it('compensates a failed durable barrier without reporting a created catalog', async () => {
    const f = filesystem()
    const before = new Map(f.files)
    vi.mocked(f.fs.flush!).mockRejectedValueOnce(new Error('Catalog persistence failed'))
    await expect(initializeStudioAudioCatalog(f.fs, 'failed')).rejects.toThrow('Catalog persistence failed')
    expect(f.files).toEqual(before)
    expect(f.fs.flush).toHaveBeenCalledTimes(2)
  })
  it('establishes a canonical manifest for a QuickStart world and rolls back catalog creation if manifest commit fails', async () => {
    const first = filesystem()
    first.files.delete('adv.config.json')
    const deletion = vi.fn(async (path: string) => {
      first.files.delete(path)
    })
    first.fs.deleteFile = deletion
    await initializeStudioAudioCatalog(first.fs, 'quick-start-native')
    expect(JSON.parse(first.files.get('adv.config.json')!)).toEqual({ schemaVersion: 1, id: 'quick-start-native', root: 'adv', format: 'adv-md' })
    expect(first.files.has('adv/assets.json')).toBe(true)
    const second = filesystem()
    second.files.delete('adv.config.json')
    second.fs.deleteFile = async (path: string) => {
      second.files.delete(path)
    }
    second.fs.writeFile = async (path: string, content: string) => {
      if (path === 'adv.config.json')
        throw new Error('Manifest commit failed')
      second.files.set(path, content)
    }
    await expect(initializeStudioAudioCatalog(second.fs, 'failed-native')).rejects.toThrow('Manifest commit failed')
    expect(second.files.has('adv/assets.json')).toBe(false)
  })

  it('serializes simultaneous first-use actions and preserves the first catalog identity', async () => {
    const { fs, files, writes } = filesystem()
    const results = await Promise.allSettled([initializeStudioAudioCatalog(fs, 'first'), initializeStudioAudioCatalog(fs, 'second')])
    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(writes).toHaveBeenCalledOnce()
    expect(JSON.parse(files.get('adv/assets.json')!)).toMatchObject({ id: 'first', includes: [], profiles: { local: { provider: 'project', root: 'adv/assets' } } })
  })

  it('rejects other content roots before writing an incorrect adv catalog', async () => {
    const { fs, files, writes } = filesystem({ root: 'story' })
    await expect(initializeStudioAudioCatalog(fs, 'project')).rejects.toThrow('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')
    expect(writes).not.toHaveBeenCalled()
    expect(files.has('adv/assets.json')).toBe(false)
  })
})
