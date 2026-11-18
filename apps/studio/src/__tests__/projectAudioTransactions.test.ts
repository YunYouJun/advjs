import type { AdvAssetEntry } from '@advjs/types'
import type { IFileSystem } from '../utils/fs'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { audioProjectMediaPath } from '@advjs/audio'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import captured from '../../../../packages/agent/test/fixtures/creative-playtest-voice-author-host.json'
import { useAudioAuthoring } from '../composables/useAudioAuthoring'
import { createStudioAudioService, runStudioProjectWrite } from '../utils/projectAudio'

let currentFs: IFileSystem | undefined
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => ({ getFs: () => currentFs }) }))
beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('Blob', NodeBlob)
})
afterAll(() => vi.unstubAllGlobals())

async function fixture() {
  const files: Record<string, string> = { ...captured.project.files }
  // Explicit byte-availability fixture only; these unit bytes are not decoded speech.
  const blob = new Blob(['Unit audio transaction bytes'])
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), value => value.toString(16).padStart(2, '0')).join('')
  const fragment = JSON.parse(files['adv/assets/audio.json']!)
  const old = fragment.assets[0]
  Object.assign(old, { sha256, bytes: blob.size })
  files['adv/assets/audio.json'] = JSON.stringify(fragment)
  const ledger = JSON.parse(files['adv/audio/voice-ledger.json']!)
  const lineId = Object.keys(ledger.lines)[0]!
  const binding = ledger.lines[lineId].locales['zh-CN']
  binding.takes[0].sha256 = sha256
  binding.selectedTake = null
  files['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
  const source = audioProjectMediaPath(JSON.parse(files['adv/assets.json']!), old)
  const blobs = new Map<string, Blob>([[source, blob]])
  const fs = {
    backend: 'browser',
    exists: async (path: string) => Object.hasOwn(files, path) || blobs.has(path),
    readFile: async (path: string) => files[path]!,
    readBlob: async (path: string) => {
      if (!blobs.has(path))
        throw new Error('Missing media')
      return blobs.get(path)!
    },
    collectAllFiles: async () => Object.entries(files).map(([path, content]) => ({ path, content, lastModified: new Date(0) })),
    writeFile: vi.fn(async (path: string, value: string) => { files[path] = value }),
    writeBlob: vi.fn(async (path: string, value: Blob) => { blobs.set(path, value) }),
    deleteFile: vi.fn(async (path: string) => {
      delete files[path]
      blobs.delete(path)
    }),
    flush: vi.fn(async () => {}),
  } as unknown as IFileSystem
  const asset: AdvAssetEntry = { id: 'audio_01900400-0000-7000-8000-000000000098', kind: 'reference', type: 'audio', path: 'author-imports/参考 台词.wav', sha256, bytes: blob.size, mimeType: 'audio/wav', duration: 1 }
  const target = audioProjectMediaPath(JSON.parse(files['adv/assets.json']!), asset)
  const service = createStudioAudioService(fs)
  async function input() {
    return { expectedRevision: (await service.readProjectAudio()).revision, asset, source: { path: source, sha256, bytes: blob.size } }
  }
  return { fs, files, blobs, blob, source, target, asset, service, input }
}

describe('shared Studio audio project transactions', () => {
  it('waits for a queued project write before reading an audio snapshot', async () => {
    const f = await fixture()
    const collect = vi.spyOn(f.fs, 'collectAllFiles')
    let release!: () => void
    let entered!: () => void
    const gate = new Promise<void>(resolve => release = resolve)
    const started = new Promise<void>(resolve => entered = resolve)
    const writing = runStudioProjectWrite(f.fs, async () => {
      entered()
      await gate
      f.files['adv/world.md'] = 'Queued author save'
    })
    await started
    const reading = f.service.read()
    try {
      await Promise.resolve()
      expect(collect).not.toHaveBeenCalled()
    }
    finally {
      release()
      await writing
      await reading
    }
    expect(collect).toHaveBeenCalled()
  })

  it('copies verified bytes to a canonical Unicode media path without changing the source', async () => {
    const f = await fixture()
    const result = await f.service.importAsset(await f.input())
    expect(result.catalog.assets.find(item => item.id === f.asset.id)?.path).toBe(f.asset.path)
    expect(await f.blobs.get(f.target)?.text()).toBe(await f.blob.text())
    expect(f.blobs.get(f.source)).toBe(f.blob)
  })

  it('preserves an external source and copied media when a later catalog write fails', async () => {
    const f = await fixture()
    const before = { ...f.files }
    vi.mocked(f.fs.writeFile).mockImplementation(async (path, value) => {
      f.files[path] = value
      if (path === 'adv/assets/audio.json' && value.includes(f.asset.id)) {
        f.files['adv/world.md'] = `Author references ${f.target}`
        throw new Error('Catalog write persisted then failed')
      }
    })
    await expect(f.service.importAsset(await f.input())).rejects.toMatchObject({ message: 'ADV_STUDIO_ROLLBACK_INCOMPLETE', cause: { message: 'Catalog write persisted then failed' } })
    expect(f.files).toEqual({ ...before, 'adv/world.md': `Author references ${f.target}` })
    expect(f.blobs.has(f.target)).toBe(true)
  })

  it('rejects copying over an existing immutable master even when its bytes match', async () => {
    const f = await fixture()
    f.blobs.set(f.target, f.blob)
    const before = { ...f.files }
    await expect(f.service.importAsset(await f.input())).rejects.toThrow('VOICE_AUDIO_EXISTS')
    expect(f.files).toEqual(before)
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
  })

  it('registers existing verified media without copying or overwriting it', async () => {
    const f = await fixture()
    f.blobs.set(f.target, f.blob)
    const review = await f.input()
    const result = await f.service.registerAsset({ asset: f.asset, expectedRevision: review.expectedRevision })
    expect(result.catalog.assets.some(item => item.id === f.asset.id)).toBe(true)
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
  })

  it('keeps more than 100 read-only source guards while limiting actual mixer writes', async () => {
    const f = await fixture()
    for (let index = 0; index < 101; index++)
      f.files[`adv/chapters/extra${index}.chapter.json`] = JSON.stringify({ schemaVersion: 1, id: `extra${index}`, nodes: [{ id: 'end', type: 'end' }] })
    const revision = (await f.service.readProjectAudio()).revision
    await f.service.saveMixer({ expectedRevision: revision, mixer: { schemaVersion: 1 } })
    expect(f.fs.writeFile).toHaveBeenCalledOnce()
    expect(vi.mocked(f.fs.writeFile).mock.calls[0]?.[0]).toBe('adv/audio/mixer.json')
  })

  it.each(['read', 'initialize'] as const)('discards a late %s after the active filesystem changes', async (operation) => {
    const f = await fixture()
    currentFs = f.fs
    let release!: () => void
    const gate = new Promise<void>(resolve => release = resolve)
    const collect = f.fs.collectAllFiles
    f.fs.collectAllFiles = async () => {
      await gate
      return collect()
    }
    const author = useAudioAuthoring()
    const read = operation === 'read' ? author.read() : author.initialize('late-project')
    currentFs = { ...f.fs }
    release()
    await expect(read).rejects.toThrow('ADV_AUDIO_PROJECT_CHANGED')
    expect(f.fs.writeFile).not.toHaveBeenCalled()
    currentFs = undefined
  })
})
