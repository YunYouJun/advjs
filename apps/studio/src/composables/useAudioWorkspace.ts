import type { VoiceReviewContext } from '@advjs/audio'
import type { AudioMixerConfig, VoiceAuthoringSnapshot } from '@advjs/types'
import type { Ref } from 'vue'
import type { StudioAudioMetadata } from '../components/audio/AudioAssetForm.vue'
import { audioProjectMediaPath, createAudioId, verifyVoiceCandidateBytes, voiceAuthoringRevision, voiceReviewContextFromProgram } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
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
  const auth = useAuthStore()
  const authoring = useAudioAuthoring()
  const snapshot = shallowRef<VoiceAuthoringSnapshot>()
  const reviewContext = shallowRef<VoiceReviewContext>({})
  const nativeProjectId = shallowRef('')
  const mixer = shallowRef<AudioMixerConfig>({ schemaVersion: 1 })
  const revision = shallowRef('')
  const loading = shallowRef(false)
  const busy = shallowRef(false)
  const error = shallowRef('')
  const missingCatalog = shallowRef(false)
  const previewUrl = shallowRef('')
  const previewAssetId = shallowRef('')
  const fsScope = shallowRef(0)
  let currentFs: ReturnType<typeof project.getFs>
  const scopeKey = computed(() => `${auth.userId || 'local-device'}/${store.currentProjectId}/${fsScope.value}`)
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
      if (fs !== currentFs) {
        currentFs = fs
        fsScope.value++
      }
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
      const { project: compiled } = await compileProject({ files: Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content])) }, { allowEmptyAssetManifest: true })
      const context = voiceReviewContextFromProgram(compiled.program, Object.fromEntries(compiled.characters.map(character => [character.id, character.voiceProfile])), String(compiled.game.locale ?? 'zh-CN'))
      const voiceRevision = await voiceAuthoringRevision(next.ledger, next.catalog, next.pronunciation, next.voiceProfiles)
      if (epoch !== loadEpoch)
        return
      snapshot.value = { ledger: next.ledger, catalog: next.catalog, pronunciation: next.pronunciation, voiceProfiles: next.voiceProfiles, narratorProfile: next.narratorProfile, revision: voiceRevision }
      reviewContext.value = context
      nativeProjectId.value = compiled.id
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

  async function preview(assetId: string, expectedSha256?: string) {
    stopPreview()
    error.value = ''
    const epoch = previewEpoch
    const fs = project.getFs()
    if (!fs || !active.value)
      return
    let catalog: Awaited<ReturnType<typeof loadStudioAssetCatalog>> = null
    try {
      catalog = await loadStudioAssetCatalog(fs)
      if (!catalog)
        throw new Error('ADV_AUDIO_CATALOG_REQUIRED')
      let src: string
      let disposeMedia: (() => void) | undefined
      if (expectedSha256) {
        const asset = catalog.get(assetId)
        const current = snapshot.value
        if (!asset || asset.kind !== 'voice' || asset.sha256 !== expectedSha256 || !current)
          throw new Error('VOICE_AUDIO_CHANGED')
        const blob = await fs.readBlob(audioProjectMediaPath(current.catalog, asset))
        if (blob.size > 64 * 1024 * 1024)
          throw new Error('VOICE_AUDIO_TOO_LARGE')
        await verifyVoiceCandidateBytes({ sha256: expectedSha256, bytes: asset.bytes }, await blob.arrayBuffer())
        if (epoch !== previewEpoch || !active.value || fs !== project.getFs()) {
          catalog.dispose()
          return
        }
        src = URL.createObjectURL(blob)
        disposeMedia = () => URL.revokeObjectURL(src)
      }
      else {
        src = (await catalog.resolve(assetId)).src
      }
      if (epoch !== previewEpoch || !active.value || fs !== project.getFs()) {
        disposeMedia?.()
        catalog.dispose()
        return
      }
      previewUrl.value = src
      previewAssetId.value = assetId
      disposeCatalog = () => {
        disposeMedia?.()
        catalog!.dispose()
      }
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

  async function verifyRetained(input: { lineId: string, locale: string, takeId: string, expectedRevision: string }) {
    if (busy.value || loading.value || !active.value || snapshot.value?.revision !== input.expectedRevision)
      return false
    const fs = project.getFs()
    const scope = scopeKey.value
    const context = JSON.stringify(reviewContext.value)
    const service = authoring.forProject()
    const valid = () => active.value && scope === scopeKey.value && fs === project.getFs() && snapshot.value?.revision === input.expectedRevision
    busy.value = true
    error.value = ''
    try {
      if (!service.verifyTake || !fs)
        throw new Error('VOICE_AUDIO_VERIFICATION_REQUIRED')
      if ((await service.read()).revision !== input.expectedRevision || !valid())
        throw new Error('VOICE_CONFLICT')
      await service.verifyTake(input)
      const current = await service.read()
      const { project: compiled } = await compileProject({ files: Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content])) }, { allowEmptyAssetManifest: true })
      const currentContext = voiceReviewContextFromProgram(compiled.program, Object.fromEntries(compiled.characters.map(character => [character.id, character.voiceProfile])), String(compiled.game.locale ?? 'zh-CN'))
      if (!valid() || current.revision !== input.expectedRevision || JSON.stringify(currentContext) !== context)
        throw new Error('VOICE_CONFLICT')
      return true
    }
    catch (cause) {
      if (valid())
        error.value = cause instanceof Error ? cause.message : 'VOICE_AUDIO_VERIFICATION_REQUIRED'
      return false
    }
    finally {
      if (scope === scopeKey.value)
        busy.value = false
    }
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
  watch(scopeKey, () => {
    busy.value = false
  }, { flush: 'sync' })
  watch(active, (value) => {
    if (!value)
      stopPreview()
    else
      void reload()
  })
  watch(() => auth.userId, () => {
    loadEpoch++
    stopPreview()
    snapshot.value = undefined
    if (active.value)
      void reload()
  }, { flush: 'sync' })
  watch(() => project.isLoading?.value, (value, previous) => {
    if (value) {
      loadEpoch++
      stopPreview()
    }
    else if (previous && active.value) {
      void reload()
    }
  }, { flush: 'sync' })
  onScopeDispose(() => {
    loadEpoch++
    stopPreview()
  })

  return { snapshot, reviewContext, nativeProjectId, scopeKey, mixer, revision, loading, busy, error, missingCatalog, previewUrl, previewAssetId, canEdit, canSynthesize: authoring.canSynthesize, reload, preview, stopPreview, importAsset, updateAsset, removeAsset, select, verifyRetained, saveMixer, initialize: () => mutate(() => authoring.initialize(store.currentProjectId)) }
}
