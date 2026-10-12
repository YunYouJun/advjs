import type { AdvAssetEntry, AdvMusicMetadata } from '@advjs/types'
import { createAdvAssetCatalog, planAdvAssetManifestUpsert } from '@advjs/assets'
import { audioFingerprint, createAudioId, createMusicMetadata, musicPlaybackDefaults } from '@advjs/audio'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAudioStore } from './useAudioStore'
import { useProjectStore } from './useProjectStore'

export const useProjectAssets = defineStore('editor:project-assets', () => {
  const projectStore = useProjectStore()
  const manifest = computed(() => projectStore.project?.compilation.project.assets)
  const audio = computed(() => manifest.value?.assets.filter(asset => asset.type === 'audio') ?? [])
  const error = ref('')
  function metadataFingerprint(asset: AdvAssetEntry) {
    return audioFingerprint(JSON.parse(JSON.stringify(asset)))
  }
  function rootPath() {
    const config = JSON.parse(projectStore.project?.files['adv.config.json'] ?? '{}')
    return `${String(config.root ?? './adv').replace(/^\.\//u, '')}/assets.json`
  }
  async function upsert(asset: AdvAssetEntry, expectedFiles = projectStore.project?.files, expectedAsset?: AdvAssetEntry) {
    if (!expectedFiles)
      throw new Error('Open a project first')
    if (asset.type === 'audio') {
      const path = rootPath()
      const root = JSON.parse(expectedFiles[path] ?? '{}')
      const paths = [path, ...(root.includes ?? []).map((include: string) => `${path.slice(0, path.lastIndexOf('/'))}/${include}`)]
      if (paths.some(file => expectedFiles[file] !== projectStore.project?.files[file]))
        throw new Error('AUDIO_CONFLICT: The native catalog changed; reload before saving metadata')
      const service = useAudioStore().authoring()
      const current = await service.readProjectAudio()
      const native = current.catalog.assets.find(item => item.id === asset.id)
      if (expectedAsset && (!native || await metadataFingerprint(native) !== await metadataFingerprint(expectedAsset)))
        throw new Error('AUDIO_CONFLICT: The native audio metadata changed; reload before saving')
      await service.updateAsset({ expectedRevision: current.revision, assetId: asset.id, patch: { title: asset.title?.trim() || null, alt: asset.alt?.trim() || null, kind: asset.kind as 'bgm' | 'ambience' | 'sfx' | 'voice' | 'ui' | 'reference', loop: asset.loop, license: asset.license, ...(Object.hasOwn(asset, 'music') ? { music: asset.music ? JSON.parse(JSON.stringify(asset.music)) : null } : {}) } })
      return
    }
    const plan = planAdvAssetManifestUpsert({ files: expectedFiles, rootPath: rootPath(), catalogId: manifest.value?.id ?? 'project', asset, replaceExisting: true })
    await projectStore.writeProjectFiles(Object.entries(plan.writes).map(([path, content]) => ({ path, content, expected: expectedFiles[path] ?? null })))
  }
  async function importFile(file: File, kind: AdvAssetEntry['kind'], characterId?: string, music?: AdvMusicMetadata) {
    const source = projectStore.workspace
    const files = projectStore.project?.files
    const originalProfile = manifest.value?.profiles.local
    const profile = originalProfile ? { ...originalProfile } : undefined
    if (!source?.importAsset || !files)
      throw new Error('Open a writable project first')
    const audioKind = ['bgm', 'ambience', 'sfx', 'voice', 'ui', 'reference'].includes(kind)
    if (audioKind && !useAudioStore().supportedRoot)
      throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Native audio authoring requires the canonical adv content root')
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')
    if (projectStore.workspace !== source)
      throw new Error('ADV_AUDIO_PROJECT_CHANGED: The project changed before imported bytes could be written')
    const suffix = file.name.replace(/[^\p{L}\p{N}._-]/gu, '_')
    const isAudio = file.type.startsWith('audio/') || audioKind
    const id = isAudio ? createAudioId('audio') : `${kind}-${crypto.randomUUID()}`
    // A fresh path avoids collisions and never replaces another shared resource.
    const path = `imports/${id}-${suffix}`
    if (profile && profile.provider !== 'project')
      throw new Error('The local import profile must use project storage')
    const mediaRoot = profile?.root ?? 'adv/assets'
    if (mediaRoot.includes('\\') || /^(?:[a-z]+:|\/)/iu.test(mediaRoot) || mediaRoot.split('/').includes('..'))
      throw new Error('The local import profile must remain inside the project')
    const normalizedRoot = mediaRoot.replace(/^\.\//u, '').replace(/\/$/u, '')
    const diskPath = normalizedRoot ? `${normalizedRoot}/${path}` : path
    if (projectStore.workspace !== source)
      throw new Error('ADV_AUDIO_PROJECT_CHANGED: The project changed before imported bytes could be written')
    await source.importAsset(diskPath, file)
    const audioMimeTypes: Record<string, string> = { wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac', opus: 'audio/ogg' }
    const extension = file.name.split('.').at(-1)?.toLowerCase() ?? ''
    const mimeType = file.type || (isAudio ? audioMimeTypes[extension] : undefined)
    const asset: AdvAssetEntry = { id, kind, type: isAudio ? 'audio' : 'image', path, title: file.name, sha256, bytes: file.size, mimeType, characterId, ...(kind === 'bgm' ? { music: music ? JSON.parse(JSON.stringify(music)) : createMusicMetadata({ usage: 'background', source: { type: 'manual' } }) } : {}) }
    if (asset.music)
      asset.loop = musicPlaybackDefaults(asset.music.usage).loop
    try {
      if (projectStore.workspace !== source)
        throw new Error('项目已切换，导入已取消')
      if (isAudio) {
        const service = useAudioStore().authoring()
        const current = await service.readProjectAudio()
        await service.registerAsset({ expectedRevision: current.revision, asset })
      }
      else { await upsert(asset, files) }
    }
    catch (failure) {
      try {
        await source.removeImportedAsset?.(diskPath, file)
      }
      catch (cleanup) {
        throw new Error(`${String(failure)};
 imported file retained for recovery: ${diskPath};
 ${String(cleanup)}`)
      }
      throw failure
    }
    return { asset, src: `./${diskPath}` }
  }
  async function remove(asset: AdvAssetEntry) {
    if (asset.type === 'audio') {
      const service = useAudioStore().authoring()
      const current = await service.readProjectAudio()
      const preflight = await service.preflightRemoveAsset(asset.id)
      if (preflight.blockingReferences.length)
        throw new Error(`此音频仍被引用，无法移除：${preflight.blockingReferences.map(reference => reference.location).join('；')}`)
      await service.removeAsset({ expectedRevision: current.revision, assetId: asset.id })
      return
    }
    const files = projectStore.project?.files
    if (!files)
      throw new Error('Open a project first')
    const path = rootPath()
    const root = JSON.parse(files[path])
    const paths = Array.isArray(root.includes) ? root.includes.map((include: string) => `${path.slice(0, path.lastIndexOf('/'))}/${include}`) : [path]
    const changes = paths.flatMap((filePath: string) => {
      const document = JSON.parse(files[filePath])
      if (!document.assets?.some((item: AdvAssetEntry) => item.id === asset.id))
        return []
      document.assets = document.assets.filter((item: AdvAssetEntry) => item.id !== asset.id)
      return [{ path: filePath, expected: files[filePath], content: `${JSON.stringify(document, null, 2)}\n` }]
    })
    await projectStore.writeProjectFiles(changes)
    // Binary files may still be referenced by scripts or other characters.
  }
  async function reviewMusic(asset: AdvAssetEntry, status: 'approved' | 'rejected') {
    const service = useAudioStore().authoring()
    const current = await service.readProjectAudio()
    const native = current.catalog.assets.find(item => item.id === asset.id)
    if (!native || await metadataFingerprint(native) !== await metadataFingerprint(asset))
      throw new Error('AUDIO_CONFLICT: The music or permission changed; reload and audition again')
    if (!asset.sha256)
      throw new Error('AUDIO_MUSIC_SHA_REQUIRED: Register the original media SHA-256 first')
    return await service.reviewMusicAsset({ expectedRevision: current.revision, assetId: asset.id, expectedSha256: asset.sha256, status })
  }
  async function url(asset: AdvAssetEntry) {
    if (!manifest.value)
      throw new Error('Asset manifest is missing')
    const catalog = createAdvAssetCatalog(manifest.value, { profile: manifest.value.profiles.local ? 'local' : undefined, adapter: { resolve: async asset => asset.provider === 'project' ? await projectStore.projectAssetUrl(asset.location) : asset.baseUrl ? new URL(asset.location, asset.baseUrl).href : asset.location } })
    return (await catalog.resolve(asset.id)).src
  }
  async function media(asset: AdvAssetEntry) {
    if (!manifest.value)
      throw new Error('Asset manifest is missing')
    let revision = ''
    const catalog = createAdvAssetCatalog(manifest.value, { profile: manifest.value.profiles.local ? 'local' : undefined, adapter: { resolve: async (request) => {
      if (request.provider !== 'project') {
        const src = request.baseUrl ? new URL(request.location, request.baseUrl).href : request.location
        revision = src
        return src
      }
      const source = projectStore.workspace
      if (!source?.readAsset)
        throw new Error('Workspace cannot read media')
      const blob = await source.readAsset(request.location)
      revision = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')
      if (asset.sha256 && revision !== asset.sha256)
        throw new Error('ADV_AUDIO_MEDIA_HASH_MISMATCH: The project media differs from its registered SHA-256')
      return URL.createObjectURL(blob)
    } } })
    return { src: (await catalog.resolve(asset.id)).src, revision }
  }
  return { manifest, audio, error, upsert, importFile, remove, reviewMusic, url, media }
})
