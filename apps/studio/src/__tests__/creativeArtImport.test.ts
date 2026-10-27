import type { CreativeArtRequest, CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportCache, CreativeArtImportEntry } from '../utils/creativeArtImportCache'
import type { IFileSystem } from '../utils/fs'
import { Buffer, Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeAgentProjectRevision, createCreativeTeamRun } from '@advjs/agent'
import { flushPromises, mount } from '@vue/test-utils'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { useCreativeArtImport } from '../composables/useCreativeArtImport'
import { commitCreativeArtImport, inspectCreativeArtImport, reviewCreativeArtImport } from '../utils/creativeArtImport'
import { inspectCreativeImage } from '../utils/creativeImage'

const root = existsSync(resolve('pnpm-workspace.yaml')) ? process.cwd() : resolve('../..')
const realImage = readFileSync(resolve(root, 'demo/starter/public/img/characters/xiaoyun.webp'))
beforeAll(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('File', NodeFile)
  vi.stubGlobal('crypto', webcrypto)
})
afterAll(() => vi.unstubAllGlobals())
async function fixture(request: CreativeArtRequest = { assetId: 'character/xiaoyun/default', kind: 'portrait', characterId: 'xiaoyun', width: 619, height: 619, prompt: '已有小云角色素材回流', constraints: [] }) {
  const files: Record<string, string> = { 'adv.config.json': '{"schemaVersion":1,"root":"adv","format":"adv-md"}', 'adv/characters/xiaoyun.character.md': '---\nid: xiaoyun\nname: 小云\n---\n角色说明。', 'adv/chapters/intro.adv.md': '# 开场 {#start}\n\n@xiaoyun\n你好。' }
  const before = structuredClone(files)
  const blobs = new Map<string, Blob>()
  const unexpected = async (): Promise<never> => {
    throw new Error('Unexpected filesystem operation')
  }
  const fs: IFileSystem = {
    readdir: unexpected,
    stat: unexpected,
    mkdir: unexpected,
    rmdir: unexpected,
    listFiles: unexpected,
    listFilesByExts: unexpected,
    readBlobUrl: unexpected,
    backend: 'memory',
    exists: async path => path in files || blobs.has(path),
    readFile: async path => files[path],
    readBlob: async path => blobs.get(path)!,
    collectAllFiles: async () => Object.entries(files).map(([path, content]) => ({ path, content, lastModified: new Date(0) })),
    writeFile: vi.fn(async (path, content) => { files[path] = content }),
    writeBlob: vi.fn(async (path, blob) => { blobs.set(path, blob) }),
    deleteFile: vi.fn(async (path) => {
      delete files[path]
      blobs.delete(path)
    }),
    flush: vi.fn(async () => {}),
  }
  const revision = await computeAgentProjectRevision(files)
  const run = createCreativeTeamRun({ id: 'art-run', accountId: 'author', now: 0, plan: { protocolVersion: 1, projectId: 'art-project', projectRevision: revision, goal: '导入已有角色图片', limits: { maxTasks: 4, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 0 }, tasks: [{ id: 'art', partner: 'art-director', capability: 'direct-art', dependsOn: [], sourcePaths: Object.keys(files), instruction: '美术方案', expectedOutput: '素材交接' }] } })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'art', status: 'completed', attempt: 1, artifactIds: ['art1'] }]
  run.artifacts = [{ id: 'art1', runId: run.id, taskId: 'art', partner: 'art-director', projectId: run.plan.projectId, kind: 'art-direction', source: { projectId: run.plan.projectId, revision, files: before, upstream: [] }, fingerprint: 'art-fingerprint', summary: '已有图片交接', output: { kind: 'art-direction', summary: '已有图片交接', style: '保持原素材', requests: [request] }, changes: [], reviewCapabilities: [], status: 'selected' }]
  const inspected = await inspectCreativeImage(new Blob([realImage]), async () => ({ width: 619, height: 619 }))
  const entry: CreativeArtImportEntry = { accountId: run.accountId, projectId: run.plan.projectId, runId: run.id, id: 'image1', artifactId: 'art1', artifactFingerprint: 'art-fingerprint', request, fileName: 'xiaoyun.webp', attribution: '仓库现有 demo/starter 小云图片，界面回归输入', license: '', ...inspected, createdAt: 0, state: 'candidate' }
  return { run, entry, files, before, blobs, fs }
}
function current() {}
async function freezeFixtureSource(f: Awaited<ReturnType<typeof fixture>>) {
  f.run.artifacts[0]!.source = { ...f.run.artifacts[0]!.source, files: structuredClone(f.files), revision: await computeAgentProjectRevision(f.files) }
}

describe('creative image candidates and native adoption', () => {
  it('sniffs and hashes real bytes independently of filename MIME and requires the host decoder', async () => {
    const decode = vi.fn(async () => ({ width: 619, height: 619 }))
    const result = await inspectCreativeImage(new Blob([realImage], { type: 'image/png' }), decode)
    expect(result.image).toMatchObject({ mimeType: 'image/webp', bytes: realImage.byteLength, width: 619, height: 619 })
    expect(result.image.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(decode).toHaveBeenCalledOnce()
    await expect(inspectCreativeImage(new Blob(['<svg/>'], { type: 'image/png' }), decode)).rejects.toThrow('CREATIVE_IMAGE_FORMAT')
    await expect(inspectCreativeImage(new Blob([realImage]), async () => ({ width: 0, height: 1 }))).rejects.toThrow('CREATIVE_IMAGE_DIMENSIONS')
    await expect(inspectCreativeImage({ size: 20 * 1024 * 1024 + 1 } as Blob, decode)).rejects.toThrow('CREATIVE_IMAGE_SIZE')
  })

  it('reviews and adopts a portable catalog binding, then conditionally undoes exact source bytes while retaining the original image', async () => {
    const f = await fixture()
    const review = await reviewCreativeArtImport(f.fs, f.run, f.entry, false, current)
    expect(f.files).toEqual(f.before)
    expect(f.blobs.size).toBe(0)
    expect(review.binding).toBe('character:xiaoyun:default')
    const entry = { ...f.entry, review }
    await commitCreativeArtImport(f.fs, entry, current)
    expect(await inspectCreativeArtImport(f.fs, entry, current)).toBe('after')
    const fragment = JSON.parse(f.files['adv/assets/other.json'])
    expect(fragment.assets[0]).toMatchObject({ id: f.entry.request.assetId, characterId: 'xiaoyun', expression: 'default', type: 'image', sha256: f.entry.image.sha256, source: { type: 'manual-import' } })
    expect(Buffer.from(await f.blobs.get(review.mediaPath)!.arrayBuffer())).toEqual(realImage)
    await commitCreativeArtImport(f.fs, entry, current, true)
    expect(f.files).toEqual(f.before)
    expect(await inspectCreativeArtImport(f.fs, entry, current)).toBe('before')
    expect(f.blobs.size).toBe(1)
  })

  it('preserves scene body and unknown frontmatter, and keeps an existing local root and remote profile intact', async () => {
    const f = await fixture({ assetId: 'background/station', kind: 'background', sceneId: 'station', locationId: 'station-location', width: 1920, height: 1080, prompt: '已有场景图回流', constraints: [] })
    f.files['adv/scenes/station.md'] = '---\nid: station\nname: 车站\ncustom: 42\nsrc: old.webp\n---\n原始说明。\n'
    f.files['adv/assets.json'] = JSON.stringify({ schemaVersion: 2, id: 'art-project', defaultProfile: 'production', profiles: { local: { provider: 'project', root: 'art.media/v1' }, production: { provider: 'http', baseUrl: 'https://example.test/media/' } }, assets: [] })
    await freezeFixtureSource(f)
    const review = await reviewCreativeArtImport(f.fs, f.run, f.entry, false, current)
    expect(review.mediaPath).toMatch(/^art.media\/v1\/images\/creative\/[a-f0-9]{64}\.webp$/)
    const scene = review.changes.find(item => item.path === 'adv/scenes/station.md')!.content!
    expect(scene).toContain('custom: 42')
    expect(scene).toContain('assetId: background/station')
    expect(scene).not.toContain('src:')
    expect(scene.endsWith('原始说明。\n')).toBe(true)
    const catalog = JSON.parse(review.changes.find(item => item.path === 'adv/assets.json')!.content!)
    expect(catalog.defaultProfile).toBe('production')
    expect(catalog.profiles.production.baseUrl).toBe('https://example.test/media/')
  })

  it('rejects stale source, wrong proposal versions, target ID replacement and overlapping character bindings before writing', async () => {
    const f = await fixture()
    await expect(reviewCreativeArtImport(f.fs, f.run, { ...f.entry, artifactFingerprint: 'other' }, false, current)).rejects.toThrow('PROPOSAL_CHANGED')
    const review = await reviewCreativeArtImport(f.fs, f.run, f.entry, false, current)
    f.files['adv/chapters/intro.adv.md'] += '\n作者修改。'
    await expect(commitCreativeArtImport(f.fs, { ...f.entry, review }, current)).rejects.toThrow('SOURCE_CHANGED')
    expect(f.blobs.size).toBe(0)
    f.files['adv/chapters/intro.adv.md'] = f.before['adv/chapters/intro.adv.md']
    const old = { id: f.entry.request.assetId, kind: 'character', type: 'image', characterId: 'xiaoyun', expression: 'default', path: 'old.webp', sha256: 'a'.repeat(64) }
    f.files['adv/assets.json'] = JSON.stringify({ schemaVersion: 2, id: 'art-project', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [old] })
    await expect(reviewCreativeArtImport(f.fs, f.run, f.entry, false, current)).rejects.toThrow('SOURCE_CHANGED')
    // The replacement/binding cases below start with directions frozen after that catalog existed.
    await freezeFixtureSource(f)
    await expect(reviewCreativeArtImport(f.fs, f.run, f.entry, false, current)).rejects.toThrow('asset id already exists')
    await expect(reviewCreativeArtImport(f.fs, f.run, f.entry, true, current)).resolves.toMatchObject({ binding: 'character:xiaoyun:default' })
    old.id = 'other/portrait'
    f.files['adv/assets.json'] = JSON.stringify({ schemaVersion: 2, id: 'art-project', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [old] })
    await freezeFixtureSource(f)
    await expect(reviewCreativeArtImport(f.fs, f.run, f.entry, true, current)).rejects.toThrow('BINDING_CONFLICT')
  })

  it('rolls back binary writes that persist before throwing and source writes that fail at the durable barrier', async () => {
    const f = await fixture()
    const review = await reviewCreativeArtImport(f.fs, f.run, f.entry, false, current)
    vi.mocked(f.fs.writeBlob).mockImplementationOnce(async (path, blob) => {
      f.blobs.set(path, blob)
      throw new Error('binary write persisted then failed')
    })
    await expect(commitCreativeArtImport(f.fs, { ...f.entry, review }, current)).rejects.toThrow('persisted then failed')
    expect(f.files).toEqual(f.before)
    expect(f.blobs.size).toBe(0)
    const deletions = vi.mocked(f.fs.deleteFile).mock.calls.length
    vi.mocked(f.fs.writeBlob).mockRejectedValueOnce(new Error('binary failed before persistence'))
    await expect(commitCreativeArtImport(f.fs, { ...f.entry, review }, current)).rejects.toThrow('binary failed before persistence')
    expect(vi.mocked(f.fs.deleteFile).mock.calls).toHaveLength(deletions)
    expect(f.files).toEqual(f.before)
    vi.mocked(f.fs.flush!).mockRejectedValueOnce(new Error('durability failure'))
    await expect(commitCreativeArtImport(f.fs, { ...f.entry, review }, current)).rejects.toThrow('durability failure')
    expect(f.files).toEqual(f.before)
    expect(f.blobs.size).toBe(0)
  })

  it('keeps an author edit after adoption instead of overwriting it during undo', async () => {
    const f = await fixture()
    const review = await reviewCreativeArtImport(f.fs, f.run, f.entry, false, current)
    const entry = { ...f.entry, review }
    await commitCreativeArtImport(f.fs, entry, current)
    f.files['adv/chapters/intro.adv.md'] += '\n作者的新台词。'
    const edited = structuredClone(f.files)
    await expect(commitCreativeArtImport(f.fs, entry, current, true)).rejects.toThrow('SOURCE_CHANGED')
    expect(f.files).toEqual(edited)
    expect(await inspectCreativeArtImport(f.fs, entry, current)).toBe('conflict')
    expect(f.blobs.size).toBe(1)
  })

  it('retains and rejects a corrupt existing content-addressed file without overwriting it', async () => {
    const f = await fixture()
    const review = await reviewCreativeArtImport(f.fs, f.run, f.entry, false, current)
    const authorFile = new Blob(['author bytes'])
    f.blobs.set(review.mediaPath, authorFile)
    await expect(commitCreativeArtImport(f.fs, { ...f.entry, review }, current)).rejects.toThrow()
    expect(f.files).toEqual(f.before)
    expect(f.blobs.get(review.mediaPath)).toBe(authorFile)
  })
})

describe('private image import journal recovery', () => {
  async function sessionFixture(inspectImage?: typeof inspectCreativeImage) {
    const f = await fixture()
    const run = shallowRef<CreativeTeamRun>(f.run)
    const saved = new Map<string, CreativeArtImportEntry>([[f.entry.id, f.entry]])
    const cache: CreativeArtImportCache = { list: vi.fn(async scope => [...saved.values()].filter(item => item.accountId === scope.accountId && item.projectId === scope.projectId && item.runId === scope.runId).map(item => structuredClone(item))), save: vi.fn(async (entry) => {
      saved.set(entry.id, structuredClone(entry))
    }), discard: vi.fn(async (entry) => {
      saved.delete(entry.id)
    }) }
    let session!: ReturnType<typeof useCreativeArtImport>
    const changed = vi.fn()
    const open = () => mount(defineComponent({ setup() {
      session = useCreativeArtImport({ run: () => run.value, host: async () => ({ fs: f.fs, assertCurrent: current }), cache, changed, inspectImage })
      return () => h('div')
    } }))
    return { ...f, run, saved, cache, open, session: () => session, changed }
  }
  it('reopens an uncertain post-write record through reads and acknowledges it without another project write', async () => {
    const f = await sessionFixture()
    const first = f.open()
    await flushPromises()
    await f.session().review('image1', false)
    vi.mocked(f.cache.save).mockImplementationOnce(async (entry) => {
      f.saved.set(entry.id, structuredClone(entry))
    }).mockRejectedValueOnce(new Error('receipt write failed'))
    await f.session().adopt('image1')
    expect(f.session().error.value).toBe('write')
    expect(f.saved.get('image1')!.state).toBe('adopting')
    expect(f.blobs.size).toBe(1)
    first.unmount()
    const writes = vi.mocked(f.fs.writeFile).mock.calls.length
    const reopened = f.open()
    await flushPromises()
    await vi.waitFor(() => expect(f.session().inspections.value.image1).toBe('after'))
    expect(vi.mocked(f.fs.writeFile).mock.calls).toHaveLength(writes)
    await f.session().reconcile('image1')
    expect(f.saved.get('image1')).toMatchObject({ state: 'adopted', data: undefined })
    expect(vi.mocked(f.fs.writeFile).mock.calls).toHaveLength(writes)
    expect(f.fs.writeBlob).toHaveBeenCalledOnce()
    reopened.unmount()
  })
  it('drops a decoded candidate that returns after changing the account and run', async () => {
    let finish!: (value: Awaited<ReturnType<typeof inspectCreativeImage>>) => void
    const inspectImage = vi.fn(() => new Promise<Awaited<ReturnType<typeof inspectCreativeImage>>>(resolve => finish = resolve))
    const f = await sessionFixture(inspectImage)
    const wrapper = f.open()
    await flushPromises()
    const pending = f.session().stage({ artifactId: f.entry.artifactId, assetId: f.entry.request.assetId, file: new File([realImage], 'image.webp'), attribution: '现有图片', license: '' })
    await flushPromises()
    f.run.value = { ...f.run.value, accountId: 'another-author', id: 'another-run' }
    await flushPromises()
    finish({ image: f.entry.image, data: f.entry.data! })
    await pending
    expect(f.session().rows.value).toEqual([])
    expect(f.cache.save).not.toHaveBeenCalled()
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    expect(f.fs.writeFile).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not start a project write if persisting the adoption intent fails', async () => {
    const f = await sessionFixture()
    const wrapper = f.open()
    await flushPromises()
    await f.session().review('image1', false)
    vi.mocked(f.cache.save).mockRejectedValueOnce(new Error('storage failed'))
    await f.session().adopt('image1')
    expect(f.files).toEqual(f.before)
    expect(f.fs.writeFile).not.toHaveBeenCalled()
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
