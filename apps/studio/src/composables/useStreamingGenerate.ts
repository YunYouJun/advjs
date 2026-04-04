import type { Ref } from 'vue'
import { onUnmounted, ref } from 'vue'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { buildStreamOptions, streamChat } from '../utils/aiClient'

export interface StreamingGenerateReturn {
  /** Accumulated streaming output */
  output: Ref<string>
  isGenerating: Ref<boolean>
  error: Ref<string | null>
  /** Run a streaming generation with the given messages */
  run: (messages: Array<{ role: 'system' | 'user', content: string }>) => Promise<void>
  /** Abort current generation */
  stop: () => void
  /** Reset output and error */
  clear: () => void
}

/**
 * Low-level composable for streaming AI text generation.
 * Encapsulates the AbortController lifecycle, buildStreamOptions → streamChat loop,
 * AbortError handling, and onUnmounted cleanup.
 *
 * Used by useAiGenerate and usePlayerCreator to avoid duplicating the streaming core.
 */
export function useStreamingGenerate(): StreamingGenerateReturn {
  const output = ref('')
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  let abortController: AbortController | null = null

  const aiSettings = useAiSettingsStore()

  async function run(messages: Array<{ role: 'system' | 'user', content: string }>) {
    if (isGenerating.value)
      return

    isGenerating.value = true
    output.value = ''
    error.value = null
    abortController = new AbortController()

    try {
      const options = buildStreamOptions(
        messages,
        aiSettings.config,
        aiSettings.effectiveBaseURL,
        aiSettings.effectiveModel,
        abortController.signal,
      )

      for await (const delta of streamChat(options)) {
        output.value += delta
      }
    }
    catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError'))
        error.value = err instanceof Error ? err.message : 'Unknown error'
    }
    finally {
      isGenerating.value = false
      abortController = null
    }
  }

  function stop() {
    abortController?.abort()
  }

  function clear() {
    output.value = ''
    error.value = null
  }

  onUnmounted(() => {
    abortController?.abort()
  })

  return { output, isGenerating, error, run, stop, clear }
}
