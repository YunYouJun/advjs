import type { AdvCharacter } from '@advjs/types'
import { parseCharacterMd } from '@advjs/parser'
import { onUnmounted, ref } from 'vue'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { buildStreamOptions, streamChat } from '../utils/aiClient'
import { buildImagePromptTemplate, generateImage, isImageGenerationAvailable } from '../utils/aiImageClient'
import { getContentTemplate } from '../utils/contentTemplates'

const FENCE_RE = /```(?:markdown|md)?\n([\s\S]*?)```/

/**
 * Composable for AI-guided player character creation.
 * Wraps streaming generation, markdown parsing, and avatar generation.
 */
export function usePlayerCreator() {
  const isGenerating = ref(false)
  const generatedCharacter = ref<AdvCharacter | null>(null)
  const rawMarkdown = ref('')
  const error = ref<string | null>(null)
  const isGeneratingAvatar = ref(false)

  let abortController: AbortController | null = null
  const aiSettings = useAiSettingsStore()

  /**
   * Generate a character from a natural language description.
   * Streams AI output, then parses the .character.md result.
   */
  async function generate(description: string, lang: string = 'zh') {
    if (isGenerating.value)
      return

    const template = getContentTemplate('character', lang)

    // Prepend player-character context to the system prompt
    const isZh = lang.startsWith('zh')
    const playerContext = isZh
      ? '你现在为用户生成一个「玩家自创角色」。这个角色将由用户本人扮演，请设计一个适合第一人称代入的角色——注重性格特色、可互动性和角色魅力。id 请根据角色名生成合适的英文标识符。\n\n'
      : 'You are generating a "player-created character" for the user to role-play as. Design a character suitable for first-person immersion — focus on personality traits, interactivity, and charm. Generate an appropriate English identifier for the id field.\n\n'

    const systemPrompt = playerContext + template.systemPrompt

    isGenerating.value = true
    rawMarkdown.value = ''
    error.value = null
    generatedCharacter.value = null
    abortController = new AbortController()

    try {
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: description },
      ]

      const options = buildStreamOptions(
        messages,
        aiSettings.config,
        aiSettings.effectiveBaseURL,
        aiSettings.effectiveModel,
        abortController.signal,
      )

      for await (const delta of streamChat(options)) {
        rawMarkdown.value += delta
      }

      // Extract markdown from code fences if present
      const extracted = extractMarkdown(rawMarkdown.value)

      // Parse into AdvCharacter
      generatedCharacter.value = parseCharacterMd(extracted)
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled — not an error
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

  /** Cancel ongoing generation */
  function stop() {
    abortController?.abort()
  }

  /** Reset all state for a fresh start */
  function reset() {
    generatedCharacter.value = null
    rawMarkdown.value = ''
    error.value = null
    isGenerating.value = false
    abortController?.abort()
    abortController = null
  }

  /**
   * Generate an avatar image for a character.
   * Returns the image URL, or copies prompt to clipboard if no image provider is configured.
   */
  async function generateAvatar(character: AdvCharacter): Promise<{ url: string | null, promptCopied: boolean }> {
    const appearance = character.appearance || character.name || ''
    if (!appearance) {
      return { url: null, promptCopied: false }
    }

    const prompt = `character portrait of ${character.name}: ${appearance}, anime style, high quality, detailed`

    if (isImageGenerationAvailable(aiSettings.config)) {
      isGeneratingAvatar.value = true
      try {
        const result = await generateImage(
          {
            prompt,
            negativePrompt: 'low quality, blurry, deformed, ugly, watermark, text',
            width: 512,
            height: 512,
          },
          aiSettings.config,
        )
        return { url: result.url, promptCopied: false }
      }
      finally {
        isGeneratingAvatar.value = false
      }
    }
    else {
      // No image provider — copy prompt template to clipboard
      const template = buildImagePromptTemplate(
        `character portrait of ${character.name}: ${appearance}`,
        'anime',
      )
      await navigator.clipboard.writeText(template.prompt)
      return { url: null, promptCopied: true }
    }
  }

  /** Check if AI is configured */
  function isAiConfigured(): boolean {
    return !!(aiSettings.config.apiKey && aiSettings.effectiveBaseURL && aiSettings.effectiveModel)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    abortController?.abort()
  })

  return {
    isGenerating,
    generatedCharacter,
    rawMarkdown,
    error,
    isGeneratingAvatar,
    generate,
    stop,
    reset,
    generateAvatar,
    isAiConfigured,
  }
}

/** Extract markdown content from AI output (strip code fences) */
function extractMarkdown(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = FENCE_RE.exec(trimmed)
  if (fenceMatch)
    return fenceMatch[1].trim()
  return trimmed
}
