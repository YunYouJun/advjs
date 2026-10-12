// @vitest-environment node
import type { AdvAssetEntry, AdvAssetManifest, AdvMusicMetadata } from '@advjs/types'
import type { AudioProjectFilePort } from '../../../packages/audio/src/project-files'
import { describe, expect, it } from 'vitest'
import { createAdvAssetCatalog, normalizeAdvAssetManifest } from '../../../packages/assets/src/catalog'
import { createAudioId } from '../../../packages/audio/src/ids'
import { createMusicMetadata, exportMusicBrief, inspectMusicReview, musicPlaybackDefaults, parseMusicMetadata } from '../../../packages/audio/src/music'
import { createProjectAudioService } from '../../../packages/audio/src/project-files'
import { projectRuntimeAudioAsset } from '../../../packages/audio/src/runtime-projection'

const master = new TextEncoder().encode('unit fixture: immutable imported music').buffer
const sha = async (bytes: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('')

function metadata(usage: AdvMusicMetadata['usage'] = 'background') {
  return createMusicMetadata({ usage, source: { type: 'external-ai', tool: 'Suno', url: 'https://suno.com/song/author-owned-example' }, brief: { summary: 'Original instrumental night scene', mood: 'quiet', durationSeconds: 30, loopIntent: true }, rights: { license: 'project-owned', credit: 'Project composer', permissionNote: 'Author reviewed the source terms' } })
}

async function fixture(split = false) {
  const digest = await sha(master)
  const manifest: AdvAssetManifest = { schemaVersion: 2, id: 'music-project', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] }
  const files: Record<string, string> = {
    'adv/assets.json': JSON.stringify(split ? { ...manifest, assets: undefined, includes: ['assets/audio.json'], authorNote: 'Preserve this' } : { ...manifest, authorNote: 'Preserve this' }),
  }
  if (split)
    files['adv/assets/audio.json'] = JSON.stringify({ schemaVersion: 2, assets: [], authorNote: 'Preserve fragment' })
  const media = new Map<string, ArrayBuffer>([['adv/audio/staging/music.wav', master.slice(0)]])
  let beforeCommit: (() => void) | undefined
  let afterRead: (() => void) | undefined
  const catalog = () => {
    const root = JSON.parse(files['adv/assets.json']!)
    return normalizeAdvAssetManifest({ ...root, assets: root.includes ? root.includes.flatMap((path: string) => JSON.parse(files[`adv/${path}`]!).assets) : root.assets }, { allowEmpty: true })
  }
  const port: AudioProjectFilePort = {
    async read() { return { files: { ...files }, catalog: catalog() } },
    async readMedia(path) {
      const bytes = media.get(path)?.slice(0)
      if (!bytes)
        throw new Error('unit media missing')
      afterRead?.()
      afterRead = undefined
      return bytes
    },
    async commit(changes, imports) {
      beforeCommit?.()
      beforeCommit = undefined
      for (const change of changes) {
        if ((files[change.path] ?? null) !== change.expected)
          throw new Error('AUDIO_CONFLICT')
      }
      for (const item of imports) {
        const bytes = media.get(item.candidate.path)
        if (!bytes || bytes.byteLength !== item.candidate.bytes || await sha(bytes) !== item.candidate.sha256)
          throw new Error('AUDIO_MEDIA_CHANGED')
        if (item.operation !== 'verify')
          media.set(`public/media/${item.asset.path}`, bytes.slice(0))
      }
      for (const change of changes) {
        if (change.content === change.expected)
          continue
        if (change.content === null)
          delete files[change.path]
        else
          files[change.path] = change.content
      }
    },
  }
  const service = createProjectAudioService(port)
  const id = createAudioId('audio')
  const asset: AdvAssetEntry = { id, type: 'audio', kind: 'bgm', path: `music/${id}.wav`, sha256: digest, bytes: master.byteLength, mimeType: 'audio/wav', license: 'project-owned', music: metadata() }
  const importAsset = async (entry = asset) => service.importAsset({ expectedRevision: (await service.readProjectAudio()).revision, asset: entry, source: { path: 'adv/audio/staging/music.wav', sha256: digest, bytes: master.byteLength } })
  const review = async (status: 'approved' | 'rejected' = 'approved') => service.reviewMusicAsset({ expectedRevision: (await service.readProjectAudio()).revision, assetId: id, expectedSha256: digest, status })
  return {
    files,
    media,
    asset,
    digest,
    service,
    catalog,
    importAsset,
    review,
    setBeforeCommit(action: () => void) { beforeCommit = action },
    setAfterRead(action: () => void) { afterRead = action },
  }
}

describe('shared music authoring on the existing native catalog', () => {
  it('keeps AI source pages separate from runtime transport and round-trips author metadata', async () => {
    const project = await fixture()
    await project.importAsset()
    const catalog = createAdvAssetCatalog(project.catalog())
    expect(catalog.get(project.asset.id)?.music).toEqual(project.asset.music)
    expect((await catalog.resolve(project.asset.id)).src).toBe(`public/media/${project.asset.path}`)
    expect(project.asset.music!.source.url).not.toBe((await catalog.resolve(project.asset.id)).src)
    expect(exportMusicBrief(project.asset.music!)).toContain('Source page (not playback URL): https://suno.com/song/')
    expect(exportMusicBrief(project.asset.music!)).toContain('durationSeconds: 30')
    const runtime = projectRuntimeAudioAsset(catalog.get(project.asset.id)!)
    expect(runtime.kind).toBe('bgm')
    expect(runtime).not.toHaveProperty('music')
    expect(JSON.stringify(runtime)).not.toMatch(/suno|Original instrumental|permissionNote/u)
  })

  it.each(['https://user:password@suno.com/song/id', 'https://suno.com/song/id?token=private', 'https://suno.com/song/id#private', 'javascript:alert(1)', 'file:///private/song.wav'])('rejects unsafe source evidence %s', (url) => {
    expect(() => createMusicMetadata({ usage: 'theme', source: { type: 'external-ai', url } })).toThrow('MUSIC_METADATA_INVALID')
  })

  it('rejects credentials and invented music fields without leaking their values in errors', () => {
    expect(() => parseMusicMetadata({ ...metadata(), apiKey: 'private-test-value' })).toThrow('MUSIC_METADATA_INVALID')
    expect(() => parseMusicMetadata({ ...metadata(), source: { type: 'external-ai', token: 'private-test-value' } })).toThrow('MUSIC_METADATA_INVALID')
    expect(() => parseMusicMetadata({ ...metadata(), brief: { summary: 'Target', durationSeconds: Number.NaN } })).toThrow('MUSIC_METADATA_INVALID')
    expect(() => normalizeAdvAssetManifest({ schemaVersion: 2, id: 'bad', defaultProfile: 'local', profiles: { local: { provider: 'project' } }, assets: [{ id: 'sfx/example', type: 'audio', kind: 'sfx', path: 'sfx.wav', music: metadata() }] })).toThrow('music author metadata belongs only')
    expect(() => parseMusicMetadata({ ...metadata(), rights: undefined, review: { status: 'approved', sha256: 'a'.repeat(64), reviewedAt: '2026-10-12T00:00:00.000Z' } })).toThrow('approved music must retain')
    expect(() => parseMusicMetadata({ ...metadata(), review: { status: { toString: () => 'pending' } } })).toThrow('MUSIC_METADATA_INVALID')
  })

  it('imports pending, approves only by explicit hash-verified CAS and preserves split author fields', async () => {
    const project = await fixture(true)
    const imported = await project.importAsset()
    expect(inspectMusicReview(imported.catalog.assets[0]!)).toMatchObject({ status: 'pending', canBind: false })
    const approved = await project.review()
    expect(inspectMusicReview(approved.catalog.assets[0]!)).toEqual({ status: 'approved', canBind: true, reasons: [] })
    expect(approved.catalog.assets[0]!.music!.review.sha256).toBe(project.digest)
    expect(JSON.parse(project.files['adv/assets.json']!).authorNote).toBe('Preserve this')
    expect(JSON.parse(project.files['adv/assets/audio.json']!).authorNote).toBe('Preserve fragment')
    await expect(project.service.reviewMusicAsset({ expectedRevision: imported.revision, assetId: project.asset.id, expectedSha256: project.digest, status: 'approved' })).rejects.toThrow('AUDIO_CONFLICT')
    const rejected = await project.review('rejected')
    expect(inspectMusicReview(rejected.catalog.assets[0]!)).toMatchObject({ status: 'rejected', canBind: false })
  })

  it('preserves approval for titles and labels, but invalidates changed intent, provenance and license', async () => {
    const project = await fixture()
    await project.importAsset()
    const approved = await project.review()
    const titled = await project.service.updateAsset({ expectedRevision: approved.revision, assetId: project.asset.id, patch: { title: 'New title', alt: 'Alt', labels: ['opening'] } })
    expect(titled.catalog.assets[0]!.music!.review).toEqual(approved.catalog.assets[0]!.music!.review)
    const music = { ...titled.catalog.assets[0]!.music!, usage: 'opening' as const }
    const changed = await project.service.updateAsset({ expectedRevision: titled.revision, assetId: project.asset.id, patch: { music } })
    expect(changed.catalog.assets[0]!.music!.review).toEqual({ status: 'pending' })
    const reapproved = await project.review()
    const licensed = await project.service.updateAsset({ expectedRevision: reapproved.revision, assetId: project.asset.id, patch: { license: 'new-license', music: { ...reapproved.catalog.assets[0]!.music!, rights: { license: 'new-license' } } } })
    expect(licensed.catalog.assets[0]!.music!.review.status).toBe('pending')
  })

  it('does not accept imported or metadata-patched approval without the review action', async () => {
    const project = await fixture()
    const forged = { ...project.asset, music: { ...project.asset.music!, review: { status: 'approved' as const, sha256: project.digest, reviewedAt: '2026-10-12T00:00:00.000Z' } } }
    await expect(project.importAsset(forged)).rejects.toThrow('MUSIC_REVIEW_REQUIRED')
    const pending = await project.importAsset()
    const patched = await project.service.updateAsset({ expectedRevision: pending.revision, assetId: project.asset.id, patch: { music: forged.music } })
    expect(patched.catalog.assets[0]!.music!.review.status).toBe('pending')
    await expect(project.service.updateAsset({ expectedRevision: patched.revision, assetId: project.asset.id, patch: { music: null } })).rejects.toThrow('MUSIC_METADATA_REQUIRED')
  })

  it.each(['pending', 'rejected', 'approved'] as const)('retains %s music review provenance across attempted kind round-trips', async (status) => {
    const project = await fixture()
    await project.importAsset()
    if (status !== 'pending')
      await project.review(status)
    const before = await project.service.readProjectAudio()
    const originalFiles = { ...project.files }
    for (const kind of ['sfx', 'ambience', 'voice', 'ui', 'reference'] as const) {
      for (const patch of [{ kind, music: null }, { kind }]) {
        await expect(project.service.updateAsset({ expectedRevision: before.revision, assetId: project.asset.id, patch })).rejects.toThrow('MUSIC_ASSET_KIND_INVALID')
        expect(project.files).toEqual(originalFiles)
      }
    }
    await expect(project.service.updateAsset({ expectedRevision: before.revision, assetId: project.asset.id, patch: { kind: 'bgm', music: null } })).rejects.toThrow('MUSIC_METADATA_REQUIRED')
    const retained = await project.service.readProjectAudio()
    expect(retained.revision).toBe(before.revision)
    expect(retained.catalog.assets[0]).toEqual(before.catalog.assets[0])
    expect(inspectMusicReview(retained.catalog.assets[0]!)).toMatchObject({ status, canBind: status === 'approved' })

    const edited = await project.service.updateAsset({ expectedRevision: retained.revision, assetId: project.asset.id, patch: { kind: 'bgm', music: { ...retained.catalog.assets[0]!.music!, usage: 'theme' } } })
    expect(inspectMusicReview(edited.catalog.assets[0]!)).toMatchObject({ status: 'pending', canBind: false })
    const reviewed = await project.review()
    expect(inspectMusicReview(reviewed.catalog.assets[0]!)).toMatchObject({ status: 'approved', canBind: true })
    expect(reviewed.catalog.assets[0]!.sha256).toBe(project.digest)
  })

  it('permits genuine legacy audio classification without synthesizing music review history', async () => {
    const project = await fixture()
    const legacy = { ...project.asset }
    delete legacy.music
    const imported = await project.importAsset(legacy)
    const classified = await project.service.updateAsset({ expectedRevision: imported.revision, assetId: legacy.id, patch: { kind: 'sfx', music: null } })
    expect(classified.catalog.assets[0]).toMatchObject({ kind: 'sfx', sha256: project.digest })
    expect(classified.catalog.assets[0]).not.toHaveProperty('music')
    const restored = await project.service.updateAsset({ expectedRevision: classified.revision, assetId: legacy.id, patch: { kind: 'bgm' } })
    expect(inspectMusicReview(restored.catalog.assets[0]!)).toEqual({ status: 'legacy', canBind: true, reasons: [] })
  })

  it('rejects a replaced master during the atomic review commit and keeps pending state', async () => {
    const project = await fixture()
    await project.importAsset()
    project.setAfterRead(() => project.media.set(`public/media/${project.asset.path}`, new TextEncoder().encode('replaced after verification').buffer))
    await expect(project.review()).rejects.toThrow('AUDIO_MEDIA_CHANGED')
    expect(project.catalog().assets[0]!.music!.review.status).toBe('pending')
  })

  it('rejects concurrent native edits, missing license and mismatched review SHA', async () => {
    const project = await fixture()
    await project.importAsset({ ...project.asset, license: undefined, music: createMusicMetadata({ usage: 'insert', source: { type: 'manual' } }) })
    await expect(project.review()).rejects.toThrow('MUSIC_LICENSE_REQUIRED')
    const before = await project.service.readProjectAudio()
    await expect(project.service.reviewMusicAsset({ expectedRevision: before.revision, assetId: project.asset.id, expectedSha256: 'a'.repeat(64), status: 'approved' })).rejects.toThrow('MUSIC_AUDIO_CHANGED')
    const withLicense = await project.service.updateAsset({ expectedRevision: before.revision, assetId: project.asset.id, patch: { music: metadata('insert') } })
    project.setBeforeCommit(() => project.files['adv/assets.json'] = `${project.files['adv/assets.json']}\n`)
    await expect(project.service.reviewMusicAsset({ expectedRevision: withLicense.revision, assetId: project.asset.id, expectedSha256: project.digest, status: 'approved' })).rejects.toThrow('AUDIO_CONFLICT')
    expect(project.catalog().assets[0]!.music!.review.status).toBe('pending')
  })

  it('keeps legacy music usable and shares editable playback defaults for all musical uses', () => {
    expect(inspectMusicReview({ type: 'audio', kind: 'bgm' })).toEqual({ status: 'legacy', canBind: true, reasons: [] })
    expect(inspectMusicReview({ type: 'audio', kind: 'bgm', state: 'rejected' }).canBind).toBe(false)
    expect(musicPlaybackDefaults('background')).toEqual({ gain: 0.7, loop: true, fade: { in: 500, out: 1000 } })
    for (const usage of ['theme', 'opening', 'ending', 'insert'] as const)
      expect(musicPlaybackDefaults(usage).loop).toBe(false)
    const approved = { ...metadata(), review: { status: 'approved' as const, sha256: 'a'.repeat(64), reviewedAt: '2026-10-12T00:00:00.000Z' } }
    expect(inspectMusicReview({ type: 'audio', kind: 'bgm', sha256: 'b'.repeat(64), music: approved }).reasons).toContain('MUSIC_AUDIO_CHANGED')
  })
})
