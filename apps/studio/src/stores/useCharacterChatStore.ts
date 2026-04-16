import type { AdvCharacter } from '@advjs/types'
import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import type { CharacterAiOverride } from '../utils/resolveAiConfig'
import { exportCharacterForAI } from '@advjs/parser'
import { LANGUAGE_LABELS } from '@advjs/types'
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
import { resolveCharacterAiConfig } from '../utils/resolveAiConfig'
import { estimateTokens } from '../utils/tokenEstimate'
import { useAiSettingsStore } from './useAiSettingsStore'

export interface CharacterChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /** Path to cached TTS audio file, e.g. 'adv/audio/tts/aria-1712345678.mp3' */
  ttsAudioPath?: string
  /** User feedback on AI response quality: 'up' (good), 'down' (bad) */
  feedback?: 'up' | 'down'
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
  /** Parent snapshot ID — tracks which snapshot this was forked from */
  parentSnapshotId?: string
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
/** Token budget for context messages (excluding system prompt) */
const CONTEXT_TOKEN_BUDGET = 4096

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
      character.language
        ? t('systemPrompt.common.ruleTargetLanguage', { lang: LANGUAGE_LABELS[character.language] ?? character.language })
        : t('systemPrompt.common.ruleUserLanguage'),
      t('systemPrompt.common.ruleExpressEmotion'),
      t('systemPrompt.common.ruleReferMemory'),
    ].join('\n'))
    .build()
}

/**
 * Build a smart context window from the full message history.
 *
 * Strategy (token-budget-aware):
 * 1. If all messages fit within budget, send everything
 * 2. Otherwise: keep first N messages + context summary + as many recent messages as budget allows
 * 3. Falls back to hard message count limit if token estimation is not needed
 */
function buildSmartContext(
  allMessages: CharacterChatMessage[],
  contextSummary?: string,
): AiChatMessage[] {
  const total = allMessages.length

  // If within hard message limit, send everything
  if (total <= MAX_API_MESSAGES) {
    return allMessages.map(m => ({ role: m.role, content: m.content }))
  }

  const result: AiChatMessage[] = []
  let usedTokens = 0

  // 1. Keep first N messages (initial greeting/context)
  const firstMessages = allMessages.slice(0, KEEP_FIRST)
  for (const m of firstMessages) {
    const tokens = estimateTokens(m.content) + 4
    usedTokens += tokens
    result.push({ role: m.role, content: m.content })
  }

  // 2. Insert summary of middle messages if available
  if (contextSummary) {
    const summaryContent = i18n.global.t('systemPrompt.characterChat.contextSummaryPrefix', { summary: contextSummary })
    usedTokens += estimateTokens(summaryContent) + 4
    result.push({ role: 'system', content: summaryContent })
  }

  // 3. Fill remaining budget with recent messages (newest first, then reverse)
  const remainingBudget = CONTEXT_TOKEN_BUDGET - usedTokens
  const recentCandidates = allMessages.slice(KEEP_FIRST) // all messages after first N
  const selectedRecent: AiChatMessage[] = []
  let recentTokens = 0

  // Walk backwards from most recent, accumulate until budget exhausted
  for (let i = recentCandidates.length - 1; i >= 0; i--) {
    const m = recentCandidates[i]
    const tokens = estimateTokens(m.content) + 4
    if (recentTokens + tokens > remainingBudget && selectedRecent.length >= KEEP_RECENT)
      break
    // Always include at least KEEP_RECENT messages regardless of budget
    if (recentTokens + tokens > remainingBudget && selectedRecent.length < KEEP_RECENT) {
      selectedRecent.unshift({ role: m.role, content: m.content })
      recentTokens += tokens
      continue
    }
    selectedRecent.unshift({ role: m.role, content: m.content })
    recentTokens += tokens
  }

  result.push(...selectedRecent)
  return result
}

export const useCharacterChatStore = defineStore('characterChat', () => {
  const conversations = ref<Map<string, CharacterConversation>>(new Map())
  const snapshots = ref<Map<string, ConversationSnapshot[]>>(new Map())
  const aiOverrides = ref<Map<string, CharacterAiOverride>>(new Map())
  /** Tracks the currently active (most recently restored) snapshot per character */
  const activeSnapshotId = ref<Map<string, string>>(new Map())
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

      // Load per-character AI overrides
      try {
        const configs = await db.characterAiConfigs
          .where('[projectId+characterId]')
          .between([pid, Dexie.minKey], [pid, Dexie.maxKey])
          .toArray()
        const overrideMap = new Map<string, CharacterAiOverride>()
        for (const row of configs) {
          overrideMap.set(row.characterId, row.config)
        }
        aiOverrides.value = overrideMap
      }
      catch {
        // ignore — overrides are best-effort
      }
    },
    clear: () => {
      stopGeneration()
      conversations.value = new Map()
      snapshots.value = new Map()
      aiOverrides.value = new Map()
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

    // Resolve per-character AI config (falls back to global if no override)
    const override = aiOverrides.value.get(characterId)
    const resolved = resolveCharacterAiConfig(
      aiSettings.config,
      aiSettings.effectiveBaseURL,
      aiSettings.effectiveModel,
      override,
    )

    await streamToMessage({
      allMessages,
      messageList: conversation.messages,
      placeholderRole: 'assistant',
      streamingContent,
      isLoading,
      currentAbortController,
      resolvedConfig: resolved,
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
   * Trim messages if over threshold, archive old messages, and generate context summary.
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

    // Archive trimmed messages to IndexedDB (fire-and-forget)
    const pid = getCurrentProjectId()
    db.archivedBatches.put({
      projectId: pid,
      characterId,
      batchId: `batch-${Date.now()}`,
      messages: trimmedMessages,
      summary: '',
      archivedAt: Date.now(),
    }).catch(() => {})

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
        // Also update the archive batch with summary
        const batches = await db.archivedBatches
          .where('[projectId+characterId]')
          .equals([pid, characterId])
          .last()
        if (batches) {
          batches.summary = result.summary
          await db.archivedBatches.put(batches)
        }
        await flush()
      }
    }).catch(() => {})
  }

  // --- Snapshot methods ---

  function createSnapshot(characterId: string, label?: string): ConversationSnapshot {
    const conv = getConversation(characterId)
    const n = conv.messages.length
    const parentId = activeSnapshotId.value.get(characterId)
    const snap: ConversationSnapshot = {
      id: `snap-${Date.now()}`,
      characterId,
      label: label || i18n.global.t('world.snapshotLabel', { n }),
      createdAt: Date.now(),
      messages: [...conv.messages],
      contextSummary: conv.contextSummary,
      parentSnapshotId: parentId,
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
    activeSnapshotId.value.set(characterId, snapshotId)
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

  // --- Archive methods ---

  /**
   * Get archived message batches for a character.
   */
  async function getArchivedBatches(characterId: string) {
    const pid = getCurrentProjectId()
    return db.archivedBatches
      .where('[projectId+characterId]')
      .equals([pid, characterId])
      .sortBy('archivedAt')
  }

  /**
   * Check if a character has any archived messages.
   */
  async function hasArchivedMessages(characterId: string): Promise<boolean> {
    const pid = getCurrentProjectId()
    const count = await db.archivedBatches
      .where('[projectId+characterId]')
      .equals([pid, characterId])
      .count()
    return count > 0
  }

  // --- AI Override methods ---

  function getAiOverride(characterId: string): CharacterAiOverride | undefined {
    return aiOverrides.value.get(characterId)
  }

  async function setAiOverride(characterId: string, config: CharacterAiOverride): Promise<void> {
    aiOverrides.value.set(characterId, config)
    const pid = getCurrentProjectId()
    await db.characterAiConfigs.put({ projectId: pid, characterId, config }).catch(() => {})
  }

  async function clearAiOverride(characterId: string): Promise<void> {
    aiOverrides.value.delete(characterId)
    const pid = getCurrentProjectId()
    await db.characterAiConfigs.delete([pid, characterId]).catch(() => {})
  }

  /**
   * Update the TTS audio path on a specific message.
   * Used to cache generated TTS audio for replay.
   */
  function updateMessageTtsPath(characterId: string, messageTimestamp: number, ttsAudioPath: string): void {
    const conv = getConversation(characterId)
    const msg = conv.messages.find(m => m.timestamp === messageTimestamp)
    if (msg) {
      msg.ttsAudioPath = ttsAudioPath
      flush()
    }
  }

  /**
   * Set user feedback (👍/👎) on an assistant message.
   * Pass `null` to clear feedback.
   */
  function setMessageFeedback(characterId: string, messageTimestamp: number, feedback: 'up' | 'down' | null): void {
    const conv = getConversation(characterId)
    const msg = conv.messages.find(m => m.timestamp === messageTimestamp && m.role === 'assistant')
    if (msg) {
      msg.feedback = feedback ?? undefined
      flush()
    }
  }

  /**
   * Get the current feedback for a message.
   */
  function getMessageFeedback(characterId: string, messageTimestamp: number): 'up' | 'down' | undefined {
    const conv = getConversation(characterId)
    const msg = conv.messages.find(m => m.timestamp === messageTimestamp && m.role === 'assistant')
    return msg?.feedback
  }

  /**
   * Delete a single message by timestamp.
   */
  function deleteMessage(characterId: string, timestamp: number): void {
    const conv = getConversation(characterId)
    const idx = conv.messages.findIndex(m => m.timestamp === timestamp)
    if (idx !== -1) {
      conv.messages.splice(idx, 1)
      flush()
    }
  }

  return {
    conversations,
    snapshots,
    aiOverrides,
    activeSnapshotId,
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
    getAiOverride,
    setAiOverride,
    clearAiOverride,
    getArchivedBatches,
    hasArchivedMessages,
    updateMessageTtsPath,
    setMessageFeedback,
    getMessageFeedback,
    deleteMessage,
    init,
    flush,
    $reset,
  }
})
