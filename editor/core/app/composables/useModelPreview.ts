import { computed, ref, shallowRef, watch } from 'vue'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
interface ModelViewerRequest {
  key: number
  src: string
  loaded: () => void
  failed: () => void
}

export function modelPreviewFormat(src: string, type: string) {
  const explicit = type.trim()
  if (explicit)
    return explicit.toLowerCase()
  return src.split(/[?#]/u)[0]?.split('.').at(-1)?.toLowerCase() ?? ''
}

/** Owns one preview attempt; stale imports, fetches and element events cannot update it. */
export function useModelPreview(source: () => string, type: () => string, loadViewer = async (src: string, retry: boolean) => {
  await import('@google/model-viewer')
  await customElements.whenDefined('model-viewer')
  if (retry) {
    // model-viewer 4 caches an empty model after a failed fetch. Evict only this URL;
    // changing its query to bypass the cache would break signed model URLs.
    const { CachingGLTFLoader } = await import('@google/model-viewer/lib/three-components/CachingGLTFLoader.js')
    // The key is removed before disposal. The failed placeholder has no scene to
    // dispose, so its upstream dispose() can throw after the cache is cleared.
    await CachingGLTFLoader.delete(src).catch(() => {})
  }
}) {
  const format = computed(() => modelPreviewFormat(source(), type()))
  const supported = computed(() => ['gltf', 'glb'].includes(format.value))
  const attempt = ref(0)
  const modelState = ref<LoadState>('idle')
  const jsonState = ref<LoadState>('idle')
  const jsonContent = ref('')
  const jsonError = ref('')
  const viewer = shallowRef<ModelViewerRequest>()
  let generation = 0

  watch([source, format, attempt], ([src, fileFormat], _, onCleanup) => {
    const current = ++generation
    const controller = new AbortController()
    const active = () => current === generation && !controller.signal.aborted
    onCleanup(() => controller.abort())
    viewer.value = undefined
    jsonContent.value = ''
    jsonError.value = ''
    modelState.value = src && supported.value ? 'loading' : 'idle'
    jsonState.value = src && fileFormat === 'gltf' ? 'loading' : 'idle'
    if (!src || !supported.value)
      return

    void loadViewer(src, attempt.value > 0).then(() => {
      if (!active())
        return
      viewer.value = {
        key: current,
        src,
        loaded: () => {
          if (active())
            modelState.value = 'ready'
        },
        failed: () => {
          if (active())
            modelState.value = 'error'
        },
      }
    }).catch(() => {
      if (active())
        modelState.value = 'error'
    })

    // GLB is binary. Only a glTF document has a readable JSON source pane.
    if (fileFormat === 'gltf') {
      void fetch(src, { signal: controller.signal }).then(async (response) => {
        if (!response.ok)
          throw new Error(`HTTP ${response.status}`)
        const json = await response.json()
        if (active()) {
          jsonContent.value = JSON.stringify(json, null, 2)
          jsonState.value = 'ready'
        }
      }).catch((error: unknown) => {
        if (active()) {
          jsonError.value = error instanceof Error ? error.message : String(error)
          jsonState.value = 'error'
        }
      })
    }
  }, { immediate: true })

  function retry() {
    attempt.value++
  }

  return { format, supported, modelState, jsonState, jsonContent, jsonError, viewer, retry }
}
