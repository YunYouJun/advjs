import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { buildImagePromptTemplate, detectImageIntent } from '../utils/aiImageClient'
import { abortAndClear, pushNotConfiguredFallback, streamToMessage } from '../utils/chatUtils'
import { downloadFromCloud } from '../utils/cloudSync'
import { db } from '../utils/db'
import { readFileFromDir } from '../utils/fileAccess'
import { assembleProjectContext } from '../utils/projectContext'
import { useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'
import { useAiSettingsStore } from './useAiSettingsStore'
import { useWorldClockStore } from './useWorldClockStore'
import { useWorldEventStore } from './useWorldEventStore'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** Max messages to persist (older messages trimmed on save) */
const MAX_STORED_MESSAGES = 100
/** When trimming, keep only the most recent N messages */
const TRIM_TO = 60

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const projectContext = ref('')
  const streamingContent = ref('')
  const currentAbortController = ref<AbortController | null>(null)

  // --- Dexie persistence ---

  const { flush, init, $reset: _persistReset } = useProjectPersistence({
    source: messages,
    save: async () => {
      const pid = getCurrentProjectId()
      const toSave = messages.value.length > MAX_STORED_MESSAGES
        ? messages.value.slice(-TRIM_TO)
        : messages.value
      const rows = toSave.map((m, i) => ({
        projectId: pid,
        id: `${m.timestamp}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }))
      await db.transaction('rw', db.chatMessages, async () => {
        const existing = await db.chatMessages.where('projectId').equals(pid).primaryKeys()
        await db.chatMessages.bulkDelete(existing)
        await db.chatMessages.bulkPut(rows)
      })
    },
    load: async (pid) => {
      const rows = await db.chatMessages
        .where('projectId')
        .equals(pid)
        .sortBy('timestamp')
      if (rows.length > 0) {
        messages.value = rows.map(r => ({
          role: r.role,
          content: r.content,
          timestamp: r.timestamp,
        }))
      }
    },
    clear: () => {
      stopGeneration()
      messages.value = []
      projectContext.value = ''
      streamingContent.value = ''
    },
  })

  function $reset() {
    _persistReset()
  }

  async function sendMessage(content: string) {
    messages.value.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    })

    const aiSettings = useAiSettingsStore()

    // If AI is not configured, provide a helpful fallback
    if (!aiSettings.isConfigured) {
      pushNotConfiguredFallback(messages.value, isLoading)
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

      const clockStore = useWorldClockStore()
      const eventStore = useWorldEventStore()
      const clockPrompt = clockStore.formatClockForPrompt()
      const eventsPrompt = eventStore.formatEventsForPrompt()
      if (clockPrompt)
        systemContent += `\n\n${clockPrompt}`
      if (eventsPrompt)
        systemContent += `\n\n${eventsPrompt}`

      systemMessages.push({ role: 'system', content: systemContent })
    }

    const chatHistory: AiChatMessage[] = messages.value.map(m => ({
      role: m.role,
      content: m.content,
    }))

    const allMessages = [...systemMessages, ...chatHistory]

    await streamToMessage({
      allMessages,
      messageList: messages.value,
      placeholderRole: 'assistant',
      streamingContent,
      isLoading,
      currentAbortController,
    })

    flush().catch(() => {})
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
    abortAndClear(currentAbortController)
  }

  function clearMessages() {
    messages.value = []
    streamingContent.value = ''
    stopGeneration()
  }

  async function loadProjectContext(dirHandle: FileSystemDirectoryHandle) {
    try {
      projectContext.value = await assembleProjectContext(
        path => readFileFromDir(dirHandle, path),
      )
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
      projectContext.value = await assembleProjectContext(
        path => downloadFromCloud(cosConfig, `${prefix}${path}`),
      )
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
    $reset,
    flush,
    init,
  }
})
