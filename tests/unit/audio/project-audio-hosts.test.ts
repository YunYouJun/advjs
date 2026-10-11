// @vitest-environment node
import type { AdvVoiceCandidate, VoiceAuthoringAdapter, VoiceTakeBindingInput } from '@advjs/types'
import type { IFileSystem } from '../../../apps/studio/src/utils/fs/types'
import type { ProjectFileChange, ProjectWorkspace, ProjectWorkspaceSnapshot } from '../../../editor/core/app/workspaces/project'
import { describe, expect, it, vi } from 'vitest'
import { createStudioAudioService } from '../../../apps/studio/src/utils/projectAudio'
import { createEditorProjectModel } from '../../../editor/core/app/adapters/browser/project'
import { createEditorAudioService } from '../../../editor/core/app/workspaces/audio'
import { createAudioId } from '../../../packages/audio/src/ids'
import { compileProject } from '../../../packages/core/src/project'

// Exercise the live project compiler through each host, without stale build output.
vi.mock('@advjs/core', () => import('../../../packages/core/src/project'))

const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const candidatePath = '.advjs/voice/previews/mock/candidate.wav'
const assetPath = 'audio/voice/immutable.wav'
const nativePath = `public/${assetPath}`
const ledgerPath = 'adv/audio/voice-ledger.json'
const fragmentPath = 'adv/assets/audio.json'
const profileRevision = 'a'.repeat(64)

function pcmWav() {
  const frames = 4800
  const bytes = new ArrayBuffer(44 + frames * 2)
  const view = new DataView(bytes)
  for (const [offset, word] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) {
    for (let index = 0; index < word.length; index++)
      view.setUint8(offset + index, word.charCodeAt(index))
  }
  view.setUint32(4, 36 + frames * 2, true)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 24000, true)
  view.setUint32(28, 48000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  view.setUint32(40, frames * 2, true)
  for (let index = 0; index < frames; index++)
    view.setInt16(44 + index * 2, index % 20 < 10 ? 1000 : -1000, true)
  return bytes
}

async function memoryProject(empty = false) {
  const files = new Map<string, string>(Object.entries({
    'adv.config.json': JSON.stringify({ id: 'host-conformance', root: 'adv' }),
    'adv/settings/game.json': JSON.stringify({ title: 'Audio authoring', characters: [{ id: 'hero', name: 'Hero' }] }),
    'adv/chapters/intro.adv.md': `@Hero\n你好。 {#${lineId}}`,
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'host-conformance', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, includes: ['assets/base.json'] }),
    'adv/assets/base.json': JSON.stringify({ schemaVersion: 2, assets: empty ? [] : [{ id: 'background.room', type: 'image', kind: 'background', path: 'room.svg' }] }),
    'public/room.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  }))
  const wav = pcmWav()
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', wav)), value => value.toString(16).padStart(2, '0')).join('')
  const blobs = new Map<string, Blob>([[candidatePath, new Blob([wav], { type: 'audio/wav' })]])
  const candidate: AdvVoiceCandidate = { id: 'mock-candidate', characterId: 'hero', text: '你好。', path: candidatePath, sha256, bytes: wav.byteLength, mimeType: 'audio/wav', durationSeconds: 0.2, sampleRate: 24000, provider: 'mock-tts', model: 'mock-model', providerVoiceId: 'mock-voice' }
  let failingWrite: string | undefined
  const sourceFiles = () => Object.fromEntries([...files, ...[...blobs.keys()].map(path => [path, ''] as const)])
  const textState = () => Object.fromEntries(files)
  const writeLog: string[] = []
  const removedMedia: string[] = []
  const importedMedia: string[] = []
  const synthesize = vi.fn<NonNullable<VoiceAuthoringAdapter['synthesize']>>(async input => ({
    provider: candidate.provider,
    preset: 'mock-preset',
    manifestPath: '.advjs/voice/previews/mock/manifest.json',
    manifest: { provider: candidate.provider },
    candidates: [{ ...candidate, characterId: input.speakerId, text: input.text }],
  }))
  const fs: IFileSystem = {
    backend: 'memory',
    async readFile(path) {
      const value = files.get(path)
      if (value === undefined)
        throw new Error(`File missing: ${path}`)
      return value
    },
    async readBlob(path) {
      const value = blobs.get(path)
      if (!value)
        throw new Error(`Media missing: ${path}`)
      return value
    },
    async readdir(path) {
      const prefix = path ? `${path}/` : ''
      const children = new Map<string, boolean>()
      for (const file of [...files.keys(), ...blobs.keys()]) {
        if (file.startsWith(prefix)) {
          const relative = file.slice(prefix.length)
          children.set(relative.split('/')[0]!, relative.includes('/'))
        }
      }
      return [...children].map(([name, directory]) => ({ name, path: `${prefix}${name}`, type: directory ? 'directory' : 'file', size: 0, mtime: 0 }))
    },
    async exists(path) { return files.has(path) || blobs.has(path) },
    async stat(path) { return { path, name: path.split('/').at(-1)!, type: 'file', size: blobs.get(path)?.size ?? files.get(path)?.length ?? 0, mtime: 0 } },
    async writeFile(path, content) {
      writeLog.push(path)
      if (failingWrite === path) {
        failingWrite = undefined
        throw new Error('Simulated metadata commit failure')
      }
      files.set(path, content)
    },
    async writeBlob(path, blob) {
      blobs.set(path, blob)
      importedMedia.push(path)
    },
    async mkdir() {},
    async deleteFile(path) {
      files.delete(path)
      if (blobs.delete(path))
        removedMedia.push(path)
    },
    async rmdir(path) {
      for (const file of [...files.keys(), ...blobs.keys()]) {
        if (file.startsWith(`${path}/`))
          await fs.deleteFile(file)
      }
    },
    async listFiles(subdir, extension) { return [...files.keys()].filter(path => path.startsWith(`${subdir}/`) && path.endsWith(extension)) },
    async listFilesByExts(subdir, extensions) { return [...files.keys()].filter(path => path.startsWith(`${subdir}/`) && extensions.some(extension => path.endsWith(extension))) },
    async collectAllFiles() { return Object.entries(sourceFiles()).map(([path, content]) => ({ path, content, lastModified: new Date(0) })) },
    async readBlobUrl() { throw new Error('Audio metadata reads must not allocate preview URLs') },
  }

  const root = { kind: 'directory' as const, name: 'audio-fixture', async* values() {} }
  async function readDocuments() {
    const sources = sourceFiles()
    const compilation = await compileProject({ files: sources }, { allowEmptyAssetManifest: true })
    if (!compilation.project.assets)
      throw new Error('Fixture catalog failed to compile')
    return { files: sources, catalog: compilation.project.assets }
  }
  const previewSnapshot = vi.fn(async (): Promise<ProjectWorkspaceSnapshot> => {
    throw new Error('Metadata-only audio operations must not reset preview snapshots')
  })
  const workspace: ProjectWorkspace = {
    kind: 'browser',
    snapshot: previewSnapshot,
    readDocuments,
    async commit() { throw new Error('Source patches are outside the audio transaction') },
    async writeFiles(changes: ProjectFileChange[]) {
      for (const change of changes) {
        if ((files.get(change.path) ?? null) !== change.expected)
          throw new Error('VOICE_CONFLICT: Concurrent workspace edit')
      }
      // ProjectWorkspace is atomic across its metadata change set.
      if (changes.some(change => change.path === failingWrite)) {
        failingWrite = undefined
        throw new Error('Simulated metadata commit failure')
      }
      for (const change of changes) {
        writeLog.push(change.path)
        if (change.content === null)
          files.delete(change.path)
        else
          files.set(change.path, change.content)
      }
      const sources = sourceFiles()
      return { kind: 'browser', name: root.name, root, project: createEditorProjectModel(await compileProject({ files: sources }, { allowEmptyAssetManifest: true }), sources) }
    },
    readAsset: fs.readBlob,
    async importAsset(path, blob) {
      if (await fs.exists(path))
        throw new Error('VOICE_AUDIO_EXISTS: Immutable media already exists')
      await fs.writeBlob(path, blob)
    },
    async removeImportedAsset(path, blob) {
      if (blobs.get(path) === blob)
        await fs.deleteFile(path)
    },
  }
  return {
    files,
    blobs,
    fs,
    workspace,
    candidate,
    synthesize,
    previewSnapshot,
    importedMedia,
    removedMedia,
    writeLog,
    textState,
    failNextMetadata(path: string) { failingWrite = path },
  }
}

type Host = 'Editor' | 'Studio'
function service(host: Host, project: Awaited<ReturnType<typeof memoryProject>>) {
  return host === 'Editor' ? createEditorAudioService(project.workspace, project.synthesize) : createStudioAudioService(project.fs, project.synthesize)
}

function binding(candidate: AdvVoiceCandidate, expectedRevision: string): VoiceTakeBindingInput & { expectedRevision: string } {
  return { candidate, expectedRevision, lineId, locale: 'zh-cn', speakerId: 'hero', displayText: '你好。', assetPath, voiceProfileRevision: profileRevision, source: 'system' }
}

describe.each<Host>(['Editor', 'Studio'])('%s immutable hosted receipt import', (host) => {
  async function receipt() {
    const remote = await memoryProject(true)
    const native = service('Editor', remote)
    const registered = await native.register(binding(remote.candidate, (await native.read()).revision))
    const take = registered.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!
    return { take, asset: registered.catalog.assets.find(asset => asset.id === take.assetId)! }
  }
  it('preserves remote identities, imports unselected, and replays idempotently after author selection', async () => {
    const project = await memoryProject(true)
    const audio = service(host, project)
    const remote = await receipt()
    const imported = await audio.importTake!({ ...binding(project.candidate, (await audio.read()).revision), ...remote })
    expect(imported.ledger.lines[lineId]!.locales['zh-CN']).toMatchObject({ selectedTake: null, takes: [remote.take] })
    expect(imported.catalog.assets).toEqual([remote.asset])
    const selected = await audio.select({ lineId, locale: 'zh-CN', takeId: remote.take.id, expectedRevision: imported.revision })
    const writes = project.writeLog.length
    const replay = await audio.importTake!({ ...binding(project.candidate, selected.revision), ...remote })
    expect(replay).toEqual(selected)
    expect(project.writeLog).toHaveLength(writes)
    expect(project.importedMedia).toEqual([nativePath])
    project.blobs.set(nativePath, new Blob([new Uint8Array([1])], { type: 'audio/wav' }))
    await expect(audio.importTake!({ ...binding(project.candidate, selected.revision), ...remote })).rejects.toThrow('VOICE_AUDIO_CHANGED')
  })
  it('rejects altered provenance and stale revisions before changing metadata or media', async () => {
    const project = await memoryProject(true)
    const audio = service(host, project)
    const remote = await receipt()
    const input = { ...binding(project.candidate, (await audio.read()).revision), ...remote }
    const before = project.textState()
    await expect(audio.importTake!({ ...input, take: { ...remote.take, inputFingerprint: 'b'.repeat(64) } })).rejects.toThrow('PROVENANCE_CHANGED')
    await expect(audio.importTake!({ ...input, asset: { ...remote.asset, path: 'voice/another.wav' } })).rejects.toThrow('IDENTITY_CHANGED')
    await expect(audio.importTake!({ ...input, expectedRevision: 'b'.repeat(64) })).rejects.toThrow('VOICE_CONFLICT')
    expect(project.textState()).toEqual(before)
    expect(project.blobs.has(nativePath)).toBe(false)
  })
  it('rolls back receipt media on metadata failure without losing the ability to import again', async () => {
    const project = await memoryProject(true)
    const audio = service(host, project)
    const remote = await receipt()
    const input = { ...binding(project.candidate, (await audio.read()).revision), ...remote }
    const before = project.textState()
    project.failNextMetadata(fragmentPath)
    await expect(audio.importTake!(input)).rejects.toThrow('metadata commit failure')
    expect(project.textState()).toEqual(before)
    expect(project.blobs.has(nativePath)).toBe(false)
    expect((await audio.importTake!(input)).ledger.lines[lineId]!.locales['zh-CN']!.takes[0]).toEqual(remote.take)
  })
})

it('rolls back a hosted Studio import when the authenticated scope expires during media commit', async () => {
  const remote = await memoryProject(true)
  const server = service('Editor', remote)
  const registered = await server.register(binding(remote.candidate, (await server.read()).revision))
  const take = registered.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!
  const asset = registered.catalog.assets.find(asset => asset.id === take.assetId)!
  const project = await memoryProject(true)
  let active = true
  const nativeWrite = project.fs.writeBlob
  vi.spyOn(project.fs, 'writeBlob').mockImplementation(async (path, blob) => {
    await nativeWrite(path, blob)
    active = false
  })
  const local = createStudioAudioService(project.fs, undefined, { validateAccess: () => {
    if (!active)
      throw new Error('AUDIO_JOB_SCOPE_CHANGED')
  } })
  const before = project.textState()
  await expect(local.importTake!({ ...binding(project.candidate, (await local.read()).revision), take, asset })).rejects.toThrow('SCOPE_CHANGED')
  expect(project.textState()).toEqual(before)
  expect(project.blobs.has(nativePath)).toBe(false)
})

describe.each<Host>(['Editor', 'Studio'])('%s canonical audio authoring conformance', (host) => {
  it('generates exact spoken text and registers/selects through the same split project documents', async () => {
    const project = await memoryProject()
    const audio = service(host, project)
    const before = await audio.read()
    const output = await audio.synthesize({ lineId, locale: 'zh-cn', speakerId: 'hero', displayText: '**你好。**' })
    expect(project.synthesize).toHaveBeenCalledExactlyOnceWith({ lineId, locale: 'zh-CN', speakerId: 'hero', text: '你好。' }, undefined)
    expect(project.textState()).not.toHaveProperty(ledgerPath)
    expect(project.blobs.has(nativePath)).toBe(false)
    const registered = await audio.register(binding(output.candidates[0]!, before.revision))
    const locale = registered.ledger.lines[lineId]!.locales['zh-CN']!
    expect(locale.selectedTake).toBeNull()
    expect(locale.takes).toHaveLength(1)
    expect(locale.takes[0]).toMatchObject({ providerId: 'mock-tts', voiceId: 'mock-voice', sha256: project.candidate.sha256, spokenText: '你好。' })
    const root = JSON.parse(project.files.get('adv/assets.json')!)
    const fragment = JSON.parse(project.files.get(fragmentPath)!)
    expect(root.includes).toEqual(['assets/base.json', 'assets/audio.json'])
    expect(fragment.assets[0]).toMatchObject({ id: locale.takes[0]!.assetId, type: 'audio', kind: 'voice', path: assetPath, sha256: project.candidate.sha256 })
    expect(await project.blobs.get(nativePath)!.arrayBuffer()).toEqual(await project.blobs.get(candidatePath)!.arrayBuffer())
    const selected = await audio.select({ lineId, locale: 'zh-cn', takeId: locale.takes[0]!.id, expectedRevision: registered.revision })
    expect(selected.ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBe(locale.takes[0]!.id)
    expect(selected.revision).not.toBe(registered.revision)
    expect(project.previewSnapshot).not.toHaveBeenCalled()
  })

  it('allows the first registration into an explicitly empty authoring catalog', async () => {
    const project = await memoryProject(true)
    const audio = service(host, project)
    const empty = await audio.read()
    expect(empty.catalog.assets).toEqual([])
    const registered = await audio.register(binding(project.candidate, empty.revision))
    expect(registered.catalog.assets).toHaveLength(1)
    expect(registered.catalog.assets[0]?.kind).toBe('voice')
    expect(project.previewSnapshot).not.toHaveBeenCalled()
  })

  it('rejects stale project revisions without importing media or overwriting external edits', async () => {
    const project = await memoryProject()
    const audio = service(host, project)
    const before = await audio.read()
    const fragment = JSON.parse(project.files.get('adv/assets/base.json')!)
    fragment.assets[0].title = 'Edited by another host'
    project.files.set('adv/assets/base.json', JSON.stringify(fragment))
    const externalState = project.textState()
    await expect(audio.register(binding(project.candidate, before.revision))).rejects.toThrow('VOICE_CONFLICT')
    expect(project.textState()).toEqual(externalState)
    expect(project.importedMedia).toEqual([])
    expect(project.writeLog).toEqual([])
  })

  it('rolls back new media and every metadata file when the ledger commit fails', async () => {
    const project = await memoryProject()
    const audio = service(host, project)
    const before = await audio.read()
    const documents = project.textState()
    project.failNextMetadata(ledgerPath)
    await expect(audio.register(binding(project.candidate, before.revision))).rejects.toThrow('metadata commit failure')
    expect(project.textState()).toEqual(documents)
    expect(project.blobs.has(nativePath)).toBe(false)
    expect(project.blobs.has(candidatePath)).toBe(true)
    expect(project.removedMedia).toEqual([nativePath])
    // A failed transaction must not poison the host's following transaction.
    const registered = await audio.register(binding(project.candidate, before.revision))
    expect(registered.ledger.lines[lineId]!.locales['zh-CN']!.takes).toHaveLength(1)
    expect(project.previewSnapshot).not.toHaveBeenCalled()
  })

  it('blocks tampered generated bytes before registration changes any document', async () => {
    const project = await memoryProject()
    const audio = service(host, project)
    const before = await audio.read()
    const documents = project.textState()
    project.blobs.set(candidatePath, new Blob(['tampered']))
    await expect(audio.register(binding(project.candidate, before.revision))).rejects.toThrow('VOICE_AUDIO_CHANGED')
    expect(project.textState()).toEqual(documents)
    expect(project.blobs.has(nativePath)).toBe(false)
    expect(project.importedMedia).toEqual([])
  })

  it('rechecks native immutable bytes before adopting an already registered take', async () => {
    const project = await memoryProject()
    const audio = service(host, project)
    const before = await audio.read()
    const registered = await audio.register(binding(project.candidate, before.revision))
    const take = registered.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!
    const documents = project.textState()
    project.blobs.set(nativePath, new Blob(['tampered after review']))
    await expect(audio.select({ lineId, locale: 'zh-CN', takeId: take.id, expectedRevision: registered.revision })).rejects.toThrow('VOICE_AUDIO_CHANGED')
    expect(project.textState()).toEqual(documents)
    expect((await audio.read()).ledger.lines[lineId]!.locales['zh-CN']!.selectedTake).toBeNull()
    expect(project.previewSnapshot).not.toHaveBeenCalled()
  })

  it('preserves a preexisting immutable destination instead of overwriting it', async () => {
    const project = await memoryProject()
    const audio = service(host, project)
    const before = await audio.read()
    const owned = new Blob(['existing author media'])
    project.blobs.set(nativePath, owned)
    const documents = project.textState()
    await expect(audio.register(binding(project.candidate, before.revision))).rejects.toThrow('VOICE_AUDIO_EXISTS')
    expect(project.textState()).toEqual(documents)
    expect(project.blobs.get(nativePath)).toBe(owned)
    expect(project.removedMedia).toEqual([])
  })
})

describe('editor and Studio document interchange', () => {
  it('reads each other’s revisions and selection without translating private host fields', async () => {
    const project = await memoryProject()
    const editor = service('Editor', project)
    const studio = service('Studio', project)
    const first = await editor.read()
    expect(await studio.read()).toEqual(first)
    const registered = await editor.register(binding(project.candidate, first.revision))
    expect(await studio.read()).toEqual(registered)
    const take = registered.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!
    const selected = await studio.select({ lineId, locale: 'zh-cn', takeId: take.id, expectedRevision: registered.revision })
    expect(await editor.read()).toEqual(selected)
    await expect(editor.select({ lineId, locale: 'zh-CN', takeId: null, replaceSelected: true, expectedRevision: registered.revision })).rejects.toThrow('VOICE_CONFLICT')
    expect(await studio.read()).toEqual(selected)
    const cleared = await editor.select({ lineId, locale: 'zh-CN', takeId: null, replaceSelected: true, expectedRevision: selected.revision })
    expect(await studio.read()).toEqual(cleared)
    expect(cleared.ledger.lines[lineId]!.locales['zh-CN']!.takes).toEqual(registered.ledger.lines[lineId]!.locales['zh-CN']!.takes)
    expect(project.previewSnapshot).not.toHaveBeenCalled()
  })

  for (const host of ['Editor', 'Studio'] as const) {
    it.each([
      { provider: 'http', baseUrl: 'https://example.invalid/audio/' },
      { provider: 'project', root: '../outside' },
      { provider: 'project', root: 'node_modules/third-party' },
    ])(`${host} rejects non-native or unsafe profile roots: %j`, async (profile) => {
      const project = await memoryProject()
      const audio = service(host, project)
      const before = await audio.read()
      const root = JSON.parse(project.files.get('adv/assets.json')!)
      root.profiles.local = profile
      project.files.set('adv/assets.json', JSON.stringify(root))
      const documents = project.textState()
      const updated = await audio.read()
      await expect(audio.register(binding(project.candidate, updated.revision))).rejects.toThrow('project')
      expect(project.blobs.has(nativePath)).toBe(false)
      expect(project.importedMedia).toEqual([])
      expect(project.textState()).toEqual(documents)
      expect(before.catalog.profiles.local.provider).toBe('project')
    })
  }
})

describe.each<Host>(['Editor', 'Studio'])('%s native resource and mixer protocol', (host) => {
  it('rejects noncanonical content roots before writing another audio directory', async () => {
    const project = await memoryProject()
    project.files.set('adv.config.json', JSON.stringify({ id: 'host-conformance', root: 'story' }))
    for (const [path, content] of [...project.files]) {
      if (path.startsWith('adv/'))
        project.files.set(path.replace(/^adv\//u, 'story/'), content)
    }
    const before = project.textState()
    await expect(service(host, project).readProjectAudio()).rejects.toThrow('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')
    expect(project.textState()).toEqual(before)
    expect(project.writeLog).toEqual([])
  })

  it('imports native UI media, preserves catalog coordinates, edits metadata and removes only unreferenced catalog entries', async () => {
    const project = await memoryProject()
    const audio = service(host, project)
    const assetId = createAudioId('audio')
    const path = `audio/ui/${assetId}.wav`
    const asset = { id: assetId, type: 'audio' as const, kind: 'ui', path, sha256: project.candidate.sha256, bytes: project.candidate.bytes, mimeType: 'audio/wav', source: { type: 'original' } }
    const first = await audio.readProjectAudio()
    const imported = await audio.importAsset({ expectedRevision: first.revision, asset, source: { path: candidatePath, sha256: asset.sha256, bytes: asset.bytes } })
    const immutable = project.blobs.get(`public/${path}`)!
    expect(await immutable.arrayBuffer()).toEqual(await project.blobs.get(candidatePath)!.arrayBuffer())
    expect(JSON.parse(project.files.get('adv/assets.json')!).profiles.local.root).toBe('public')
    const edited = await audio.updateAsset({ expectedRevision: imported.revision, assetId, patch: { title: 'Confirm', labels: ['menu'], license: 'CC0-1.0' } })
    expect(edited.catalog.assets.find(asset => asset.id === assetId)).toMatchObject({ ...asset, title: 'Confirm', labels: ['menu'], license: 'CC0-1.0' })
    const saved = await audio.saveMixer({ expectedRevision: edited.revision, mixer: { schemaVersion: 1, buses: { ui: { gain: 0.6 } }, ui: { confirm: assetId } } })
    expect(JSON.parse(project.files.get('adv/audio/mixer.json')!).ui.confirm).toBe(assetId)
    expect((await audio.preflightRemoveAsset(assetId)).blockingReferences).toEqual([expect.objectContaining({ type: 'mixer-ui', location: 'adv/audio/mixer.json#ui/confirm' })])
    await expect(audio.removeAsset({ expectedRevision: saved.revision, assetId })).rejects.toThrow('AUDIO_ASSET_REFERENCED')
    await expect(audio.saveMixer({ expectedRevision: edited.revision, mixer: { schemaVersion: 1 } })).rejects.toThrow('AUDIO_CONFLICT')
    const cleared = await audio.saveMixer({ expectedRevision: saved.revision, mixer: { schemaVersion: 1, buses: { ui: { gain: 0.6 } } } })
    const removed = await audio.removeAsset({ expectedRevision: cleared.revision, assetId })
    expect(removed.catalog.assets.find(asset => asset.id === assetId)).toBeUndefined()
    expect(project.blobs.get(`public/${path}`)).toBe(immutable)
    expect(project.previewSnapshot).not.toHaveBeenCalled()
  })

  it('registers an existing native master with byte verification and protects immutable voice history', async () => {
    const project = await memoryProject()
    const audio = service(host, project)
    const assetId = createAudioId('audio')
    const path = `audio/reference/${assetId}.wav`
    const original = project.blobs.get(candidatePath)!
    project.blobs.set(`public/${path}`, original)
    const first = await audio.readProjectAudio()
    const registered = await audio.registerAsset({ expectedRevision: first.revision, asset: { id: assetId, type: 'audio', kind: 'reference', path, sha256: project.candidate.sha256, bytes: project.candidate.bytes, mimeType: 'audio/wav' } })
    expect(registered.catalog.assets.find(asset => asset.id === assetId)?.kind).toBe('reference')
    expect(project.blobs.get(`public/${path}`)).toBe(original)
    const voice = await audio.register(binding(project.candidate, (await audio.read()).revision))
    const take = voice.ledger.lines[lineId]!.locales['zh-CN']!.takes[0]!
    const resourceSnapshot = await audio.readProjectAudio()
    const preflight = await audio.preflightRemoveAsset(take.assetId)
    expect(preflight.blockingReferences).toContainEqual(expect.objectContaining({ type: 'voice-history', lineId, locale: 'zh-CN', takeId: take.id }))
    await expect(audio.removeAsset({ expectedRevision: resourceSnapshot.revision, assetId: take.assetId })).rejects.toThrow('AUDIO_ASSET_REFERENCED')
    await expect(audio.updateAsset({ expectedRevision: resourceSnapshot.revision, assetId: take.assetId, patch: { kind: 'sfx' } })).rejects.toThrow('AUDIO_ASSET_KIND_REFERENCED')
    expect((await audio.read()).ledger).toEqual(voice.ledger)
  })
})

it('interchanges canonical resource and mixer revisions across Editor and Studio', async () => {
  const project = await memoryProject()
  const editor = service('Editor', project)
  const studio = service('Studio', project)
  const first = await editor.readProjectAudio()
  expect(await studio.readProjectAudio()).toEqual(first)
  const assetId = createAudioId('audio')
  const asset = { id: assetId, type: 'audio' as const, kind: 'sfx', path: `audio/${assetId}.wav`, sha256: project.candidate.sha256, bytes: project.candidate.bytes, mimeType: 'audio/wav' }
  const imported = await editor.importAsset({ expectedRevision: first.revision, asset, source: { path: candidatePath, sha256: asset.sha256, bytes: asset.bytes } })
  expect(await studio.readProjectAudio()).toEqual(imported)
  const updated = await studio.updateAsset({ expectedRevision: imported.revision, assetId, patch: { title: 'Shared door effect' } })
  expect(await editor.readProjectAudio()).toEqual(updated)
  const mixer = await editor.saveMixer({ expectedRevision: updated.revision, mixer: { schemaVersion: 1, buses: { music: { gain: 0.35 } }, sfx: { maxVoices: 8 } } })
  expect(await studio.readProjectAudio()).toEqual(mixer)
  await expect(studio.updateAsset({ expectedRevision: imported.revision, assetId, patch: { title: 'Stale overwrite' } })).rejects.toThrow('AUDIO_CONFLICT')
  expect(project.previewSnapshot).not.toHaveBeenCalled()
})
