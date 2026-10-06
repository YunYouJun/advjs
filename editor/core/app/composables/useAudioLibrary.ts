import { onScopeDispose, ref } from 'vue'

export interface AudioLibraryEntry { name: string, description: string }
export type AudioLibrary = Record<string, AudioLibraryEntry>

export function parseAudioLibrary(value: unknown): AudioLibrary {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid audio library')
  const entries = Object.entries(value).map(([key, item]) => {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim()
      || (item.description !== undefined && typeof item.description !== 'string')) {
      throw new Error('Invalid audio library entry')
    }
    return [key, { name: item.name.trim(), description: item.description ?? '' }]
  })
  return Object.fromEntries(entries)
}

export function audioLibrarySrc(prefix: string | undefined, name: string) {
  return `${(prefix || 'https://cos.advjs.yunle.fun').replace(/\/+$/, '')}/bgms/library/${encodeURIComponent(name)}.mp3`
}

/** Latest request wins; failed or superseded requests never replace the saved library. */
export function useAudioLibrary(onLoaded: (data: AudioLibrary, url: string) => void) {
  const loading = ref(false)
  const failed = ref(false)
  let controller: AbortController | undefined
  function cancel() {
    controller?.abort()
    controller = undefined
    loading.value = false
  }
  async function load(source: string) {
    const url = source.trim()
    cancel()
    failed.value = false
    if (!url)
      return
    const request = new AbortController()
    controller = request
    loading.value = true
    try {
      const response = await fetch(url, { signal: request.signal })
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`)
      const data = parseAudioLibrary(await response.json())
      if (controller === request)
        onLoaded(data, url)
    }
    catch {
      if (controller === request)
        failed.value = true
    }
    finally {
      if (controller === request) {
        loading.value = false
        controller = undefined
      }
    }
  }
  onScopeDispose(cancel)
  return { load, cancel, loading, failed }
}
