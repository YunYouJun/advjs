import type { AdvCharacter } from '@advjs/types'
import { parseCharacterMd } from '@advjs/parser'
import { ref } from 'vue'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { buildImagePromptTemplate, generateImage, isImageGenerationAvailable } from '../utils/aiImageClient'
import { extractMarkdown } from '../utils/chatUtils'
import { getContentTemplate } from '../utils/contentTemplates'
import { useStreamingGenerate } from './useStreamingGenerate'

/**
 * Composable for AI-guided player character creation.
 * Wraps streaming generation, markdown parsing, and avatar generation.
 */
export function usePlayerCreator() {
  const streaming = useStreamingGenerate()
  const generatedCharacter = ref<AdvCharacter | null>(null)
  const isGeneratingAvatar = ref(false)

  const aiSettings = useAiSettingsStore()

  /**
   * Generate a character from a natural language description.
   * Streams AI output, then parses the .character.md result.
   */
  async function generate(description: string, lang: string = 'zh') {
    const template = getContentTemplate('character', lang)

    // Prepend player-character context to the system prompt
    const isZh = lang.startsWith('zh')
    const playerContext = isZh
      ? '你现在为用户生成一个「玩家自创角色」。这个角色将由用户本人扮演，请设计一个适合第一人称代入的角色——注重性格特色、可互动性和角色魅力。id 请根据角色名生成合适的英文标识符。\n\n'
      : 'You are generating a "player-created character" for the user to role-play as. Design a character suitable for first-person immersion — focus on personality traits, interactivity, and charm. Generate an appropriate English identifier for the id field.\n\n'

    const systemPrompt = playerContext + template.systemPrompt

    generatedCharacter.value = null

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: description },
    ]

    await streaming.run(messages)

    // Post-process: extract markdown and parse into AdvCharacter (only if no error)
    if (!streaming.error.value && streaming.output.value) {
      const extracted = extractMarkdown(streaming.output.value)
      generatedCharacter.value = parseCharacterMd(extracted)
    }
  }

  /** Cancel ongoing generation */
  function stop() {
    streaming.stop()
  }

  /** Reset all state for a fresh start */
  function reset() {
    generatedCharacter.value = null
    streaming.stop()
    streaming.clear()
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

  return {
    isGenerating: streaming.isGenerating,
    generatedCharacter,
    rawMarkdown: streaming.output,
    error: streaming.error,
    isGeneratingAvatar,
    generate,
    stop,
    reset,
    generateAvatar,
    isAiConfigured,
  }
}
