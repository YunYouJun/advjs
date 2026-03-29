import type { AdvCharacter } from '@advjs/types'
import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import { exportCharacterForAI } from '@advjs/parser'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import i18n from '../i18n'
import { AiApiError, buildStreamOptions, streamChat } from '../utils/aiClient'
import { useAiSettingsStore } from './useAiSettingsStore'
import { useCharacterMemoryStore } from './useCharacterMemoryStore'
import { useCharacterStateStore } from './useCharacterStateStore'
import { useWorldClockStore } from './useWorldClockStore'
import { useWorldEventStore } from './useWorldEventStore'

export interface CharacterChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface CharacterConversation {
  characterId: string
  messages: CharacterChatMessage[]
  /** AI-generated summary of older messages that were trimmed */
  contextSummary?: string
}

const STORAGE_KEY = 'advjs-studio-character-chats'
/** Always keep the first N messages for initial context */
const KEEP_FIRST = 2
/** Keep the most recent N messages */
const KEEP_RECENT = 15
/** Total hard limit for messages sent to API */
const MAX_API_MESSAGES = 20

/**
 * Build a character-specific system prompt for roleplay conversations.
 * Includes character persona, world context, and memory.
 */
function buildCharacterSystemPrompt(
  character: AdvCharacter,
  worldContext: string,
  memoryPrompt: string,
  statePrompt: string,
  clockPrompt: string,
  eventsPrompt: string,
  knowledgeContent?: string,
): string {
  const characterInfo = exportCharacterForAI(character)

  const parts: string[] = [
    `你现在扮演以下角色，请始终保持角色一致性。用角色的口吻和风格回复用户的消息。`,
    '',
    '# 角色信息',
    '',
    characterInfo,
  ]

  if (character.expertisePrompt) {
    parts.push('')
    parts.push('# 专业领域指导')
    parts.push('')
    parts.push(character.expertisePrompt)
  }

  if (knowledgeContent) {
    parts.push('')
    parts.push(`# ${character.knowledgeDomain || '专业'}知识参考`)
    parts.push('')
    parts.push('以下是与当前话题相关的专业知识，回答时请自然引用：')
    parts.push('')
    parts.push(knowledgeContent)
  }

  if (memoryPrompt) {
    parts.push('')
    parts.push(memoryPrompt)
  }

  if (statePrompt) {
    parts.push('')
    parts.push(statePrompt)
  }

  if (clockPrompt) {
    parts.push('')
    parts.push(clockPrompt)
  }

  if (eventsPrompt) {
    parts.push('')
    parts.push(eventsPrompt)
  }

  if (worldContext) {
    parts.push('')
    parts.push('# 世界背景')
    parts.push('')
    parts.push(worldContext)
  }

  parts.push('')
  parts.push('# 对话规则')
  parts.push('')
  parts.push('- 始终以角色身份回复，不要跳出角色')
  parts.push('- 保持角色的说话风格和性格特征')
  parts.push('- 根据角色的背景和知识领域来回答')
  parts.push('- 回复使用用户的语言')
  parts.push('- 可以适当表达角色的情感和态度')
  parts.push('- 如果有角色记忆，请自然地参考之前的对话经历')

  return parts.join('\n')
}

/**
 * Build a smart context window from the full message history.
 * Strategy: keep first few messages + summary of middle + recent messages.
 */
function buildSmartContext(
  allMessages: CharacterChatMessage[],
  contextSummary?: string,
): AiChatMessage[] {
  const total = allMessages.length

  // If within limit, send everything
  if (total <= MAX_API_MESSAGES) {
    return allMessages.map(m => ({ role: m.role, content: m.content }))
  }

  const result: AiChatMessage[] = []

  // 1. Keep first N messages (initial greeting/context)
  const firstMessages = allMessages.slice(0, KEEP_FIRST)
  for (const m of firstMessages) {
    result.push({ role: m.role, content: m.content })
  }

  // 2. Insert summary of middle messages if available
  if (contextSummary) {
    result.push({
      role: 'system',
      content: `[对话摘要] 以下是之前对话的概要：\n${contextSummary}`,
    })
  }

  // 3. Keep recent N messages
  const recentMessages = allMessages.slice(-KEEP_RECENT)
  for (const m of recentMessages) {
    result.push({ role: m.role, content: m.content })
  }

  return result
}

export const useCharacterChatStore = defineStore('characterChat', () => {
  const conversations = ref<Map<string, CharacterConversation>>(new Map())
  const isLoading = ref(false)
  const streamingContent = ref('')
  const currentAbortController = ref<AbortController | null>(null)

  // Load from localStorage on init
  loadFromStorage()

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: [string, CharacterConversation][] = JSON.parse(saved)
        conversations.value = new Map(parsed)
      }
    }
    catch {
      // ignore
    }
  }

  function saveToStorage() {
    try {
      const entries = Array.from(conversations.value.entries())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    }
    catch {
      // ignore
    }
  }

  // Persist on change
  watch(conversations, () => {
    saveToStorage()
  }, { deep: true })

  function getConversation(characterId: string): CharacterConversation {
    if (!conversations.value.has(characterId)) {
      conversations.value.set(characterId, {
        characterId,
        messages: [],
      })
    }
    return conversations.value.get(characterId)!
  }

  function getMessages(characterId: string): CharacterChatMessage[] {
    return getConversation(characterId).messages
  }

  function getLastMessage(characterId: string): CharacterChatMessage | undefined {
    const msgs = getConversation(characterId).messages
    return msgs.at(-1)
  }

  async function sendMessage(
    characterId: string,
    content: string,
    character: AdvCharacter,
    worldContext: string,
    knowledgeContent?: string,
  ) {
    const conversation = getConversation(characterId)
    const memoryStore = useCharacterMemoryStore()
    const stateStore = useCharacterStateStore()
    const clockStore = useWorldClockStore()
    const eventStore = useWorldEventStore()

    conversation.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    })

    const aiSettings = useAiSettingsStore()

    // If AI is not configured, provide a helpful fallback
    if (!aiSettings.isConfigured) {
      isLoading.value = true
      setTimeout(() => {
        conversation.messages.push({
          role: 'assistant',
          content: i18n.global.t('chat.aiNotConfiguredMessage'),
          timestamp: Date.now(),
        })
        isLoading.value = false
      }, 300)
      return
    }

    isLoading.value = true
    streamingContent.value = ''

    // Build system prompt with character persona + world context + memory + state + clock + events
    const memoryPrompt = memoryStore.formatMemoryForPrompt(characterId)
    const statePrompt = stateStore.formatStateForPrompt(characterId)
    const clockPrompt = clockStore.formatClockForPrompt()
    const eventsPrompt = eventStore.formatEventsForPrompt()
    const systemPrompt = buildCharacterSystemPrompt(character, worldContext, memoryPrompt, statePrompt, clockPrompt, eventsPrompt, knowledgeContent)
    const systemMessages: AiChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Smart context: keep first + summary + recent
    const chatHistory = buildSmartContext(
      conversation.messages,
      conversation.contextSummary,
    )

    const allMessages = [...systemMessages, ...chatHistory]

    // Create abort controller for cancellation
    const abortController = new AbortController()
    currentAbortController.value = abortController

    // Add a placeholder message for streaming
    const assistantMsg: CharacterChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    conversation.messages.push(assistantMsg)
    const msgIndex = conversation.messages.length - 1

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
        conversation.messages[msgIndex].content = accumulated
      }

      streamingContent.value = ''

      // Trigger background memory extraction (non-blocking)
      if (accumulated) {
        memoryStore.extractMemoryFromTurn(
          characterId,
          character.name,
          content,
          accumulated,
        )
        stateStore.extractStateFromTurn(
          characterId,
          character.name,
          content,
          accumulated,
        )
      }
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

      conversation.messages[msgIndex] = {
        ...conversation.messages[msgIndex],
        content: conversation.messages[msgIndex].content || errorMessage,
      }
    }
    finally {
      isLoading.value = false
      currentAbortController.value = null
    }
  }

  function stopGeneration() {
    if (currentAbortController.value) {
      currentAbortController.value.abort()
      currentAbortController.value = null
    }
  }

  function clearConversation(characterId: string) {
    conversations.value.set(characterId, {
      characterId,
      messages: [],
    })
  }

  return {
    conversations,
    isLoading,
    streamingContent,
    getConversation,
    getMessages,
    getLastMessage,
    sendMessage,
    stopGeneration,
    clearConversation,
  }
})
