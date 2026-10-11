import type { VoiceAuthoringAdapter } from '@advjs/types'
import type { EditorVoiceJobsPort } from '../../../../packages/advjs/shared/editor-audio'
import { parseAudioMixerConfig } from '@advjs/audio'
import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'
import { createEditorAudioService } from '../workspaces/audio'
import { useProjectStore } from './useProjectStore'

export const useAudioStore = defineStore('editor:audio', () => {
  const project = useProjectStore()
  const synthesisTransport = shallowRef<VoiceAuthoringAdapter['synthesize']>()
  const voiceJobsTransport = shallowRef<EditorVoiceJobsPort>()
  const supportedRoot = computed(() => project.project?.compilation.project.root === 'adv')
  const canSynthesize = computed(() => supportedRoot.value && Boolean(synthesisTransport.value))
  watch(() => project.workspace, () => {
    synthesisTransport.value = undefined
    voiceJobsTransport.value = undefined
  })
  /**
   * 背景音乐库地址
   */
  const bgmLibraryUrl = useStorage('ae:bgm-library-url', '')
  const bgmLibraryData = useStorage<Record<string, { name: string, description: string }>>('ae:bgm-library-data', {})
  function assertSupportedRoot() {
    if (!supportedRoot.value)
      throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Native audio authoring requires the canonical adv content root')
  }

  return {
    authoring() {
      const workspace = project.workspace
      if (!workspace)
        throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
      assertSupportedRoot()
      return createEditorAudioService(workspace, synthesisTransport.value, async (changes) => {
        if (project.workspace !== workspace)
          throw new Error('ADV_AUDIO_PROJECT_CHANGED: Reload audio after switching projects')
        return await project.writeProjectFiles(changes)
      })
    },
    canSynthesize,
    supportedRoot,
    setSynthesisTransport(transport?: VoiceAuthoringAdapter['synthesize']) {
      synthesisTransport.value = transport
    },
    voiceJobs() {
      assertSupportedRoot()
      return voiceJobsTransport.value ?? project.workspace?.voiceJobs
    },
    /** Hosted execution is available only through an explicitly configured host service. */
    setVoiceJobsTransport(transport?: EditorVoiceJobsPort) {
      voiceJobsTransport.value = transport
    },
    async initializeCatalog() {
      const model = project.project
      if (!model)
        throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
      assertSupportedRoot()
      const root = model.compilation.project.root
      const path = `${root}/assets.json`
      if (Object.hasOwn(model.files, path))
        throw new Error('ADV_AUDIO_CATALOG_EXISTS: Repair or reload the existing native catalog')
      await project.writeProjectFiles([{ path, expected: null, content: `${JSON.stringify({ schemaVersion: 2, id: `${model.compilation.project.id}-assets`, defaultProfile: 'local', profiles: { local: { provider: 'project', root: `${root}/assets` } }, assets: [] }, null, 2)}\n` }])
    },
    async saveMixer(path: string, draft: string, expected: string | null) {
      assertSupportedRoot()
      const mixer = parseAudioMixerConfig(JSON.parse(draft))
      const workspace = project.workspace
      if (!workspace)
        throw new Error('ADV_AUDIO_PROJECT_REQUIRED')
      const service = createEditorAudioService(workspace, undefined, async (changes) => {
        if (project.workspace !== workspace)
          throw new Error('ADV_AUDIO_PROJECT_CHANGED: Reload audio after switching projects')
        if (changes.find(change => change.path === path)?.expected !== expected)
          throw new Error('AUDIO_CONFLICT: The mixer document changed; reload before saving')
        await project.writeProjectFiles(changes)
      })
      const snapshot = await service.readProjectAudio()
      await service.saveMixer({ expectedRevision: snapshot.revision, mixer })
    },
    bgmLibraryUrl,
    bgmLibraryData,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAudioStore, import.meta.hot))
