import type { AdvCharacter } from '@advjs/types'
import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import { exportCharacterForAI } from '@advjs/parser'
import Dexie from 'dexie'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import { runAiJsonExtraction, triggerBackgroundExtraction } from '../utils/aiExtraction'
import { abortAndClear, pushNotConfiguredFallback, streamToMessage } from '../utils/chatUtils'
import { db } from '../utils/db'
import { getOrCreateInMap, loadMapFromDexie, useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'
import { PromptBuilder } from '../utils/promptBuilder'
import { gatherCharacterPrompts } from '../utils/promptContext'
import { useAiSettingsStore } from './useAiSettingsStore'

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

export interface ConversationSnapshot {
  id: string
  characterId: string
  label: string
  createdAt: number
  messages: CharacterChatMessage[]
  contextSummary?: string
}

/** Max messages to persist per character (older messages are trimmed on save) */
const MAX_STORED_MESSAGES = 200
/** When trimming, keep only the most recent N messages */
const TRIM_TO = 100
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
  const t = i18n.global.t

  return new PromptBuilder()
    .line(t('systemPrompt.characterChat.roleInstruction'))
    .section(t('systemPrompt.common.characterInfoHeader'), characterInfo)
    .sectionIf(character.expertisePrompt, t('systemPrompt.common.expertiseHeader'), character.expertisePrompt || '')
    .sectionIf(knowledgeContent, t('systemPrompt.common.knowledgeRefHeader', { domain: character.knowledgeDomain || '专业' }), () =>
      `${t('systemPrompt.common.knowledgeRefInstruction')}\n\n${knowledgeContent}`)
    .blockIf(memoryPrompt, memoryPrompt)
    .blockIf(statePrompt, statePrompt)
    .blockIf(clockPrompt, clockPrompt)
    .blockIf(eventsPrompt, eventsPrompt)
    .sectionIf(worldContext, t('systemPrompt.common.worldBackgroundHeader'), worldContext)
    .section(t('systemPrompt.common.dialogueRulesHeader'), [
      t('systemPrompt.common.ruleStayInCharacter'),
      t('systemPrompt.common.ruleKeepStyle'),
      t('systemPrompt.common.ruleUseBackground'),
      t('systemPrompt.common.ruleUserLanguage'),
      t('systemPrompt.common.ruleExpressEmotion'),
      t('systemPrompt.common.ruleReferMemory'),
    ].join('\n'))
    .build()
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
      content: i18n.global.t('systemPrompt.characterChat.contextSummaryPrefix', { summary: contextSummary }),
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
  const snapshots = ref<Map<string, ConversationSnapshot[]>>(new Map())
  const isLoading = ref(false)
  const streamingContent = ref('')
  const currentAbortController = ref<AbortController | null>(null)

  // --- Dexie persistence ---

  const { flush, init, $reset: _persistReset } = useProjectPersistence({
    source: conversations,
    save: async () => {
      const pid = getCurrentProjectId()
      const entries = Array.from(conversations.value.entries())
      const rows = entries.map(([characterId, conv]) => ({
        projectId: pid,
        characterId,
        messages: conv.messages.length > MAX_STORED_MESSAGES
          ? conv.messages.slice(-TRIM_TO)
          : conv.messages,
        contextSummary: conv.contextSummary,
      }))
      await db.characterChats.bulkPut(rows)
    },
    load: async (pid) => {
      const map = await loadMapFromDexie<CharacterConversation>(
        db.characterChats,
        pid,
        row => row.characterId,
        row => ({
          characterId: row.characterId,
          messages: row.messages,
          contextSummary: row.contextSummary,
        }),
      )
      if (map)
        conversations.value = map

      // Load snapshots
      try {
        const snaps = await db.conversationSnapshots
          .where('[projectId+characterId]')
          .between([pid, Dexie.minKey], [pid, Dexie.maxKey])
          .toArray()
        const snapMap = new Map<string, ConversationSnapshot[]>()
        for (const s of snaps) {
          const { projectId: _pid, ...snap } = s
          const list = snapMap.get(snap.characterId) || []
          list.push(snap)
          snapMap.set(snap.characterId, list)
        }
        snapshots.value = snapMap
      }
      catch {
        // ignore — snapshots are best-effort
      }
    },
    clear: () => {
      stopGeneration()
      conversations.value = new Map()
      snapshots.value = new Map()
      streamingContent.value = ''
    },
  })

  const $reset = _persistReset

  function getConversation(characterId: string): CharacterConversation {
    return getOrCreateInMap(conversations.value, characterId, id => ({
      characterId: id,
      messages: [],
    }))
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

    conversation.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    })

    const aiSettings = useAiSettingsStore()

    // If AI is not configured, provide a helpful fallback
    if (!aiSettings.isConfigured) {
      pushNotConfiguredFallback(conversation.messages, isLoading)
      return
    }

    isLoading.value = true
    streamingContent.value = ''

    // Build system prompt with character persona + world context + memory + state + clock + events
    const { memoryPrompt, statePrompt, clockPrompt, eventsPrompt } = gatherCharacterPrompts(characterId)
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

    await streamToMessage({
      allMessages,
      messageList: conversation.messages,
      placeholderRole: 'assistant',
      streamingContent,
      isLoading,
      currentAbortController,
      onSuccess: accumulated =>
        triggerBackgroundExtraction(characterId, character.name, content, accumulated),
    })

    // Fire-and-forget: trim old messages and generate context summary if needed
    trimMessagesIfNeeded(characterId, character.name).catch(() => {})
  }

  function stopGeneration() {
    abortAndClear(currentAbortController)
  }

  function clearConversation(characterId: string) {
    conversations.value.set(characterId, {
      characterId,
      messages: [],
    })
  }

  /**
   * Trim messages if over threshold and fire-and-forget AI context summary generation.
   */
  async function trimMessagesIfNeeded(
    characterId: string,
    characterName: string,
  ): Promise<void> {
    const conv = getConversation(characterId)
    if (conv.messages.length <= MAX_STORED_MESSAGES)
      return

    const trimmedMessages = conv.messages.slice(0, conv.messages.length - TRIM_TO)
    conv.messages = conv.messages.slice(-TRIM_TO)

    const t = i18n.global.t
    const conversationText = trimmedMessages
      .map(m => `${m.role === 'assistant' ? characterName : t('systemPrompt.player')}: ${m.content}`)
      .join('\n')

    runAiJsonExtraction(
      {
        prompt: `Summarize the following conversation excerpt between a player and ${characterName} in 2-3 sentences. Focus on key events, emotional developments, and important decisions. Write in third person.\n\nConversation:\n${conversationText}\n\nReturn JSON: { "summary": "..." }`,
        maxTokens: 200,
        temperature: 0.3,
      },
      (raw) => {
        if (typeof raw.summary !== 'string' || raw.summary.length < 10)
          throw new Error('invalid')
        return { summary: raw.summary as string }
      },
      1,
    ).then(async (result) => {
      if (result) {
        const c = getConversation(characterId)
        c.contextSummary = result.summary
        await flush()
      }
    }).catch(() => {})
  }

  // --- Snapshot methods ---

  function createSnapshot(characterId: string, label?: string): ConversationSnapshot {
    const conv = getConversation(characterId)
    const n = conv.messages.length
    const snap: ConversationSnapshot = {
      id: `snap-${Date.now()}`,
      characterId,
      label: label || i18n.global.t('world.snapshotLabel', { n }),
      createdAt: Date.now(),
      messages: [...conv.messages],
      contextSummary: conv.contextSummary,
    }
    const list = snapshots.value.get(characterId) || []
    snapshots.value.set(characterId, [...list, snap])

    // Persist immediately (not debounced)
    const pid = getCurrentProjectId()
    db.conversationSnapshots.put({ ...snap, projectId: pid }).catch(() => {
      // best-effort
    })

    return snap
  }

  function getSnapshots(characterId: string): ConversationSnapshot[] {
    return snapshots.value.get(characterId) || []
  }

  function restoreSnapshot(characterId: string, snapshotId: string): boolean {
    const snap = getSnapshots(characterId).find(s => s.id === snapshotId)
    if (!snap)
      return false
    conversations.value.set(characterId, {
      characterId,
      messages: [...snap.messages],
      contextSummary: snap.contextSummary,
    })
    return true
  }

  function deleteSnapshot(characterId: string, snapshotId: string): void {
    const list = getSnapshots(characterId).filter(s => s.id !== snapshotId)
    snapshots.value.set(characterId, list)
    const pid = getCurrentProjectId()
    db.conversationSnapshots.delete([pid, snapshotId]).catch(() => {
      // best-effort
    })
  }

  return {
    conversations,
    snapshots,
    isLoading,
    streamingContent,
    getConversation,
    getMessages,
    getLastMessage,
    sendMessage,
    stopGeneration,
    clearConversation,
    createSnapshot,
    getSnapshots,
    restoreSnapshot,
    deleteSnapshot,
    init,
    flush,
    $reset,
  }
})
