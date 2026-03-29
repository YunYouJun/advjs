import type { AdvCharacter } from '@advjs/types'
import type { ChatMessage as AiChatMessage } from '../utils/aiClient'
import { exportCharacterForAI } from '@advjs/parser'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import i18n from '../i18n'
import { AiApiError, buildStreamOptions, streamChat } from '../utils/aiClient'
import { CODE_FENCE_END_RE, CODE_FENCE_START_RE } from '../utils/chatUtils'
import { useAiSettingsStore } from './useAiSettingsStore'
import { useCharacterMemoryStore } from './useCharacterMemoryStore'
import { useCharacterStateStore } from './useCharacterStateStore'
import { useWorldClockStore } from './useWorldClockStore'
import { useWorldEventStore } from './useWorldEventStore'

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

const STORAGE_KEY = 'advjs-studio-group-chats'
const MAX_ROOMS = 50
/** Keep the most recent N messages for API context */
const KEEP_RECENT = 20
const MAX_CONSECUTIVE_SAME_SPEAKER = 2

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

  const parts: string[] = [
    `你现在扮演以下角色，请始终保持角色一致性。`,
    '',
    '# 角色信息',
    '',
    characterInfo,
  ]

  // List other participants
  const others = allParticipants.filter(p => p.id !== speaker.id)
  if (others.length > 0) {
    parts.push('')
    parts.push('# 在场角色')
    parts.push('')
    for (const p of others) {
      const desc = p.personality || p.concept || ''
      parts.push(`- **${p.name}**${desc ? `：${desc}` : ''}`)
    }
  }

  // Relationships with present characters
  if (speaker.relationships && speaker.relationships.length > 0) {
    const presentIds = new Set(allParticipants.map(p => p.id))
    const relevantRels = speaker.relationships.filter(r => presentIds.has(r.targetId))
    if (relevantRels.length > 0) {
      parts.push('')
      parts.push('# 角色关系')
      parts.push('')
      for (const rel of relevantRels) {
        const target = allParticipants.find(p => p.id === rel.targetId)
        const targetName = target?.name || rel.targetId
        parts.push(`- 与 **${targetName}** 的关系：${rel.type}${rel.description ? `（${rel.description}）` : ''}`)
      }
    }
  }

  if (speaker.expertisePrompt) {
    parts.push('')
    parts.push('# 专业领域指导')
    parts.push('')
    parts.push(speaker.expertisePrompt)
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
  parts.push('- 你正在参与多人对话。只说你角色会说的话，保持简短自然。')
  parts.push('- 不要替其他角色说话或行动')
  parts.push('- 保持角色的说话风格和性格特征')
  parts.push('- 可以@或直接称呼在场的其他角色')
  parts.push('- 回复使用用户的语言')
  parts.push('- 可以适当表达角色的情感和态度')
  parts.push('- 如果有角色记忆，请自然地参考之前的对话经历')

  return parts.join('\n')
}

/**
 * Map group chat messages to the API format from the speaker's perspective.
 * - Speaker's own messages → assistant
 * - Other characters → user with [Name] prefix
 * - Player messages → user with [玩家] prefix
 */
function mapMessagesToApi(
  messages: GroupChatMessage[],
  speakerId: string,
): AiChatMessage[] {
  const recent = messages.slice(-KEEP_RECENT)
  return recent.map((msg) => {
    if (msg.role === 'character' && msg.characterId === speakerId) {
      return { role: 'assistant' as const, content: msg.content }
    }
    if (msg.role === 'character') {
      return { role: 'user' as const, content: `[${msg.characterName || '???'}] ${msg.content}` }
    }
    // Player message
    return { role: 'user' as const, content: `[玩家] ${msg.content}` }
  })
}

export const useGroupChatStore = defineStore('groupChat', () => {
  const rooms = ref<GroupChatRoom[]>([])
  const isLoading = ref(false)
  const streamingContent = ref('')
  const currentSpeakerName = ref('')
  const selectingSpeaker = ref(false)
  const currentAbortController = ref<AbortController | null>(null)

  // Load from localStorage on init
  loadFromStorage()

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        rooms.value = JSON.parse(saved)
      }
    }
    catch {
      // ignore
    }
  }

  function saveToStorage() {
    try {
      // Trim to max rooms
      if (rooms.value.length > MAX_ROOMS) {
        rooms.value = rooms.value.slice(-MAX_ROOMS)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms.value))
    }
    catch {
      // ignore
    }
  }

  // Persist on change
  watch(rooms, () => {
    saveToStorage()
  }, { deep: true })

  function getRoom(roomId: string): GroupChatRoom | undefined {
    return rooms.value.find(r => r.id === roomId)
  }

  function createRoom(name: string, participantIds: string[]): string {
    const id = `room-${Date.now()}`
    const room: GroupChatRoom = {
      id,
      name: name || `群聊 ${rooms.value.length + 1}`,
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
      const memoryStore = useCharacterMemoryStore()
      const stateStore = useCharacterStateStore()
      const clockStore = useWorldClockStore()
      const eventStore = useWorldEventStore()

      const memoryPrompt = memoryStore.formatMemoryForPrompt(speaker.id)
      const statePrompt = stateStore.formatStateForPrompt(speaker.id)
      const clockPrompt = clockStore.formatClockForPrompt()
      const eventsPrompt = eventStore.formatEventsForPrompt()

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

      const chatHistory = mapMessagesToApi(room.messages, speaker.id)
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
      if (accumulated) {
        const lastUserMsg = findLastUserMessage(room)
        memoryStore.extractMemoryFromTurn(
          speaker.id,
          speaker.name,
          lastUserMsg,
          accumulated,
        )
        stateStore.extractStateFromTurn(
          speaker.id,
          speaker.name,
          lastUserMsg,
          accumulated,
        )
      }
    }
    catch (err) {
      streamingContent.value = ''

      // Find the placeholder message and fill it with an error message
      const room = getRoom(roomId)
      if (room) {
        const lastMsg = room.messages.at(-1)
        if (lastMsg?.role === 'character' && !lastMsg.content) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            lastMsg.content = i18n.global.t('chat.errorAborted')
          }
          else if (err instanceof AiApiError) {
            switch (err.type) {
              case 'auth':
                lastMsg.content = i18n.global.t('chat.errorAuth')
                break
              case 'rate_limit':
                lastMsg.content = i18n.global.t('chat.errorRateLimit')
                break
              case 'network':
                lastMsg.content = i18n.global.t('chat.errorNetwork')
                break
              case 'timeout':
                lastMsg.content = i18n.global.t('chat.errorTimeout')
                break
              default:
                lastMsg.content = i18n.global.t('chat.errorGeneric', { message: err.message })
            }
          }
          else {
            lastMsg.content = i18n.global.t('chat.errorUnexpected', { message: err instanceof Error ? err.message : 'Unknown error' })
          }
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
        .map(m => `[${m.characterName || '玩家'}] ${m.content.slice(0, 60)}`)
        .join('\n')

      const participantList = participants
        .map(p => `- ${p.id}: ${p.name}`)
        .join('\n')

      const prompt = `根据以下多人对话的最近几条消息，判断谁最自然地应该接话。

参与者：
${participantList}

最近对话：
${msgSummary}

${lastSpeakerId && consecutiveCount >= MAX_CONSECUTIVE_SAME_SPEAKER - 1 ? `注意：${lastSpeakerId} 已经连续发言了，请选择其他人。` : ''}

只返回最应该接话的角色 ID，不要返回其他内容。`

      const messages: AiChatMessage[] = [
        { role: 'system', content: '你是一个对话分析系统。只返回角色 ID，不要有其他文字。' },
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
    if (currentAbortController.value) {
      currentAbortController.value.abort()
      currentAbortController.value = null
    }
  }

  return {
    rooms,
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
  }
})
