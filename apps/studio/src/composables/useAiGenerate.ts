import type { ContentType } from './useContentEditor'
import { extractMarkdown } from '../utils/chatUtils'
import { getContentTemplate } from '../utils/contentTemplates'
import { useStreamingGenerate } from './useStreamingGenerate'

/**
 * AI content generation composable
 * Builds context-aware prompts and streams AI output
 */
export function useAiGenerate(contentType: ContentType) {
  const streaming = useStreamingGenerate()

  function getSuggestions(lang: string = 'zh'): string[] {
    return getContentTemplate(contentType, lang).suggestions
  }

  async function generate(userPrompt: string, lang: string = 'zh') {
    const template = getContentTemplate(contentType, lang)

    const messages = [
      { role: 'system' as const, content: template.systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ]

    await streaming.run(messages)
  }

  return {
    output: streaming.output,
    isGenerating: streaming.isGenerating,
    error: streaming.error,
    getSuggestions,
    generate,
    stop: streaming.stop,
    clear: streaming.clear,
    extractMarkdown: () => extractMarkdown(streaming.output.value),
  }
}
