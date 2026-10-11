// @vitest-environment node
import type { AdvAssetEntry, AdvAssetManifest, RuntimeProgram, VoiceLedger, VoiceTake } from '@advjs/types'
import type { AudioProjectFilePort } from '../../../packages/audio/src/project-files'
import { describe, expect, it } from 'vitest'
import { createAudioId } from '../../../packages/audio/src/ids'
import { createProjectAudioService } from '../../../packages/audio/src/project-files'
import { AUDIO_MIXER_PATH, AudioAssetReferencedError, findAudioAssetReferences } from '../../../packages/audio/src/resources'

const bytes = new TextEncoder().encode('immutable native audio master').buffer
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const takeId = 'take_019d137e-7abc-7000-8000-000000000001'

async function fixture(split = false) {
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
  const base: AdvAssetManifest = { schemaVersion: 2, id: 'resources', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] }
  const root = split ? { ...base, assets: undefined, includes: ['assets/other.json'], custom: { projectName: 'Retain authored metadata' } } : { ...base, custom: { projectName: 'Retain authored metadata' } }
  const files: Record<string, string> = { 'adv/assets.json': JSON.stringify(root) }
  if (split)
    files['adv/assets/other.json'] = JSON.stringify({ schemaVersion: 2, assets: [], custom: 'keep fragment metadata' })
  const media = new Map<string, ArrayBuffer>([['adv/audio/.staging/import.wav', bytes.slice(0)]])
  let program: RuntimeProgram | undefined
  let beforeCommit: (() => void) | undefined
  let verifyMutate: (() => void) | undefined
  const commits: string[][] = []
  function catalog() {
    const root = JSON.parse(files['adv/assets.json']!)
    const assets = root.includes ? root.includes.flatMap((include: string) => JSON.parse(files[`adv/${include}`]!).assets) : root.assets
    return { ...base, assets } as AdvAssetManifest
  }
  const port: AudioProjectFilePort = {
    async read() { return { files: { ...files }, catalog: catalog(), program } },
    async readMedia(path) {
      const value = media.get(path)
      if (!value)
        throw new Error('native media missing')
      const result = value.slice(0)
      verifyMutate?.()
      verifyMutate = undefined
      return result
    },
    async commit(changes, imports) {
      beforeCommit?.()
      beforeCommit = undefined
      for (const change of changes) {
        if ((files[change.path] ?? null) !== change.expected)
          throw new Error('AUDIO_CONFLICT: Native documents changed')
      }
      for (const item of imports) {
        const source = media.get(item.candidate.path)!
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', source)), byte => byte.toString(16).padStart(2, '0')).join('')
        if (source.byteLength !== item.candidate.bytes || digest !== item.candidate.sha256)
          throw new Error('AUDIO_MEDIA_CHANGED: Native commit verifies immutable bytes')
        if (item.operation !== 'verify') {
          const path = `public/media/${item.asset.path}`
          if (media.has(path))
            throw new Error('AUDIO_AUDIO_EXISTS')
          media.set(path, source.slice(0))
        }
      }
      for (const change of changes) {
        if (change.expected === change.content)
          continue
        if (change.content === null)
          delete files[change.path]
        else
          files[change.path] = change.content
      }
      commits.push(changes.map(change => change.path))
    },
  }
  const service = createProjectAudioService(port)
  function asset(kind = 'sfx'): AdvAssetEntry {
    const id = createAudioId('audio')
    return { id, type: 'audio', kind, path: `audio/${id}.wav`, sha256, bytes: bytes.byteLength, mimeType: 'audio/wav', title: 'Imported master', source: { type: 'original' } }
  }
  return {
    files,
    media,
    service,
    asset,
    sha256,
    commits,
    port,
    catalog,
    setProgram(value: RuntimeProgram | undefined) { program = value },
    beforeCommit(action: () => void) { beforeCommit = action },
    duringVerification(action: () => void) { verifyMutate = action },
  }
}

function program(assetId: string): RuntimeProgram {
  return { schemaVersion: 2, id: 'story', hash: 'program-hash', entry: { chapterId: 'intro', nodeId: 'sound' }, requiredPlugins: {}, chapters: { intro: { id: 'intro', entry: 'sound', order: ['sound'], nodes: { sound: { id: 'sound', kind: 'effects', data: { operations: [{ type: 'bgm', action: 'set', asset: assetId }] } } } } } }
}

function take(asset: AdvAssetEntry): VoiceTake {
  return { id: takeId, assetId: asset.id, sha256: asset.sha256!, providerId: 'fake', voiceId: 'fake-voice', model: 'fake-model', voiceProfileRevision: 'a'.repeat(64), inputFingerprint: 'b'.repeat(64), spokenText: 'Hello.', createdAt: '2026-10-11T08:00:00.000Z', source: 'system' }
}

describe('native shared audio resource lifecycle', () => {
  it.each([false, true])('imports verified masters into the sole inline/split catalog: split=%s', async (split) => {
    const project = await fixture(split)
    const before = await project.service.readProjectAudio()
    const asset = project.asset()
    const registered = await project.service.importAsset({ expectedRevision: before.revision, asset, source: { path: 'adv/audio/.staging/import.wav', sha256: asset.sha256!, bytes: asset.bytes! } })
    expect(registered.catalog.assets).toEqual([asset])
    expect(project.media.get(`public/media/${asset.path}`)).toEqual(bytes)
    expect(JSON.parse(project.files['adv/assets.json']!).profiles.local.root).toBe('public/media')
    expect(JSON.parse(project.files['adv/assets.json']!).custom).toEqual({ projectName: 'Retain authored metadata' })
    if (split) {
      expect(JSON.parse(project.files['adv/assets.json']!).includes).toEqual(['assets/other.json', 'assets/audio.json'])
      expect(JSON.parse(project.files['adv/assets/other.json']!).custom).toBe('keep fragment metadata')
    }
    expect(project.files['adv/audio/voice-ledger.json']).toBeUndefined()
    expect(project.files[AUDIO_MIXER_PATH]).toBeUndefined()
  })

  it('registers already persisted bytes without replacing the immutable file', async () => {
    const project = await fixture()
    const asset = project.asset('reference')
    const master = bytes.slice(0)
    project.media.set(`public/media/${asset.path}`, master)
    const snapshot = await project.service.registerAsset({ expectedRevision: (await project.service.readProjectAudio()).revision, asset })
    expect(snapshot.catalog.assets).toEqual([asset])
    expect(project.media.get(`public/media/${asset.path}`)).toBe(master)
  })

  it('rejects corrupted import/register bytes and rechecks at the native commit seam', async () => {
    const project = await fixture()
    const asset = project.asset()
    const snapshot = await project.service.readProjectAudio()
    project.media.set('adv/audio/.staging/import.wav', new TextEncoder().encode('tampered').buffer)
    await expect(project.service.importAsset({ expectedRevision: snapshot.revision, asset, source: { path: 'adv/audio/.staging/import.wav', sha256: asset.sha256!, bytes: asset.bytes! } })).rejects.toThrow('AUDIO_MEDIA_CHANGED')
    project.media.set(`public/media/${asset.path}`, bytes.slice(0))
    project.duringVerification(() => project.media.set(`public/media/${asset.path}`, new TextEncoder().encode('changed after preflight').buffer))
    await expect(project.service.registerAsset({ expectedRevision: snapshot.revision, asset })).rejects.toThrow('AUDIO_MEDIA_CHANGED')
    expect(project.commits).toEqual([])
    expect((await project.service.readProjectAudio()).catalog.assets).toEqual([])
  })

  it('edits reviewed metadata while locking master identity, path, hash, size and provenance', async () => {
    const project = await fixture(true)
    const asset = project.asset()
    project.media.set(`public/media/${asset.path}`, bytes.slice(0))
    const registered = await project.service.registerAsset({ expectedRevision: (await project.service.readProjectAudio()).revision, asset })
    for (const field of ['id', 'path', 'sha256', 'bytes', 'source', 'variants']) {
      await expect(project.service.updateAsset({ expectedRevision: registered.revision, assetId: asset.id, patch: { [field]: 'overwrite' } })).rejects.toThrow('AUDIO_MASTER_IMMUTABLE')
    }
    const updated = await project.service.updateAsset({ expectedRevision: registered.revision, assetId: asset.id, patch: { title: 'Door', labels: ['chapter-one'], license: 'CC0-1.0', kind: 'ui', loop: false } })
    expect(updated.catalog.assets[0]).toEqual({ ...asset, title: 'Door', labels: ['chapter-one'], license: 'CC0-1.0', kind: 'ui', loop: false })
    const cleared = await project.service.updateAsset({ expectedRevision: updated.revision, assetId: asset.id, patch: { labels: null } })
    expect(cleared.catalog.assets[0]).not.toHaveProperty('labels')
  })

  it('keeps resource revision separate from voice while checking mixer CAS and UI resource kinds', async () => {
    const project = await fixture()
    const asset = project.asset('ui')
    project.media.set(`public/media/${asset.path}`, bytes.slice(0))
    const registered = await project.service.registerAsset({ expectedRevision: (await project.service.readProjectAudio()).revision, asset })
    const voiceRevision = (await project.service.read()).revision
    const saved = await project.service.saveMixer({ expectedRevision: registered.revision, mixer: { schemaVersion: 1, buses: { music: { gain: 0.5 } }, ducking: { enabled: true, gain: 0.25 }, ui: { click: asset.id } } })
    expect(saved.mixer.ui?.click).toBe(asset.id)
    expect(saved.revision).not.toBe(registered.revision)
    expect((await project.service.read()).revision).toBe(voiceRevision)
    await expect(project.service.saveMixer({ expectedRevision: registered.revision, mixer: { schemaVersion: 1 } })).rejects.toThrow('AUDIO_CONFLICT')
    await expect(project.service.saveMixer({ expectedRevision: saved.revision, mixer: { schemaVersion: 1, buses: { music: { gain: 2 } } } })).rejects.toThrow('0..1')
    await expect(project.service.saveMixer({ expectedRevision: saved.revision, mixer: { schemaVersion: 1, ui: { click: 'missing' } } })).rejects.toThrow('AUDIO_ASSET_NOT_FOUND')
    await expect(project.service.updateAsset({ expectedRevision: saved.revision, assetId: asset.id, patch: { kind: 'sfx' } })).rejects.toThrow('AUDIO_ASSET_KIND_REFERENCED')
  })

  it('reports selected/history/mixer/program references and prevents deleting any referenced master', async () => {
    const project = await fixture()
    const asset = project.asset('voice')
    project.media.set(`public/media/${asset.path}`, bytes.slice(0))
    await project.service.registerAsset({ expectedRevision: (await project.service.readProjectAudio()).revision, asset })
    const ledger: VoiceLedger = { schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: 'Hello.', locales: { en: { selectedTake: null, takes: [take(asset)] } } } } }
    project.files['adv/audio/voice-ledger.json'] = JSON.stringify(ledger)
    project.setProgram(program(asset.id))
    project.files[AUDIO_MIXER_PATH] = JSON.stringify({ schemaVersion: 1, ui: { click: asset.id } })
    const preflight = await project.service.preflightRemoveAsset(asset.id)
    expect(preflight.blockingReferences.map(reference => reference.type)).toEqual(['voice-history', 'mixer-ui', 'runtime-operation'])
    const snapshot = await project.service.readProjectAudio()
    await expect(project.service.removeAsset({ expectedRevision: snapshot.revision, assetId: asset.id })).rejects.toBeInstanceOf(AudioAssetReferencedError)
    expect(findAudioAssetReferences({ ...snapshot, ledger: { ...ledger, lines: { [lineId]: { ...ledger.lines[lineId]!, locales: { en: { selectedTake: takeId, takes: [take(asset)] } } } } } }, asset.id)[0]?.type).toBe('voice-selected')
    expect((await project.service.readProjectAudio()).catalog.assets).toHaveLength(1)
  })

  it('blocks cloned conditioning sources and assets used to derive another resource', async () => {
    const project = await fixture()
    const reference = project.asset('reference')
    const generated = project.asset('voice')
    const ledger: VoiceLedger = { schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: 'Hello.', locales: { en: { selectedTake: null, takes: [{ ...take(generated), voiceId: `reference:${reference.id}:${reference.sha256}` }] } } } } }
    const snapshot = { ledger, catalog: { ...project.catalog(), assets: [reference, { ...generated, source: { type: 'derived', derivedFrom: reference.id } }] }, mixer: { schemaVersion: 1 as const } }
    expect(findAudioAssetReferences(snapshot, reference.id).map(reference => reference.type)).toEqual(['voice-reference', 'derived-asset'])
  })

  it('deletes only catalog coordinates and preserves immutable audio bytes', async () => {
    const project = await fixture(true)
    const asset = project.asset()
    const master = bytes.slice(0)
    project.media.set(`public/media/${asset.path}`, master)
    const before = await project.service.registerAsset({ expectedRevision: (await project.service.readProjectAudio()).revision, asset })
    expect((await project.service.preflightRemoveAsset(asset.id)).blockingReferences).toEqual([])
    const after = await project.service.removeAsset({ expectedRevision: before.revision, assetId: asset.id })
    expect(after.catalog.assets).toEqual([])
    expect(project.media.get(`public/media/${asset.path}`)).toBe(master)
  })

  it('classifies legacy native audio only after an explicit kind choice', async () => {
    const project = await fixture()
    const legacy = { ...project.asset(), id: 'legacy/sound', kind: 'audio' }
    const root = JSON.parse(project.files['adv/assets.json']!)
    root.assets.push(legacy)
    project.files['adv/assets.json'] = JSON.stringify(root)
    const before = await project.service.readProjectAudio()
    await expect(project.service.updateAsset({ expectedRevision: before.revision, assetId: legacy.id, patch: { title: 'Door' } })).rejects.toThrow('LEGACY_CLASSIFICATION_REQUIRED')
    const classified = await project.service.updateAsset({ expectedRevision: before.revision, assetId: legacy.id, patch: { title: 'Door', kind: 'sfx' } })
    expect(classified.catalog.assets[0]).toMatchObject({ ...legacy, title: 'Door', kind: 'sfx' })
    expect((await project.service.preflightRemoveAsset(legacy.id)).blockingReferences).toEqual([])
  })

  it('guards concurrent ledger/story edits at the host transaction and fails closed when program is unavailable', async () => {
    const project = await fixture()
    const asset = project.asset()
    project.media.set(`public/media/${asset.path}`, bytes.slice(0))
    const before = await project.service.registerAsset({ expectedRevision: (await project.service.readProjectAudio()).revision, asset })
    project.beforeCommit(() => {
      project.files['adv/audio/voice-ledger.json'] = JSON.stringify({ schemaVersion: 1, lines: { [lineId]: { speakerId: 'hero', displayText: 'Hello.', locales: { en: { selectedTake: null, takes: [take(asset)] } } } } })
    })
    await expect(project.service.removeAsset({ expectedRevision: before.revision, assetId: asset.id })).rejects.toThrow('AUDIO_CONFLICT')
    expect((await project.service.readProjectAudio()).catalog.assets).toHaveLength(1)
    project.files['adv/chapters/intro.adv.md'] = '```yaml\nbgm: invalid\n```'
    expect((await project.service.preflightRemoveAsset(asset.id)).blockingReferences.at(-1)?.type).toBe('program-unavailable')
  })

  it.each(['../../outside.wav', '.git/private.wav', 'Node_Modules/private.wav', 'audio\\file.wav'])('rejects unsafe local coordinates: %s', async (path) => {
    const project = await fixture()
    const asset = { ...project.asset(), path }
    await expect(project.service.registerAsset({ expectedRevision: (await project.service.readProjectAudio()).revision, asset })).rejects.toThrow('project')
  })
})
