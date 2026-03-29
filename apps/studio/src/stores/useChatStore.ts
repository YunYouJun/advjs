import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import { AiApiError, buildStreamOptions, streamChat } from '../utils/aiClient'
import { buildImagePromptTemplate, detectImageIntent } from '../utils/aiImageClient'
import { downloadFromCloud } from '../utils/cloudSync'
import { readFileFromDir } from '../utils/fileAccess'
import { useAiSettingsStore } from './useAiSettingsStore'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const projectContext = ref('')
  const streamingContent = ref('')
  const currentAbortController = ref<AbortController | null>(null)

  async function sendMessage(content: string) {
    messages.value.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    })

    const aiSettings = useAiSettingsStore()

    // If AI is not configured, provide a helpful fallback
    if (!aiSettings.isConfigured) {
      isLoading.value = true
      setTimeout(() => {
        messages.value.push({
          role: 'assistant',
          content: i18n.global.t('chat.aiNotConfiguredMessage'),
          timestamp: Date.now(),
        })
        isLoading.value = false
      }, 300)
      return
    }

    // Check for image generation intent
    if (detectImageIntent(content)) {
      await handleImageIntent(content)
      return
    }

    isLoading.value = true
    streamingContent.value = ''

    // Build message history for the API
    const systemMessages: AiChatMessage[] = []
    if (aiSettings.config.systemPrompt) {
      let systemContent = aiSettings.config.systemPrompt
      if (projectContext.value)
        systemContent += `\n\n# Project Context\n${projectContext.value}`

      systemMessages.push({ role: 'system', content: systemContent })
    }

    const chatHistory: AiChatMessage[] = messages.value.map(m => ({
      role: m.role,
      content: m.content,
    }))

    const allMessages = [...systemMessages, ...chatHistory]

    // Create abort controller for cancellation
    const abortController = new AbortController()
    currentAbortController.value = abortController

    // Add a placeholder message for streaming
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    messages.value.push(assistantMsg)
    const msgIndex = messages.value.length - 1

    try {
      const options = buildStreamOptions(
        allMessages,
        aiSettings.config,
        aiSettings.effectiveBaseURL,
        aiSettings.effectiveModel,
        abortController.signal,
      )

      let accumulated = ''
      for await (const delta of streamChat(options)) {
        accumulated += delta
        streamingContent.value = accumulated
        // Directly assign content to avoid creating a new object on every delta
        messages.value[msgIndex].content = accumulated
      }

      streamingContent.value = ''
    }
    catch (err) {
      streamingContent.value = ''

      let errorMessage: string
      if (err instanceof AiApiError) {
        switch (err.type) {
          case 'auth':
            errorMessage = i18n.global.t('chat.errorAuth')
            break
          case 'rate_limit':
            errorMessage = i18n.global.t('chat.errorRateLimit')
            break
          case 'network':
            errorMessage = i18n.global.t('chat.errorNetwork')
            break
          case 'timeout':
            errorMessage = i18n.global.t('chat.errorTimeout')
            break
          default:
            errorMessage = i18n.global.t('chat.errorGeneric', { message: err.message })
        }
      }
      else if (err instanceof DOMException && err.name === 'AbortError') {
        errorMessage = i18n.global.t('chat.errorAborted')
      }
      else {
        errorMessage = i18n.global.t('chat.errorUnexpected', { message: err instanceof Error ? err.message : 'Unknown error' })
      }

      messages.value[msgIndex] = {
        ...messages.value[msgIndex],
        content: messages.value[msgIndex].content || errorMessage,
      }
    }
    finally {
      isLoading.value = false
      currentAbortController.value = null
    }
  }

  async function handleImageIntent(content: string) {
    isLoading.value = true

    const aiSettings = useAiSettingsStore()

    // If no image provider configured, generate prompt template
    if (aiSettings.config.imageProvider === 'none') {
      const template = buildImagePromptTemplate(content, 'anime')
      const response = `🎨 **Image Generation Prompt**

I've prepared prompt templates for you to use with various platforms:

**Universal Prompt:**
\`\`\`
${template.prompt}
\`\`\`

**Negative Prompt:**
\`\`\`
${template.negativePrompt}
\`\`\`

---

**Platform-specific prompts:**

<details>
<summary>🟣 豆包 (Doubao)</summary>

\`\`\`
${template.platforms.doubao}
\`\`\`
</details>

<details>
<summary>🔵 元宝 (Yuanbao)</summary>

\`\`\`
${template.platforms.yuanbao}
\`\`\`
</details>

<details>
<summary>🟡 MidJourney</summary>

\`\`\`
${template.platforms.midjourney}
\`\`\`
</details>

<details>
<summary>🟢 Stable Diffusion</summary>

\`\`\`
${template.platforms.stableDiffusion}
\`\`\`
</details>

---

💡 **Tip**: Copy the prompt for your preferred platform, generate the image there, then upload it back to your project's \`assets/images/\` folder.

To enable direct image generation, configure an image provider in **Settings → AI Provider → Image Generation**.`

      messages.value.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      })
      isLoading.value = false
      return
    }

    // TODO: When image providers are implemented, call generateImage() here
    messages.value.push({
      role: 'assistant',
      content: '🎨 Image generation via API is coming soon! For now, please use the prompt templates above with external tools.',
      timestamp: Date.now(),
    })
    isLoading.value = false
  }

  function stopGeneration() {
    if (currentAbortController.value) {
      currentAbortController.value.abort()
      currentAbortController.value = null
    }
  }

  function clearMessages() {
    messages.value = []
    streamingContent.value = ''
    stopGeneration()
  }

  async function loadProjectContext(dirHandle: FileSystemDirectoryHandle) {
    try {
      const parts: string[] = []

      // Read all context files in parallel (mirrors MCP Server resources)
      const reads = await Promise.allSettled([
        readFileFromDir(dirHandle, 'adv/world.md'),
        readFileFromDir(dirHandle, 'adv/outline.md'),
        readFileFromDir(dirHandle, 'adv/glossary.md'),
        readFileFromDir(dirHandle, 'adv/characters/README.md'),
        readFileFromDir(dirHandle, 'adv/chapters/README.md'),
        readFileFromDir(dirHandle, 'adv/scenes/README.md'),
      ])

      const [world, outline, glossary, chars, chapters, scenes] = reads.map(
        r => r.status === 'fulfilled' ? r.value : '',
      )

      if (world)
        parts.push(`## World Setting\n${world}`)
      if (outline)
        parts.push(`## Story Outline\n${outline}`)
      if (chapters)
        parts.push(`## Chapters\n${chapters}`)
      if (chars)
        parts.push(`## Characters\n${chars}`)
      if (scenes)
        parts.push(`## Scenes\n${scenes}`)
      if (glossary)
        parts.push(`## Glossary\n${glossary}`)

      projectContext.value = parts.join('\n\n')
    }
    catch {
      projectContext.value = ''
    }
  }

  /**
   * Load project context from COS cloud storage.
   * Mirrors loadProjectContext but reads from COS instead of local FS.
   */
  async function loadProjectContextFromCos(
    cosConfig: { bucket: string, region: string, secretId: string, secretKey: string },
    prefix: string,
  ) {
    try {
      const parts: string[] = []

      const reads = await Promise.allSettled([
        downloadFromCloud(cosConfig, `${prefix}adv/world.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/outline.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/glossary.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/characters/README.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/chapters/README.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/scenes/README.md`),
      ])

      const [world, outline, glossary, chars, chapters, scenes] = reads.map(
        r => r.status === 'fulfilled' ? r.value : '',
      )

      if (world)
        parts.push(`## World Setting\n${world}`)
      if (outline)
        parts.push(`## Story Outline\n${outline}`)
      if (chapters)
        parts.push(`## Chapters\n${chapters}`)
      if (chars)
        parts.push(`## Characters\n${chars}`)
      if (scenes)
        parts.push(`## Scenes\n${scenes}`)
      if (glossary)
        parts.push(`## Glossary\n${glossary}`)

      projectContext.value = parts.join('\n\n')
    }
    catch {
      projectContext.value = ''
    }
  }

  return {
    messages,
    isLoading,
    projectContext,
    streamingContent,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadProjectContext,
    loadProjectContextFromCos,
  }
})
