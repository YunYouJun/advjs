import type { AudioMixerConfig, VoiceAuthoringSnapshot } from '@advjs/types'
import type { Ref } from 'vue'
import type { StudioAudioMetadata } from '../components/audio/AudioAssetForm.vue'
import { audioProjectMediaPath, createAudioId, voiceAuthoringRevision } from '@advjs/audio'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useStudioStore } from '../stores/useStudioStore'
import { inspectStudioAudioDuration } from '../utils/audioWorkspace'
import { isAudioFile } from '../utils/fs'
import { loadStudioAssetCatalog } from '../utils/projectAssets'
import { useAudioAuthoring } from './useAudioAuthoring'
import { useProjectContent } from './useProjectContent'

/** Project document state and one disposable audition; Ionic pages may stay cached. */
export function useAudioWorkspace(active: Ref<boolean>) {
  const project = useProjectContent()
  const store = useStudioStore()
  const authoring = useAudioAuthoring()
  const snapshot = shallowRef<VoiceAuthoringSnapshot>()
  const mixer = shallowRef<AudioMixerConfig>({ schemaVersion: 1 })
  const revision = shallowRef('')
  const loading = shallowRef(false)
  const busy = shallowRef(false)
  const error = shallowRef('')
  const missingCatalog = shallowRef(false)
  const previewUrl = shallowRef('')
  const previewAssetId = shallowRef('')
  const canEdit = computed(() => Boolean(snapshot.value && !busy.value && !loading.value))
  let loadEpoch = 0
  let previewEpoch = 0
  let disposeCatalog: (() => void) | undefined

  function stopPreview() {
    previewEpoch++
    previewUrl.value = ''
    previewAssetId.value = ''
    disposeCatalog?.()
    disposeCatalog = undefined
  }

  async function reload() {
    const epoch = ++loadEpoch
    loading.value = true
    error.value = ''
    stopPreview()
    try {
      await project.whenReady()
      const fs = project.getFs()
      if (!fs)
        throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
      const exists = await fs.exists('adv/assets.json')
      if (!exists) {
        if (epoch === loadEpoch) {
          missingCatalog.value = !await fs.exists('adv/assets/index.json')
          snapshot.value = undefined
        }
        throw new Error(missingCatalog.value ? 'ADV_AUDIO_CATALOG_REQUIRED' : 'ADV_AUDIO_LEGACY_MIGRATION_REQUIRED')
      }
      if (epoch !== loadEpoch)
        return
      missingCatalog.value = false
      const next = await authoring.forProject().readProjectAudio()
      const voiceRevision = await voiceAuthoringRevision(next.ledger, next.catalog, next.pronunciation, next.voiceProfiles)
      if (epoch !== loadEpoch)
        return
      snapshot.value = { ledger: next.ledger, catalog: next.catalog, pronunciation: next.pronunciation, voiceProfiles: next.voiceProfiles, narratorProfile: next.narratorProfile, revision: voiceRevision }
      mixer.value = next.mixer
      revision.value = next.revision
      project.applyAudioCatalogAssets(next.catalog.assets)
      missingCatalog.value = false
    }
    catch (cause) {
      if (epoch === loadEpoch) {
        error.value = cause instanceof Error ? cause.message : String(cause)
        if (error.value.includes('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')) {
          snapshot.value = undefined
          missingCatalog.value = false
        }
      }
    }
    finally {
      if (epoch === loadEpoch)
        loading.value = false
    }
  }

  async function mutate(operation: () => Promise<unknown>) {
    if (busy.value || loading.value)
      return
    const fs = project.getFs()
    busy.value = true
    error.value = ''
    try {
      await operation()
      if (fs === project.getFs())
        await reload()
    }
    catch (cause) {
      if (fs === project.getFs()) {
        error.value = cause instanceof Error ? cause.message : String(cause)
        if (error.value.includes('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')) {
          snapshot.value = undefined
          missingCatalog.value = false
        }
      }
    }
    finally {
      busy.value = false
    }
  }

  async function preview(assetId: string) {
    stopPreview()
    const epoch = previewEpoch
    const fs = project.getFs()
    if (!fs || !active.value)
      return
    let catalog: Awaited<ReturnType<typeof loadStudioAssetCatalog>> = null
    try {
      catalog = await loadStudioAssetCatalog(fs)
      if (!catalog)
        throw new Error('ADV_AUDIO_CATALOG_REQUIRED')
      const asset = await catalog.resolve(assetId)
      if (epoch !== previewEpoch || !active.value || fs !== project.getFs()) {
        catalog.dispose()
        return
      }
      previewUrl.value = asset.src
      previewAssetId.value = assetId
      disposeCatalog = () => catalog!.dispose()
    }
    catch (cause) {
      catalog?.dispose()
      if (epoch === previewEpoch)
        error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  async function importAsset(data: StudioAudioMetadata, file: File) {
    const fs = project.getFs()
    const current = snapshot.value
    const expectedRevision = revision.value
    if (!fs || !current)
      return
    const service = authoring.forProject()
    await mutate(async () => {
      if (!isAudioFile(file.name) || !file.size)
        throw new Error('ADV_AUDIO_FILE_INVALID: Choose a non-empty audio file')
      const assetId = createAudioId('audio')
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      const staging = `adv/audio/.staging/${assetId}${extension}`
      const bytes = await file.arrayBuffer()
      const duration = await inspectStudioAudioDuration(file)
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
      const mimeTypes: Record<string, string> = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.webm': 'audio/webm' }
      const asset = { id: assetId, type: 'audio' as const, kind: data.kind, labels: data.labels, loop: data.loop, ...(data.license ? { license: data.license } : {}), ...(duration ? { duration } : {}), title: data.title || file.name, path: `audio/${assetId}${extension}`, mimeType: file.type || mimeTypes[extension], bytes: bytes.byteLength, sha256, source: { type: 'original' } }
      audioProjectMediaPath(current.catalog, asset)
      await fs.writeBlob(staging, file)
      try {
        await service.importAsset({ expectedRevision, asset, source: { path: staging, sha256, bytes: bytes.byteLength } })
      }
      finally {
        await fs.deleteFile(staging)
      }
    })
  }

  function updateAsset(assetId: string, patch: StudioAudioMetadata) {
    const expectedRevision = revision.value
    const service = authoring.forProject()
    return mutate(() => service.updateAsset({ expectedRevision, assetId, patch: { ...patch, title: patch.title || null, license: patch.license || null } }))
  }

  function removeAsset(assetId: string) {
    const expectedRevision = revision.value
    const service = authoring.forProject()
    return mutate(async () => {
      const preflight = await service.preflightRemoveAsset(assetId)
      if (preflight.blockingReferences.length)
        throw new Error(`ADV_AUDIO_IN_USE: ${JSON.stringify(preflight.blockingReferences)}`)
      await service.removeAsset({ expectedRevision, assetId })
    })
  }

  function select(lineId: string, locale: string, takeId: string | null, replaceSelected: boolean) {
    const expectedRevision = snapshot.value?.revision
    if (!expectedRevision)
      return
    const service = authoring.forProject()
    return mutate(() => service.select({ lineId, locale, takeId, expectedRevision, replaceSelected }))
  }

  function saveMixer(value: AudioMixerConfig) {
    const expectedRevision = revision.value
    const service = authoring.forProject()
    return mutate(() => service.saveMixer({ expectedRevision, mixer: value }))
  }

  watch(() => store.currentProjectId, () => {
    snapshot.value = undefined
    missingCatalog.value = false
    void reload()
  }, { immediate: true })
  watch(active, (value) => {
    if (!value)
      stopPreview()
    else
      void reload()
  })
  onScopeDispose(() => {
    loadEpoch++
    stopPreview()
  })

  return { snapshot, mixer, revision, loading, busy, error, missingCatalog, previewUrl, previewAssetId, canEdit, canSynthesize: authoring.canSynthesize, reload, preview, stopPreview, importAsset, updateAsset, removeAsset, select, saveMixer, initialize: () => mutate(() => authoring.initialize(store.currentProjectId)) }
}
