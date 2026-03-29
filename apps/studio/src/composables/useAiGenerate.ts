import type { ContentType } from './useContentEditor'
import { onUnmounted, ref } from 'vue'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { buildStreamOptions, streamChat } from '../utils/aiClient'
import { getContentTemplate } from '../utils/contentTemplates'

const FENCE_RE = /```(?:markdown|md)?\n([\s\S]*?)```/

/**
 * AI content generation composable
 * Builds context-aware prompts and streams AI output
 */
export function useAiGenerate(contentType: ContentType) {
  const output = ref('')
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  let abortController: AbortController | null = null

  const aiSettings = useAiSettingsStore()

  function getSuggestions(lang: string = 'zh'): string[] {
    return getContentTemplate(contentType, lang).suggestions
  }

  async function generate(userPrompt: string, lang: string = 'zh') {
    if (isGenerating.value)
      return

    const template = getContentTemplate(contentType, lang)

    isGenerating.value = true
    output.value = ''
    error.value = null
    abortController = new AbortController()

    try {
      const messages = [
        { role: 'system' as const, content: template.systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ]

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
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled
      }
      else {
        error.value = err instanceof Error ? err.message : 'Unknown error'
      }
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

  /**
   * Extract markdown content from AI output (strip code fences)
   */
  function extractMarkdown(): string {
    let text = output.value.trim()

    // Try to extract from ```markdown ... ``` block
    const fenceMatch = FENCE_RE.exec(text)
    if (fenceMatch) {
      text = fenceMatch[1].trim()
    }

    return text
  }

  // Cancel any ongoing generation when the component unmounts
  onUnmounted(() => {
    abortController?.abort()
  })

  return {
    output,
    isGenerating,
    error,
    getSuggestions,
    generate,
    stop,
    clear,
    extractMarkdown,
  }
}
