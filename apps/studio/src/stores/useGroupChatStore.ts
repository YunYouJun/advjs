import type { AdvCharacter } from '@advjs/types'
import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import { exportCharacterForAI } from '@advjs/parser'
import { LANGUAGE_LABELS } from '@advjs/types'
import Dexie from 'dexie'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import { buildStreamOptions, streamChat } from '../utils/aiClient'
import { runAiJsonExtraction, triggerBackgroundExtraction } from '../utils/aiExtraction'
import { abortAndClear, CODE_FENCE_END_RE, CODE_FENCE_START_RE, getAiErrorMessage } from '../utils/chatUtils'
import { db } from '../utils/db'
import { useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'
import { PromptBuilder } from '../utils/promptBuilder'
import { gatherCharacterPrompts } from '../utils/promptContext'
import { useAiSettingsStore } from './useAiSettingsStore'

export interface GroupChatMessage {
  /** user = player, character = NPC */
  role: 'user' | 'character'
  /** NPC character ID (only when role === 'character') */
  characterId?: string
  /** Display name */
  characterName?: string
  content: string
  timestamp: number
}

export interface GroupChatRoom {
  id: string
  name: string
  participantIds: string[]
  messages: GroupChatMessage[]
  contextSummary?: string
  createdAt: number
}

export interface GroupChatRoomSnapshot {
  id: string
  roomId: string
  label: string
  createdAt: number
  messages: GroupChatMessage[]
  contextSummary?: string
  /** Parent snapshot ID — tracks which snapshot this was forked from */
  parentSnapshotId?: string
}

const MAX_ROOMS = 50
/** Max messages to persist per room (older messages are trimmed on save) */
const MAX_STORED_MESSAGES = 200
/** When trimming, keep only the most recent N messages */
const TRIM_TO = 100
/** Keep the most recent N messages for API context */
const KEEP_RECENT = 20
const MAX_CONSECUTIVE_SAME_SPEAKER = 2
/** Max messages before triggering trim + summary */
const GROUP_TRIM_THRESHOLD = 300
/** After trim, keep only the most recent N messages */
const GROUP_TRIM_TO = 150
/** Max total messages sent to API */
const GROUP_MAX_API = 30
/** Always keep first N messages for initial context */
const GROUP_KEEP_FIRST = 2

/**
 * Build a group-chat-specific system prompt for the speaking character.
 */
function buildGroupSystemPrompt(
  speaker: AdvCharacter,
  allParticipants: AdvCharacter[],
  worldContext: string,
  memoryPrompt: string,
  statePrompt: string,
  clockPrompt: string,
  eventsPrompt: string,
): string {
  const characterInfo = exportCharacterForAI(speaker)
  const t = i18n.global.t

  const builder = new PromptBuilder()
    .line(t('systemPrompt.groupChat.roleInstruction'))
    .section(t('systemPrompt.common.characterInfoHeader'), characterInfo)

  // List other participants
  const others = allParticipants.filter(p => p.id !== speaker.id)
  if (others.length > 0) {
    builder
      .line()
      .line(t('systemPrompt.groupChat.presentCharactersHeader'))
      .line()
      .items(others.map((p) => {
        const desc = p.personality || p.concept || ''
        return `- **${p.name}**${desc ? `：${desc}` : ''}`
      }))
  }

  // Relationships with present characters
  if (speaker.relationships && speaker.relationships.length > 0) {
    const presentIds = new Set(allParticipants.map(p => p.id))
    const relevantRels = speaker.relationships.filter(r => presentIds.has(r.targetId))
    if (relevantRels.length > 0) {
      builder
        .line()
        .line(t('systemPrompt.groupChat.relationshipsHeader'))
        .line()
        .items(relevantRels.map((rel) => {
          const target = allParticipants.find(p => p.id === rel.targetId)
          const targetName = target?.name || rel.targetId
          return t('systemPrompt.groupChat.relationshipFormat', { target: targetName, type: rel.type, desc: rel.description ? `（${rel.description}）` : '' })
        }))
    }
  }

  builder
    .sectionIf(speaker.expertisePrompt, t('systemPrompt.common.expertiseHeader'), speaker.expertisePrompt || '')
    .blockIf(memoryPrompt, memoryPrompt)
    .blockIf(statePrompt, statePrompt)
    .blockIf(clockPrompt, clockPrompt)
    .blockIf(eventsPrompt, eventsPrompt)
    .sectionIf(worldContext, t('systemPrompt.common.worldBackgroundHeader'), worldContext)
    .section(t('systemPrompt.common.dialogueRulesHeader'), [
      t('systemPrompt.groupChat.ruleGroupConversation'),
      t('systemPrompt.groupChat.ruleNoSpeakForOthers'),
      t('systemPrompt.common.ruleKeepStyle'),
      t('systemPrompt.groupChat.ruleCanMention'),
      speaker.language
        ? t('systemPrompt.common.ruleTargetLanguage', { lang: LANGUAGE_LABELS[speaker.language] ?? speaker.language })
        : t('systemPrompt.common.ruleUserLanguage'),
      t('systemPrompt.common.ruleExpressEmotion'),
      t('systemPrompt.common.ruleReferMemory'),
    ].join('\n'))

  return builder.build()
}

/**
 * Map a single group chat message to the API format from the speaker's perspective.
 * - Speaker's own messages → assistant
 * - Other characters → user with [Name] prefix
 * - Player messages → user with [玩家] prefix
 */
function mapSingleMessage(msg: GroupChatMessage, speakerId: string): AiChatMessage {
  if (msg.role === 'character' && msg.characterId === speakerId)
    return { role: 'assistant' as const, content: msg.content }
  if (msg.role === 'character')
    return { role: 'user' as const, content: `[${msg.characterName || '???'}] ${msg.content}` }
  return { role: 'user' as const, content: `${i18n.global.t('systemPrompt.groupChat.playerPrefix')} ${msg.content}` }
}

/**
 * Build a smart context window from the full group chat message history.
 * Strategy: keep first few messages + summary of middle + recent messages.
 */
function buildGroupSmartContext(
  messages: GroupChatMessage[],
  speakerId: string,
  contextSummary?: string,
): AiChatMessage[] {
  const total = messages.length

  // If within limit, send the most recent messages
  if (total <= GROUP_MAX_API)
    return messages.slice(-KEEP_RECENT).map(msg => mapSingleMessage(msg, speakerId))

  const result: AiChatMessage[] = []

  // 1. Keep first N messages (initial greeting/context)
  for (const m of messages.slice(0, GROUP_KEEP_FIRST))
    result.push(mapSingleMessage(m, speakerId))

  // 2. Insert summary of middle messages if available
  if (contextSummary) {
    result.push({
      role: 'system',
      content: i18n.global.t('systemPrompt.groupChat.contextSummaryPrefix', { summary: contextSummary }),
    })
  }

  // 3. Keep recent N messages
  for (const m of messages.slice(-KEEP_RECENT))
    result.push(mapSingleMessage(m, speakerId))

  return result
}

export const useGroupChatStore = defineStore('groupChat', () => {
  const rooms = ref<GroupChatRoom[]>([])
  const snapshots = ref<Map<string, GroupChatRoomSnapshot[]>>(new Map())
  /** Tracks the currently active snapshot per room (roomId → snapshotId) */
  const activeSnapshotId = ref<Map<string, string>>(new Map())
  const isLoading = ref(false)
  const streamingContent = ref('')
  const currentSpeakerName = ref('')
  const selectingSpeaker = ref(false)
  const currentAbortController = ref<AbortController | null>(null)

  // --- Dexie persistence ---

  const { flush, init, $reset: _persistReset } = useProjectPersistence({
    source: rooms,
    save: async () => {
      const pid = getCurrentProjectId()
      // Trim rooms count
      const roomsToSave = rooms.value.length > MAX_ROOMS
        ? rooms.value.slice(-MAX_ROOMS)
        : rooms.value
      const rows = roomsToSave.map(room => ({
        ...room,
        projectId: pid,
        messages: room.messages.length > MAX_STORED_MESSAGES
          ? room.messages.slice(-TRIM_TO)
          : room.messages,
      }))
      await db.groupChats.bulkPut(rows)
    },
    load: async (pid) => {
      const all = await db.groupChats.where('projectId').equals(pid).toArray()
      if (all.length > 0) {
        rooms.value = all
      }

      // Load snapshots
      try {
        const snaps = await db.groupChatSnapshots
          .where('[projectId+roomId]')
          .between([pid, Dexie.minKey], [pid, Dexie.maxKey])
          .toArray()
        const snapMap = new Map<string, GroupChatRoomSnapshot[]>()
        for (const s of snaps) {
          const { projectId: _pid, ...snap } = s
          const list = snapMap.get(snap.roomId) || []
          list.push(snap)
          snapMap.set(snap.roomId, list)
        }
        snapshots.value = snapMap
      }
      catch {
        // ignore — snapshots are best-effort
      }
    },
    clear: () => {
      stopGeneration()
      rooms.value = []
      snapshots.value = new Map()
      activeSnapshotId.value = new Map()
      streamingContent.value = ''
      currentSpeakerName.value = ''
      selectingSpeaker.value = false
    },
  })

  function $reset() {
    _persistReset()
  }

  function getRoom(roomId: string): GroupChatRoom | undefined {
    return rooms.value.find(r => r.id === roomId)
  }

  function createRoom(name: string, participantIds: string[]): string {
    const id = `room-${Date.now()}`
    const room: GroupChatRoom = {
      id,
      name: name || i18n.global.t('systemPrompt.groupChat.defaultRoomName', { n: rooms.value.length + 1 }),
      participantIds,
      messages: [],
      createdAt: Date.now(),
    }
    rooms.value.push(room)
    return id
  }

  function deleteRoom(roomId: string) {
    const index = rooms.value.findIndex(r => r.id === roomId)
    if (index !== -1) {
      rooms.value.splice(index, 1)
    }
  }

  function listRooms(): GroupChatRoom[] {
    return rooms.value
  }

  function clearRoom(roomId: string) {
    const room = getRoom(roomId)
    if (room) {
      room.messages = []
      room.contextSummary = undefined
    }
  }

  /**
   * Player sends a message, then trigger AI character reply.
   */
  async function sendPlayerMessage(
    roomId: string,
    content: string,
    characters: AdvCharacter[],
    worldContext: string,
  ) {
    const room = getRoom(roomId)
    if (!room)
      return

    room.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    })

    // Auto-trigger character reply
    await generateNextTurn(roomId, characters, worldContext)
  }

  /**
   * AI selects a speaker and generates a reply.
   */
  async function generateNextTurn(
    roomId: string,
    characters: AdvCharacter[],
    worldContext: string,
  ) {
    const room = getRoom(roomId)
    if (!room)
      return

    // Prevent concurrent generation — reject if already loading
    if (isLoading.value)
      return

    const aiSettings = useAiSettingsStore()
    if (!aiSettings.isConfigured) {
      room.messages.push({
        role: 'character',
        characterName: 'System',
        content: i18n.global.t('chat.aiNotConfiguredMessage'),
        timestamp: Date.now(),
      })
      return
    }

    const participants = characters.filter(c => room.participantIds.includes(c.id))
    if (participants.length === 0)
      return

    isLoading.value = true
    selectingSpeaker.value = true
    streamingContent.value = ''
    currentSpeakerName.value = ''

    try {
      // 1. Select next speaker
      const lastSpeakerId = getLastCharacterSpeakerId(room)
      const speaker = await selectNextSpeaker(room, participants, lastSpeakerId)
      if (!speaker) {
        isLoading.value = false
        selectingSpeaker.value = false
        return
      }

      selectingSpeaker.value = false
      currentSpeakerName.value = speaker.name

      // 2. Build prompt and generate reply
      const { memoryPrompt, statePrompt, clockPrompt, eventsPrompt } = gatherCharacterPrompts(speaker.id)

      const systemPrompt = buildGroupSystemPrompt(
        speaker,
        participants,
        worldContext,
        memoryPrompt,
        statePrompt,
        clockPrompt,
        eventsPrompt,
      )

      const systemMessages: AiChatMessage[] = [
        { role: 'system', content: systemPrompt },
      ]

      const chatHistory = buildGroupSmartContext(room.messages, speaker.id, room.contextSummary)
      const allMessages = [...systemMessages, ...chatHistory]

      // Create abort controller
      const abortController = new AbortController()
      currentAbortController.value = abortController

      // Add placeholder message
      const charMsg: GroupChatMessage = {
        role: 'character',
        characterId: speaker.id,
        characterName: speaker.name,
        content: '',
        timestamp: Date.now(),
      }
      room.messages.push(charMsg)
      const msgIndex = room.messages.length - 1

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
        room.messages[msgIndex].content = accumulated
      }

      streamingContent.value = ''

      // Background memory extraction
      const lastUserMsg = findLastUserMessage(room)
      triggerBackgroundExtraction(speaker.id, speaker.name, lastUserMsg, accumulated)

      // Fire-and-forget: trim old messages and generate context summary if needed
      trimGroupMessagesIfNeeded(roomId).catch(() => {})
    }
    catch (err) {
      streamingContent.value = ''

      // Find the placeholder message and fill it with an error message
      const room = getRoom(roomId)
      if (room) {
        const lastMsg = room.messages.at(-1)
        if (lastMsg?.role === 'character' && !lastMsg.content) {
          lastMsg.content = getAiErrorMessage(err)
        }
      }
    }
    finally {
      isLoading.value = false
      selectingSpeaker.value = false
      currentSpeakerName.value = ''
      currentAbortController.value = null
    }
  }

  /**
   * Select the next speaker using AI assistance with weighted random fallback.
   */
  async function selectNextSpeaker(
    room: GroupChatRoom,
    participants: AdvCharacter[],
    lastSpeakerId?: string,
  ): Promise<AdvCharacter | null> {
    if (participants.length === 0)
      return null
    if (participants.length === 1)
      return participants[0]

    const aiSettings = useAiSettingsStore()

    // Count consecutive same-speaker
    const consecutiveCount = getConsecutiveSpeakerCount(room, lastSpeakerId)

    // Try AI selection first
    try {
      const recentMessages = room.messages.slice(-5)
      const msgSummary = recentMessages
        .map(m => `[${m.characterName || i18n.global.t('systemPrompt.groupChat.playerPrefix')}] ${m.content.slice(0, 60)}`)
        .join('\n')

      const participantList = participants
        .map(p => `- ${p.id}: ${p.name}`)
        .join('\n')

      const consecutiveWarning = lastSpeakerId && consecutiveCount >= MAX_CONSECUTIVE_SAME_SPEAKER - 1
        ? i18n.global.t('systemPrompt.groupChat.consecutiveWarning', { id: lastSpeakerId })
        : ''

      const prompt = i18n.global.t('systemPrompt.groupChat.speakerSelectionPrompt', {
        participantList,
        msgSummary,
        consecutiveWarning,
      })

      const messages: AiChatMessage[] = [
        { role: 'system', content: i18n.global.t('systemPrompt.groupChat.speakerSelectionSystem') },
        { role: 'user', content: prompt },
      ]

      const options = buildStreamOptions(
        messages,
        aiSettings.config,
        aiSettings.effectiveBaseURL,
        aiSettings.effectiveModel,
      )
      options.maxTokens = 50
      options.temperature = 0.5

      let result = ''
      for await (const delta of streamChat(options)) {
        result += delta
      }

      // Clean up response
      const cleanedId = result.replace(CODE_FENCE_START_RE, '').replace(CODE_FENCE_END_RE, '').trim()

      const selected = participants.find(p => cleanedId.includes(p.id))
      if (selected) {
        // Hard limit: same speaker can't speak more than MAX_CONSECUTIVE times
        if (selected.id === lastSpeakerId && consecutiveCount >= MAX_CONSECUTIVE_SAME_SPEAKER) {
          return weightedRandomSpeaker(room, participants, lastSpeakerId)
        }
        return selected
      }
    }
    catch {
      // AI selection failed, fall back to weighted random
    }

    return weightedRandomSpeaker(room, participants, lastSpeakerId)
  }

  /**
   * Weighted random speaker selection.
   * Characters who haven't spoken recently get higher weight.
   */
  function weightedRandomSpeaker(
    room: GroupChatRoom,
    participants: AdvCharacter[],
    lastSpeakerId?: string,
  ): AdvCharacter {
    // Build weights: more weight for characters who haven't spoken recently
    const recentCharMessages = room.messages
      .filter(m => m.role === 'character')
      .slice(-10)

    const weights = participants.map((p) => {
      // If same as last speaker and hit consecutive limit, weight = 0
      const consecutiveCount = getConsecutiveSpeakerCount(room, p.id)
      if (p.id === lastSpeakerId && consecutiveCount >= MAX_CONSECUTIVE_SAME_SPEAKER) {
        return { character: p, weight: 0 }
      }

      // Count how many recent messages this character has
      const recentCount = recentCharMessages.filter(m => m.characterId === p.id).length
      // Inverse: fewer recent messages = higher weight
      const weight = Math.max(1, 10 - recentCount * 2)
      return { character: p, weight }
    })

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
    if (totalWeight === 0) {
      // Fallback: just pick someone who isn't the last speaker
      const others = participants.filter(p => p.id !== lastSpeakerId)
      return others.length > 0 ? others[Math.floor(Math.random() * others.length)] : participants[0]
    }

    let random = Math.random() * totalWeight
    for (const w of weights) {
      random -= w.weight
      if (random <= 0)
        return w.character
    }

    return weights.at(-1)!.character
  }

  function getLastCharacterSpeakerId(room: GroupChatRoom): string | undefined {
    for (let i = room.messages.length - 1; i >= 0; i--) {
      if (room.messages[i].role === 'character' && room.messages[i].characterId) {
        return room.messages[i].characterId
      }
    }
    return undefined
  }

  function getConsecutiveSpeakerCount(room: GroupChatRoom, speakerId?: string): number {
    if (!speakerId)
      return 0
    let count = 0
    for (let i = room.messages.length - 1; i >= 0; i--) {
      const msg = room.messages[i]
      if (msg.role === 'character' && msg.characterId === speakerId) {
        count++
      }
      else {
        break
      }
    }
    return count
  }

  function findLastUserMessage(room: GroupChatRoom): string {
    for (let i = room.messages.length - 1; i >= 0; i--) {
      if (room.messages[i].role === 'user') {
        return room.messages[i].content
      }
    }
    return ''
  }

  function stopGeneration() {
    abortAndClear(currentAbortController)
  }

  /**
   * Trim group chat messages if over threshold and fire-and-forget AI context summary generation.
   */
  async function trimGroupMessagesIfNeeded(roomId: string): Promise<void> {
    const room = getRoom(roomId)
    if (!room || room.messages.length <= GROUP_TRIM_THRESHOLD)
      return

    const trimmedMessages = room.messages.slice(0, room.messages.length - GROUP_TRIM_TO)
    room.messages = room.messages.slice(-GROUP_TRIM_TO)

    generateGroupContextSummary(roomId, trimmedMessages).catch(() => {})
    await flush()
  }

  /**
   * Generate an AI context summary for trimmed group chat messages.
   */
  async function generateGroupContextSummary(
    roomId: string,
    trimmedMessages: GroupChatMessage[],
  ): Promise<void> {
    const t = i18n.global.t
    const conversationText = trimmedMessages
      .map(m => m.role === 'character'
        ? `${m.characterName || '?'}: ${m.content}`
        : `${t('systemPrompt.player')}: ${m.content}`)
      .join('\n')

    const result = await runAiJsonExtraction(
      {
        prompt: `Summarize this group conversation excerpt in 2-3 sentences. Focus on key events, character interactions, and plot developments.\n\nConversation:\n${conversationText}\n\nReturn JSON: { "summary": "..." }`,
        maxTokens: 200,
        temperature: 0.3,
      },
      (raw) => {
        if (typeof raw.summary !== 'string' || raw.summary.length < 10)
          throw new Error('invalid')
        return { summary: raw.summary as string }
      },
      1,
    )

    if (result) {
      const r = getRoom(roomId)
      if (r) {
        r.contextSummary = result.summary
        await flush()
      }
    }
  }

  // --- Snapshot methods ---

  function createRoomSnapshot(roomId: string, label?: string): GroupChatRoomSnapshot | null {
    const room = getRoom(roomId)
    if (!room)
      return null
    const n = room.messages.length
    const parentId = activeSnapshotId.value.get(roomId)
    const snap: GroupChatRoomSnapshot = {
      id: `snap-${Date.now()}`,
      roomId,
      label: label || i18n.global.t('world.snapshotLabel', { n }),
      createdAt: Date.now(),
      messages: [...room.messages],
      contextSummary: room.contextSummary,
      parentSnapshotId: parentId,
    }
    const list = snapshots.value.get(roomId) || []
    snapshots.value.set(roomId, [...list, snap])

    // Update active snapshot
    activeSnapshotId.value.set(roomId, snap.id)

    // Persist immediately
    const pid = getCurrentProjectId()
    db.groupChatSnapshots.put({ ...snap, projectId: pid }).catch(() => {
      // best-effort
    })

    return snap
  }

  function getRoomSnapshots(roomId: string): GroupChatRoomSnapshot[] {
    return snapshots.value.get(roomId) || []
  }

  function restoreRoomSnapshot(roomId: string, snapshotId: string): boolean {
    const snap = getRoomSnapshots(roomId).find(s => s.id === snapshotId)
    if (!snap)
      return false
    const room = getRoom(roomId)
    if (!room)
      return false
    room.messages = [...snap.messages]
    room.contextSummary = snap.contextSummary
    return true
  }

  function deleteRoomSnapshot(roomId: string, snapshotId: string): void {
    const list = getRoomSnapshots(roomId).filter(s => s.id !== snapshotId)
    snapshots.value.set(roomId, list)
    const pid = getCurrentProjectId()
    db.groupChatSnapshots.delete([pid, snapshotId]).catch(() => {
      // best-effort
    })
  }

  function deleteMessage(roomId: string, timestamp: number): void {
    const room = getRoom(roomId)
    if (!room)
      return
    const idx = room.messages.findIndex(m => m.timestamp === timestamp)
    if (idx !== -1) {
      room.messages.splice(idx, 1)
      void flush()
    }
  }

  return {
    rooms,
    snapshots,
    activeSnapshotId,
    isLoading,
    streamingContent,
    currentSpeakerName,
    selectingSpeaker,
    getRoom,
    createRoom,
    deleteRoom,
    listRooms,
    clearRoom,
    sendPlayerMessage,
    generateNextTurn,
    stopGeneration,
    createRoomSnapshot,
    getRoomSnapshots,
    restoreRoomSnapshot,
    deleteRoomSnapshot,
    deleteMessage,
    init,
    flush,
    $reset,
  }
})
