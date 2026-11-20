import type { AudioAssetKind, AudioAssetMetadataPatch, AudioProjectFileChange, AudioProjectMedia } from '@advjs/audio'
import type { AdvMusicMetadata, AudioMixerConfig } from '@advjs/types'
import type { Input } from './input'
import type { EngineErrorCode } from './protocol'
import {
  audioAssetKinds,
  audioBuses,
  audioProjectMediaPath,
  createMusicMetadata,
  createProjectAudioResourceService,
  exportMusicBrief,
  inspectMusicReview,
  musicUsages,
  prepareAudioAssetImport,
} from '@advjs/audio'
import { compileProject, prepareMarkdownMusicBinding, prepareProjectAudioCatalog } from '@advjs/core/project'
import { requireFileMap, requireObject, requireString } from './input'
import { officialPluginVersions } from './plugins'
import { EngineFailure } from './protocol'

const options = { plugins: officialPluginVersions(), allowEmptyAssetManifest: true }

async function audioProject(input: Input) {
  const files = { ...requireFileMap(input) }
  const compiled = await compileProject({ files }, options)
  if (compiled.project.root !== 'adv')
    throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Audio authoring requires the canonical adv content root')
  const catalog = compiled.project.assets
  if (!catalog || !files['adv/assets.json'])
    throw new Error('AUDIO_CATALOG_INVALID: A native asset catalog is required')
  const plan: {
    changes: AudioProjectFileChange[]
    media: Array<AudioProjectMedia & { path: string }>
  } = { changes: [], media: [] }
  const verified = new Map<string, { sha256: string, bytes: number }>()
  const service = createProjectAudioResourceService({
    read: async () => ({ files, catalog, program: compiled.project.program }),
    async verifyMedia(path, sha256, bytes) {
      // The host hashes the coordinated bytes and checks the same identity
      // again when it applies the plan. No media is copied through JSC.
      const actual = verified.get(path)
      if (!actual || actual.sha256 !== sha256 || actual.bytes !== bytes)
        throw new Error('AUDIO_MEDIA_CHANGED: The audio master has changed')
    },
    async commit(changes, media) {
      plan.changes = changes
      plan.media = media.map(item => ({ ...item, path: audioProjectMediaPath(catalog, item.asset) }))
      for (const { path, content } of changes) {
        if (content === null)
          delete files[path]
        else
          files[path] = content
      }
    },
  })
  return { catalog, service, plan, verified }
}

const authoring: Record<string, (input: Input) => unknown> = {
  'audio.library': async (input) => {
    const files = requireFileMap(input)
    const base = { kinds: audioAssetKinds, usages: musicUsages, buses: audioBuses, assets: [], mixer: { schemaVersion: 1 } }
    if (!Object.hasOwn(files, 'adv/assets.json'))
      return { ...base, state: Object.hasOwn(files, 'adv/assets/index.json') ? 'legacy' : 'uninitialized' }
    const { service } = await audioProject(input)
    const { catalog, mixer, revision } = await service.readProjectAudio()
    const assets = catalog.assets.filter(asset => asset.type === 'audio').map((asset) => {
      let mediaPath
      try {
        mediaPath = audioProjectMediaPath(catalog, asset)
      }
      catch {
        // External or resource-only catalog entries have no local preview.
      }
      return { ...asset, mediaPath, musicReview: inspectMusicReview(asset) }
    })
    return { ...base, state: 'ready', assets, mixer, revision }
  },
  'audio.initialize': async input => ({
    changes: await prepareProjectAudioCatalog(requireFileMap(input), requireString(input, 'id'), options),
  }),
  'audio.brief': (input) => {
    const music = createMusicMetadata(requireObject(input, 'music') as unknown as Omit<AdvMusicMetadata, 'schemaVersion' | 'review'>)
    return { music, text: exportMusicBrief(music), json: `${JSON.stringify(music, null, 2)}\n` }
  },
  'audio.import': async (input) => {
    const { service, plan, verified } = await audioProject(input)
    const metadata = requireObject(input, 'metadata') as AudioAssetMetadataPatch & { kind: AudioAssetKind }
    const master = requireObject(input, 'master') as Parameters<typeof prepareAudioAssetImport>[1]
    const { asset, source } = prepareAudioAssetImport(metadata, master)
    verified.set(source.path, master)
    await service.importAsset({ expectedRevision: requireString(input, 'revision'), asset, source })
    return { ...plan, assetId: asset.id }
  },
  'audio.update': async (input) => {
    const { service, plan } = await audioProject(input)
    await service.updateAsset({ expectedRevision: requireString(input, 'revision'), assetId: requireString(input, 'id'), patch: requireObject(input, 'metadata') })
    return plan
  },
  'audio.review': async (input) => {
    const { service, plan, verified, catalog } = await audioProject(input)
    const id = requireString(input, 'id')
    const asset = catalog.assets.find(asset => asset.id === id)
    if (!asset)
      throw new Error('AUDIO_ASSET_NOT_FOUND')
    const master = requireObject(input, 'master') as { sha256: string, bytes: number }
    verified.set(audioProjectMediaPath(catalog, asset), master)
    await service.reviewMusicAsset({ expectedRevision: requireString(input, 'revision'), assetId: id, expectedSha256: master.sha256, status: requireString(input, 'status') as 'approved' | 'rejected' })
    return plan
  },
  'audio.remove': async (input) => {
    const { service, plan } = await audioProject(input)
    await service.removeAsset({ expectedRevision: requireString(input, 'revision'), assetId: requireString(input, 'id') })
    return plan
  },
  'audio.mixer': async (input) => {
    const { service, plan } = await audioProject(input)
    await service.saveMixer({ expectedRevision: requireString(input, 'revision'), mixer: requireObject(input, 'mixer') as unknown as AudioMixerConfig })
    return plan
  },
  'audio.bindMarkdown': async (input) => {
    const files = requireFileMap(input)
    const path = requireString(input, 'path')
    const assetId = requireString(input, 'id')
    const { content, changes } = await prepareMarkdownMusicBinding(files, path, assetId, options)
    return { path, assetId, original: files[path], content, changes }
  },
}

const audioErrors: Record<string, EngineErrorCode> = {
  AUDIO_ASSET_REFERENCED: 'ENGINE_AUDIO_REFERENCED',
  AUDIO_ASSET_KIND_REFERENCED: 'ENGINE_AUDIO_REFERENCED',
  AUDIO_CONFLICT: 'ENGINE_AUDIO_CONFLICT',
  VOICE_CONFLICT: 'ENGINE_AUDIO_CONFLICT',
  MUSIC_REVIEW_REQUIRED: 'ENGINE_AUDIO_REVIEW_REQUIRED',
  MUSIC_LICENSE_REQUIRED: 'ENGINE_AUDIO_REVIEW_REQUIRED',
  ADV_AUDIO_SOURCE_TARGET_CHANGED: 'ENGINE_AUDIO_CHAPTER_INVALID',
  ADV_AUDIO_SOURCE_TARGET_INVALID: 'ENGINE_AUDIO_CHAPTER_INVALID',
  ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: 'ENGINE_AUDIO_ROOT_UNSUPPORTED',
  ADV_AUDIO_FILE_INVALID: 'ENGINE_AUDIO_FILE_INVALID',
}

export const audioAuthoringOperations = Object.fromEntries(Object.entries(authoring).map(([name, run]) => [
  name,
  async (input: Input) => {
    try {
      return await run(input)
    }
    catch (error) {
      if (error instanceof EngineFailure)
        throw error
      const message = error instanceof Error ? error.message : String(error)
      const code = message.split(':', 1)[0]!
      throw new EngineFailure(Object.hasOwn(audioErrors, code) ? audioErrors[code]! : 'ENGINE_AUDIO_INVALID', message)
    }
  },
]))
