import type { VoiceListeningCandidate, VoiceListeningPlaybackEvent } from '@advjs/audio'
import type { AdvAssetManifest } from '@advjs/types'
import type { Ref } from 'vue'
import { createVoiceListeningPlaybackObserver } from '@advjs/audio'
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { useProjectStore } from '../stores/useProjectStore'
import { readVerifiedVoiceTake } from '../utils/voice-listening-media'

/** A single native player. Seeking and unsupported speeds never credit listening coverage. */
export function useVoiceListeningPlayback(options: {
  catalog: () => AdvAssetManifest
  visible: () => boolean
  player: Ref<HTMLAudioElement | null>
  observe: (sampleId: string, observation: VoiceListeningPlaybackEvent) => void
}) {
  const project = useProjectStore()
  const source = shallowRef('')
  const activeId = shallowRef('')
  const loading = shallowRef(false)
  const error = shallowRef('')
  let sequence = 0
  const observer = createVoiceListeningPlaybackObserver({
    media: () => options.player.value,
    source: () => source.value,
    onPlayback: (event) => {
      if (activeId.value && options.visible())
        options.observe(activeId.value, event)
    },
    onInvalid: (code) => {
      stop()
      error.value = `试听媒体已变化，请重新载入：${code}`
    },
  })

  function stop() {
    sequence++
    observer.reset()
    options.player.value?.pause()
    if (source.value.startsWith('blob:'))
      URL.revokeObjectURL(source.value)
    source.value = ''
    activeId.value = ''
    loading.value = false
  }
  async function load(sampleId: string, candidate: VoiceListeningCandidate) {
    stop()
    error.value = ''
    const workspace = project.workspace
    if (!workspace || candidate.unavailable || !options.visible())
      return
    const request = sequence
    loading.value = true
    try {
      const blob = await readVerifiedVoiceTake(workspace, options.catalog(), candidate)
      if (request !== sequence || project.workspace !== workspace || !options.visible())
        return
      source.value = URL.createObjectURL(blob)
      activeId.value = sampleId
    }
    catch (failure) {
      if (request === sequence)
        error.value = failure instanceof Error ? failure.message : String(failure)
    }
    finally {
      if (request === sequence)
        loading.value = false
    }
  }
  function observe(event: Event) {
    if (!activeId.value || !options.visible())
      return false
    return observer.observe(event)
  }
  function failed() {
    stop()
    error.value = '无法播放此配音，请检查原生媒体并重新载入。'
  }
  function visibilityChanged() {
    if (document.hidden)
      stop()
  }
  watch([() => project.workspace, options.visible, () => project.resourceRevision], stop)
  watch([source, activeId], () => observer.reset(), { flush: 'sync' })
  document.addEventListener('visibilitychange', visibilityChanged)
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', visibilityChanged)
    stop()
  })
  return { source, activeId, loading, error, load, stop, observe, failed }
}
