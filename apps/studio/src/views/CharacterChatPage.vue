<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { DbArchivedBatch } from '../utils/db'
import type { CharacterAiOverride } from '../utils/resolveAiConfig'
import {
  actionSheetController,
  alertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import {
  archiveOutline,
  arrowBackOutline,
  cameraOutline,
  downloadOutline,
  ellipsisVertical,
  informationCircleOutline,
  micOutline,
  searchOutline,
  sendOutline,
  settingsOutline,
  stopOutline,
  trashOutline,
  volumeHighOutline,
  volumeMuteOutline,
} from 'ionicons/icons'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import CharacterAiSettingsForm from '../components/CharacterAiSettingsForm.vue'
import CharacterChatWelcome from '../components/CharacterChatWelcome.vue'
import CharacterInfoModal from '../components/CharacterInfoModal.vue'
import ChatHistorySearch from '../components/ChatHistorySearch.vue'
import MarkdownMessage from '../components/MarkdownMessage.vue'
import StudioPage from '../components/StudioPage.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useWorldContext } from '../composables/useWorldContext'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { useCharacterChatStore } from '../stores/useCharacterChatStore'
import { useCharacterDiaryStore } from '../stores/useCharacterDiaryStore'
import { useCharacterMemoryStore } from '../stores/useCharacterMemoryStore'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { useViewModeStore } from '../stores/useViewModeStore'
import { formatChatTime, getMoodEmoji } from '../utils/chatUtils'
import { uploadToCloud } from '../utils/cloudSync'
import { downloadAsFile, readBlobFromDir, writeBlobToDir, writeFileToDir } from '../utils/fileAccess'
import { getTtsProvider, ttsSpeak, ttsStop } from '../utils/ttsClient'
import '../styles/chat.css'

const SAFE_FILENAME_RE = /[^a-z0-9\u4E00-\u9FFF]+/g
const TRIM_UNDERSCORE_RE = /^_|_$/g

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const characterChatStore = useCharacterChatStore()
const diaryStore = useCharacterDiaryStore()
const memoryStore = useCharacterMemoryStore()
const stateStore = useCharacterStateStore()
const { characters, knowledgeBase } = useProjectContent()
const { worldContext } = useWorldContext()
const viewModeStore = useViewModeStore()
const aiSettingsStore = useAiSettingsStore()

const currentTtsCanGenerateBlob = computed(() => {
  const provider = getTtsProvider(aiSettingsStore.config.ttsProvider)
  return provider?.canGenerateBlob ?? false
})

function getEffectiveWorldContext(): string {
  return viewModeStore.getEffectiveWorldContext(worldContext.value)
}

type StudioPageInstance = InstanceType<typeof StudioPage>

const inputText = ref('')
const studioPageRef = ref<StudioPageInstance | null>(null)
const showInfoModal = ref(false)
const showSearch = ref(false)
const showSnapshots = ref(false)
const showAiSettings = ref(false)
const showArchive = ref(false)
const archivedBatches = ref<DbArchivedBatch[]>([])
const ttsPlayingIndex = ref(-1)
const ttsGeneratingIndex = ref(-1)
const ttsBatchGenerating = ref(false)

onUnmounted(() => ttsStop())

const characterId = computed(() => route.params.characterId as string)

const character = computed<AdvCharacter | undefined>(() => {
  return characters.value.find(c => c.id === characterId.value)
})

const allMessages = computed(() => {
  return characterChatStore.getMessages(characterId.value)
})

// --- Pagination ---
const PAGE_SIZE = 50
const displayCount = ref(PAGE_SIZE)

const hasMore = computed(() => allMessages.value.length > displayCount.value)
const hiddenCount = computed(() => Math.max(0, allMessages.value.length - displayCount.value))

const visibleStart = computed(() => Math.max(0, allMessages.value.length - displayCount.value))

const visibleMessages = computed(() => {
  return allMessages.value.slice(visibleStart.value)
})

/** Absolute index of a message within allMessages, from its position in visibleMessages */
function getAbsoluteIndex(visibleIdx: number): number {
  return visibleStart.value + visibleIdx
}

function loadMore() {
  displayCount.value += PAGE_SIZE
}

// Reset pagination when switching characters
watch(characterId, () => {
  displayCount.value = PAGE_SIZE
})

// Keep backward-compat alias for template
const messages = allMessages

const memory = computed(() => {
  return memoryStore.getMemory(characterId.value)
})

const dynamicState = computed(() => {
  return stateStore.getState(characterId.value)
})

const moodEmoji = computed(() => {
  const mood = memory.value.emotionalState.mood
  return getMoodEmoji(mood)
})

// Auto-scroll to bottom when messages change
watch(() => visibleMessages.value.length, async () => {
  await nextTick()
  studioPageRef.value?.contentRef?.$el?.scrollToBottom?.(300)
})

// Also scroll when streaming content updates
watch(() => characterChatStore.streamingContent, async () => {
  await nextTick()
  studioPageRef.value?.contentRef?.$el?.scrollToBottom?.(100)
})

function goBack() {
  if (window.history.length > 1)
    router.back()
  else
    router.push('/tabs/world')
}

async function send() {
  const text = inputText.value.trim()
  if (!text || !character.value)
    return

  inputText.value = ''
  const knowledgeContent = knowledgeBase.selectRelevantKnowledge(
    text,
    character.value.knowledgeDomain || '',
  )
  characterChatStore.sendMessage(
    characterId.value,
    text,
    character.value,
    getEffectiveWorldContext(),
    knowledgeContent || undefined,
  )
}

function quickSend(text: string) {
  if (!character.value)
    return
  inputText.value = ''
  const knowledgeContent = knowledgeBase.selectRelevantKnowledge(
    text,
    character.value.knowledgeDomain || '',
  )
  characterChatStore.sendMessage(
    characterId.value,
    text,
    character.value,
    getEffectiveWorldContext(),
    knowledgeContent || undefined,
  )
}

async function reloadKnowledge() {
  const project = studioStore.currentProject
  if (!project)
    return
  if (project.dirHandle) {
    await knowledgeBase.loadFromDir(project.dirHandle)
  }
  else if (project.source === 'cos' && project.cosPrefix) {
    await knowledgeBase.loadFromCos(settingsStore.cos, project.cosPrefix)
  }
}

async function confirmClear() {
  const alert = await alertController.create({
    header: t('world.clearChatTitle'),
    message: t('world.clearChatMessage'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.clear'),
        role: 'destructive',
        handler: () => {
          characterChatStore.clearConversation(characterId.value)
          memoryStore.clearMemory(characterId.value)
          stateStore.clearState(characterId.value)
        },
      },
    ],
  })
  await alert.present()
}

/**
 * Show overflow menu for secondary actions.
 */
async function showMoreActions() {
  const buttons: Array<Record<string, any>> = [
    {
      text: t('world.aiSettings'),
      icon: settingsOutline,
      handler: () => { showAiSettings.value = true },
    },
    {
      text: t('world.viewArchive'),
      icon: archiveOutline,
      handler: async () => {
        archivedBatches.value = await characterChatStore.getArchivedBatches(characterId.value)
        showArchive.value = true
      },
    },
    {
      text: t('world.snapshots'),
      icon: cameraOutline,
      handler: () => { showSnapshots.value = !showSnapshots.value },
    },
  ]

  // Batch TTS generate — only for API providers that can generate blobs
  if (currentTtsCanGenerateBlob.value) {
    buttons.push({
      text: t('world.generateAllTts'),
      icon: micOutline,
      handler: () => { nextTick(() => handleBatchGenerateTts()) },
    })
  }

  buttons.push(
    {
      text: t('world.exportTitle'),
      icon: downloadOutline,
      handler: () => {
        // Defer to next tick so the action sheet closes first
        nextTick(() => handleExport())
      },
    },
    {
      text: t('world.characterInfo'),
      icon: informationCircleOutline,
      handler: () => { showInfoModal.value = true },
    },
    {
      text: t('world.clearChatTitle'),
      role: 'destructive',
      icon: trashOutline,
      handler: () => {
        nextTick(() => confirmClear())
      },
    },
    { text: t('common.cancel'), role: 'cancel' },
  )

  const sheet = await actionSheetController.create({
    header: t('world.moreActions'),
    buttons,
  })
  await sheet.present()
}

/**
 * Export conversation in different formats.
 */
async function handleExport() {
  if (messages.value.length === 0)
    return

  const charName = character.value?.name || characterId.value

  const sheet = await actionSheetController.create({
    header: t('world.exportTitle'),
    buttons: [
      {
        text: t('world.exportAdvMd'),
        handler: () => exportAsAdvMd(charName),
      },
      {
        text: t('world.exportMarkdown'),
        handler: () => exportAsMarkdown(charName),
      },
      {
        text: t('common.cancel'),
        role: 'cancel',
      },
    ],
  })
  await sheet.present()
}

function conversationToAdvMd(charName: string): string {
  const lines: string[] = [
    '---',
    `plotSummary: ${t('world.exportPlotSummary', { name: charName })}`,
    '---',
    '',
  ]

  for (const msg of messages.value) {
    if (msg.role === 'user') {
      // User messages become narrator or a generic speaker
      lines.push(`@Player`)
      lines.push(msg.content)
      lines.push('')
    }
    else {
      lines.push(`@${charName}`)
      lines.push(msg.content)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function conversationToMarkdown(charName: string): string {
  const lines: string[] = [
    `# ${t('world.exportConversationWith', { name: charName })}`,
    '',
    `> ${t('world.exportDate', { date: new Date().toLocaleDateString() })}`,
    '',
  ]

  for (const msg of messages.value) {
    const speaker = msg.role === 'user' ? 'Player' : charName
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    lines.push(`**${speaker}** (${time}):`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')
  }

  return lines.join('\n')
}

async function exportAsAdvMd(charName: string) {
  const content = conversationToAdvMd(charName)
  const safeName = charName.toLowerCase().replace(SAFE_FILENAME_RE, '_').replace(TRIM_UNDERSCORE_RE, '')
  const filename = `adv/chapters/chat-${safeName}.adv.md`

  await saveExportedFile(filename, content)
}

async function exportAsMarkdown(charName: string) {
  const content = conversationToMarkdown(charName)
  const safeName = charName.toLowerCase().replace(SAFE_FILENAME_RE, '_').replace(TRIM_UNDERSCORE_RE, '')
  const filename = `chat-${safeName}.md`

  // Markdown export always downloads (not saved to project structure)
  downloadAsFile(content, filename)

  const toast = await toastController.create({
    message: t('world.exportSuccess'),
    duration: 2000,
    position: 'top',
  })
  await toast.present()
}

async function saveExportedFile(filename: string, content: string) {
  const project = studioStore.currentProject

  try {
    if (project?.dirHandle) {
      await writeFileToDir(project.dirHandle, filename, content)
    }
    else if (project?.source === 'cos' && project.cosPrefix) {
      const key = `${project.cosPrefix}${filename}`
      await uploadToCloud(settingsStore.cos, key, content)
    }
    else {
      // Fallback: download
      downloadAsFile(content, filename.split('/').pop() || 'export.md')
    }

    const toast = await toastController.create({
      message: t('world.exportSavedTo', { file: filename }),
      duration: 2000,
      position: 'top',
      color: 'success',
    })
    await toast.present()
  }
  catch {
    const toast = await toastController.create({
      message: t('world.exportFailed'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

function handleSearchJump(index: number) {
  // If the target message is outside the visible range, expand displayCount
  const totalMessages = allMessages.value.length
  const visibleStart = Math.max(0, totalMessages - displayCount.value)
  if (index < visibleStart) {
    // Expand to include the target message plus some buffer
    displayCount.value = totalMessages - index + PAGE_SIZE
  }

  // Map absolute index to visible index
  const newVisibleStart = Math.max(0, totalMessages - displayCount.value)
  const visibleIndex = index - newVisibleStart

  nextTick(() => {
    const el = studioPageRef.value?.contentRef?.$el
    if (!el)
      return
    const msgElements = el.querySelectorAll('.message')
    if (msgElements[visibleIndex]) {
      msgElements[visibleIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief highlight
      msgElements[visibleIndex].classList.add('message--highlight')
      setTimeout(() => {
        msgElements[visibleIndex].classList.remove('message--highlight')
      }, 1500)
    }
  })
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    send()
  }
}

// --- Snapshot helpers ---

const snapshotList = computed(() => characterChatStore.getSnapshots(characterId.value))

async function handleCreateSnapshot() {
  if (messages.value.length === 0)
    return
  characterChatStore.createSnapshot(characterId.value)
  const toast = await toastController.create({
    message: t('world.snapshotCreated'),
    duration: 1500,
    position: 'top',
    color: 'success',
  })
  await toast.present()
}

async function handleRestoreSnapshot(snapshotId: string) {
  const alert = await alertController.create({
    header: t('world.restoreSnapshot'),
    message: t('world.restoreSnapshotConfirm'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.ok'),
        handler: () => {
          characterChatStore.restoreSnapshot(characterId.value, snapshotId)
        },
      },
    ],
  })
  await alert.present()
}

async function handleDeleteSnapshot(snapshotId: string) {
  const alert = await alertController.create({
    header: t('world.deleteSnapshot'),
    message: t('world.deleteSnapshotConfirm'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.clear'),
        role: 'destructive',
        handler: () => {
          characterChatStore.deleteSnapshot(characterId.value, snapshotId)
        },
      },
    ],
  })
  await alert.present()
}

// --- Diary helpers ---

const diaryEntries = computed(() => diaryStore.getDiaries(characterId.value))
const isDiaryGenerating = computed(() => diaryStore.isGenerating(characterId.value))

const currentAiOverride = computed(() => characterChatStore.getAiOverride(characterId.value))

async function handleSaveAiOverride(config: CharacterAiOverride | undefined) {
  if (config) {
    await characterChatStore.setAiOverride(characterId.value, config)
  }
  else {
    await characterChatStore.clearAiOverride(characterId.value)
  }
  showAiSettings.value = false
  const toast = await toastController.create({
    message: t('world.aiSettingsSaved'),
    duration: 1500,
    position: 'top',
    color: 'success',
  })
  await toast.present()
}

// --- TTS helpers ---

function getTtsSettings() {
  const c = aiSettingsStore.config
  return {
    provider: c.ttsProvider,
    apiKey: c.ttsApiKey,
    model: c.ttsModel,
    voice: c.ttsVoice,
    speed: c.ttsSpeed,
    customBaseURL: c.ttsCustomBaseURL,
  }
}

async function handleTtsPlay(msg: { role: string, content: string, timestamp: number, ttsAudioPath?: string }, visibleIdx: number) {
  // If already playing this message, stop
  if (ttsPlayingIndex.value === visibleIdx) {
    ttsStop()
    ttsPlayingIndex.value = -1
    return
  }

  // Stop any current playback
  ttsStop()
  ttsPlayingIndex.value = visibleIdx

  try {
    // Check for cached audio first
    if (msg.ttsAudioPath) {
      const project = studioStore.currentProject
      if (project?.dirHandle) {
        try {
          const blobUrl = await readBlobFromDir(project.dirHandle, msg.ttsAudioPath)
          const audio = new Audio(blobUrl)
          ttsPlayingIndex.value = visibleIdx
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve()
            audio.onerror = () => resolve()
            audio.play()
          })
          URL.revokeObjectURL(blobUrl)
          ttsPlayingIndex.value = -1
          return
        }
        catch {
          // Cache miss — regenerate
        }
      }
    }

    ttsGeneratingIndex.value = visibleIdx
    const settings = getTtsSettings()
    const blob = await ttsSpeak(msg.content, settings)
    ttsGeneratingIndex.value = -1

    // If blob returned (API provider), cache it
    if (blob) {
      const project = studioStore.currentProject
      if (project?.dirHandle) {
        const safeName = characterId.value.replace(SAFE_FILENAME_RE, '_').replace(TRIM_UNDERSCORE_RE, '')
        const path = `adv/audio/tts/${safeName}-${msg.timestamp}.mp3`
        try {
          await writeBlobToDir(project.dirHandle, path, blob)
          characterChatStore.updateMessageTtsPath(characterId.value, msg.timestamp, path)
        }
        catch {
          // Silently fail caching
        }
      }
    }
  }
  catch (err) {
    ttsGeneratingIndex.value = -1
    const toast = await toastController.create({
      message: err instanceof Error ? err.message : t('world.ttsGenerateFailed'),
      duration: 2500,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
  finally {
    ttsPlayingIndex.value = -1
  }
}

async function handleBatchGenerateTts() {
  if (ttsBatchGenerating.value)
    return

  const settings = getTtsSettings()
  const provider = getTtsProvider(settings.provider)
  if (!provider?.canGenerateBlob || !provider.generate)
    return

  const project = studioStore.currentProject
  if (!project?.dirHandle)
    return

  const assistantMsgs = allMessages.value.filter(m => m.role === 'assistant' && !m.ttsAudioPath)
  if (assistantMsgs.length === 0)
    return

  ttsBatchGenerating.value = true
  let generated = 0

  for (const msg of assistantMsgs) {
    try {
      const toast = await toastController.create({
        message: t('world.ttsGenerateProgress', { current: generated + 1, total: assistantMsgs.length }),
        duration: 3000,
        position: 'top',
      })
      await toast.present()

      const blob = await provider.generate({
        text: msg.content,
        voice: settings.voice,
        model: settings.model,
        speed: settings.speed,
        apiKey: settings.apiKey,
        baseURL: settings.provider === 'custom' ? settings.customBaseURL : (provider.baseURL || ''),
      })

      const safeName = characterId.value.replace(SAFE_FILENAME_RE, '_').replace(TRIM_UNDERSCORE_RE, '')
      const path = `adv/audio/tts/${safeName}-${msg.timestamp}.mp3`
      await writeBlobToDir(project.dirHandle, path, blob)
      characterChatStore.updateMessageTtsPath(characterId.value, msg.timestamp, path)
      generated++
    }
    catch {
      // Skip failed messages, continue with next
    }
  }

  ttsBatchGenerating.value = false

  const toast = await toastController.create({
    message: t('world.ttsGenerateComplete', { count: generated }),
    duration: 2000,
    position: 'top',
    color: 'success',
  })
  await toast.present()
}

async function handleGenerateDiary() {
  if (!character.value)
    return

  // Check for duplicate before calling AI
  const { useWorldClockStore } = await import('../stores/useWorldClockStore')
  const clockStore = useWorldClockStore()
  const { date, period } = clockStore.clock
  if (diaryStore.hasDiary(characterId.value, date, period)) {
    const toast = await toastController.create({
      message: t('world.diaryAlreadyExists'),
      duration: 2500,
      position: 'top',
      color: 'warning',
    })
    await toast.present()
    return
  }

  const entry = await diaryStore.generateDiary(character.value)
  if (!entry) {
    const toast = await toastController.create({
      message: t('world.diaryGenerateFailed'),
      duration: 2500,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

async function handleDeleteDiary(diaryId: string) {
  const alert = await alertController.create({
    header: t('world.diaryDelete'),
    message: t('world.diaryDeleteConfirm'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.clear'),
        role: 'destructive',
        handler: () => {
          diaryStore.deleteDiary(characterId.value, diaryId)
        },
      },
    ],
  })
  await alert.present()
}
</script>

<template>
  <StudioPage ref="studioPageRef">
    <template #start>
      <IonButton @click="goBack">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="arrowBackOutline" />
      </IonButton>
    </template>
    <template #title>
      {{ character?.name || characterId }}
      <span v-if="messages.length > 0" class="header-mood">{{ moodEmoji }}</span>
    </template>
    <template #end>
      <IonButton @click="showSearch = !showSearch">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="searchOutline" />
      </IonButton>
      <IonButton @click="showMoreActions">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="ellipsisVertical" />
      </IonButton>
    </template>

    <template #header-extra>
      <!-- Search bar (collapsible) -->
      <ChatHistorySearch
        v-if="showSearch"
        :messages="allMessages"
        @jump-to="handleSearchJump"
        @close="showSearch = false"
      />

      <!-- Snapshot panel (collapsible) -->
      <div v-if="showSnapshots" class="snapshot-panel">
        <div class="snapshot-panel__header">
          <span>📸 {{ t('world.snapshots') }}</span>
          <button
            class="snapshot-create-btn"
            :disabled="messages.length === 0"
            @click="handleCreateSnapshot"
          >
            + {{ t('world.createSnapshot') }}
          </button>
        </div>
        <div v-if="snapshotList.length === 0" class="snapshot-empty">
          {{ t('world.noSnapshots') }}
        </div>
        <div v-else class="snapshot-list">
          <div
            v-for="snap in snapshotList"
            :key="snap.id"
            class="snapshot-item"
          >
            <div class="snapshot-item__info">
              <div class="snapshot-item__label">
                {{ snap.label }}
              </div>
              <div class="snapshot-item__meta">
                {{ formatChatTime(snap.createdAt) }} · {{ snap.messages.length }} {{ t('world.snapshotMessages') }}
              </div>
            </div>
            <div class="snapshot-item__actions">
              <button class="snapshot-btn snapshot-btn--restore" @click="handleRestoreSnapshot(snap.id)">
                {{ t('world.restoreSnapshot') }}
              </button>
              <button class="snapshot-btn snapshot-btn--delete" @click="handleDeleteSnapshot(snap.id)">
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div class="messages-container" role="log" aria-live="polite" :aria-label="t('world.chatMessages')">
      <!-- Welcome state -->
      <CharacterChatWelcome
        v-if="character && messages.length === 0"
        :character="character"
        @send="quickSend"
      />

      <!-- Load earlier messages button -->
      <div v-if="hasMore" class="load-earlier">
        <button class="load-earlier-btn" @click="loadMore">
          {{ t('chat.loadEarlier') }}
        </button>
        <span class="load-earlier-hint">{{ t('chat.messagesHidden', { count: hiddenCount }) }}</span>
      </div>

      <TransitionGroup name="msg">
        <div
          v-for="(msg, index) in visibleMessages"
          :key="getAbsoluteIndex(index)"
          class="message"
          :class="[msg.role]"
        >
          <div class="bubble">
            <MarkdownMessage v-if="msg.role === 'assistant'" :content="msg.content" />
            <template v-else>
              {{ msg.content }}
            </template>
          </div>
          <div class="message__actions">
            <button
              v-if="msg.role === 'assistant' && aiSettingsStore.config.ttsProvider !== 'none'"
              class="tts-btn"
              :class="{
                'tts-btn--playing': ttsPlayingIndex === index,
                'tts-btn--generating': ttsGeneratingIndex === index,
                'tts-btn--cached': !!msg.ttsAudioPath,
              }"
              :aria-label="ttsPlayingIndex === index ? t('world.ttsStop') : t('world.ttsPlay')"
              :aria-pressed="ttsPlayingIndex === index"
              :disabled="ttsGeneratingIndex === index"
              @click="handleTtsPlay(msg, index)"
            >
              <IonIcon :icon="ttsPlayingIndex === index ? volumeMuteOutline : volumeHighOutline" />
            </button>
            <span class="time">
              {{ formatChatTime(msg.timestamp) }}
            </span>
          </div>
        </div>
      </TransitionGroup>

      <!-- Typing indicator -->
      <Transition name="msg">
        <div v-if="characterChatStore.isLoading && !characterChatStore.streamingContent" class="message assistant">
          <div class="bubble">
            <div class="typing-indicator">
              <span class="typing-dot" />
              <span class="typing-dot" />
              <span class="typing-dot" />
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <template #footer>
      <IonToolbar>
        <div class="chat-input-bar">
          <IonInput
            v-model="inputText"
            :placeholder="t('world.chatPlaceholder')"
            :disabled="!character"
            :clear-input="true"
            class="chat-input"
            :aria-label="t('world.chatPlaceholder')"
            @keydown="handleKeydown"
          />
          <IonButton
            v-if="characterChatStore.isLoading"
            shape="round"
            fill="solid"
            color="danger"
            class="chat-send-btn"
            :aria-label="t('world.stopGeneration')"
            @click="characterChatStore.stopGeneration()"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="stopOutline" />
          </IonButton>
          <IonButton
            v-else
            shape="round"
            fill="solid"
            class="chat-send-btn"
            :disabled="!inputText.trim() || !character"
            :aria-label="t('world.send')"
            @click="send"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="sendOutline" />
          </IonButton>
        </div>
      </IonToolbar>
    </template>

    <!-- Character Info Modal -->
    <CharacterInfoModal
      v-if="character"
      :character="character"
      :is-open="showInfoModal"
      :dynamic-state="dynamicState"
      :knowledge-entries="knowledgeBase.entries.value"
      :knowledge-loading="knowledgeBase.isLoading.value"
      :diaries="diaryEntries"
      :is-diary-generating="isDiaryGenerating"
      :memory="memory"
      @close="showInfoModal = false"
      @refresh-knowledge="reloadKnowledge"
      @generate-diary="handleGenerateDiary"
      @delete-diary="handleDeleteDiary"
    />

    <!-- AI Settings Modal -->
    <IonModal :is-open="showAiSettings" :initial-breakpoint="0.6" :breakpoints="[0, 0.6, 0.85]" @did-dismiss="showAiSettings = false">
      <IonHeader>
        <IonToolbar>
          <IonTitle>{{ t('world.aiSettings') }} · {{ character?.name || characterId }}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <CharacterAiSettingsForm
          :character-id="characterId"
          :character-name="character?.name || characterId"
          :override="currentAiOverride"
          @save="handleSaveAiOverride"
        />
      </IonContent>
    </IonModal>

    <!-- Archive Viewer Modal -->
    <IonModal :is-open="showArchive" :initial-breakpoint="0.5" :breakpoints="[0, 0.5, 0.85]" @did-dismiss="showArchive = false">
      <IonHeader>
        <IonToolbar>
          <IonTitle>{{ t('world.archiveTitle') }} · {{ character?.name || characterId }}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent class="archive-content">
        <div v-if="archivedBatches.length === 0" class="archive-empty">
          {{ t('world.archiveEmpty') }}
        </div>
        <div v-else class="archive-list">
          <details
            v-for="batch in archivedBatches"
            :key="batch.batchId"
            class="archive-batch"
          >
            <summary class="archive-batch__summary">
              <span class="archive-batch__date">{{ formatChatTime(batch.archivedAt) }}</span>
              <span class="archive-batch__badge">{{ t('world.archiveMessages', { count: batch.messages.length }) }}</span>
              <p v-if="batch.summary" class="archive-batch__text">
                {{ batch.summary }}
              </p>
            </summary>
            <div class="archive-batch__messages">
              <div
                v-for="(msg, idx) in batch.messages"
                :key="idx"
                class="message"
                :class="[msg.role]"
              >
                <div class="bubble">
                  {{ msg.content }}
                </div>
                <div class="time">
                  {{ formatChatTime(msg.timestamp) }}
                </div>
              </div>
            </div>
          </details>
        </div>
      </IonContent>
    </IonModal>
  </StudioPage>
</template>

<style scoped>
.header-mood {
  font-size: 16px;
  margin-left: 4px;
}

/* Reuse ChatPage footer styles */
ion-footer ion-toolbar {
  --background: var(--adv-surface-card);
  --border-width: 0;
  box-shadow:
    0 -1px 6px rgba(0, 0, 0, 0.06),
    0 -1px 2px rgba(0, 0, 0, 0.04);
}

:root.dark ion-footer ion-toolbar {
  box-shadow:
    0 -1px 8px rgba(0, 0, 0, 0.3),
    0 -1px 2px rgba(0, 0, 0, 0.2);
}

.chat-input-bar {
  display: flex;
  align-items: center;
  padding: var(--adv-space-sm) var(--adv-space-md);
  gap: var(--adv-space-sm);
}

.chat-input {
  flex: 1;
  --background: var(--adv-surface-elevated);
  --border-radius: var(--adv-radius-xl);
  --padding-start: var(--adv-space-md);
  --padding-end: var(--adv-space-md);
  --min-height: 44px;
  height: 44px;
}

.chat-send-btn {
  --padding-start: 10px;
  --padding-end: 10px;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

/* Message highlight animation for search jump */
:deep(.message--highlight .bubble) {
  animation: highlight-pulse 1.5s ease-out;
}

@keyframes highlight-pulse {
  0% {
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.5);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
  }
}

.load-earlier {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--adv-space-sm) 0;
  gap: 4px;
}

.load-earlier-btn {
  background: var(--adv-surface-elevated);
  color: var(--adv-text-secondary);
  border: 1px solid var(--adv-border-light);
  border-radius: var(--adv-radius-lg);
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.load-earlier-btn:hover {
  background: var(--adv-surface-card);
}

.load-earlier-hint {
  font-size: 11px;
  color: var(--adv-text-tertiary);
}

/* Snapshot Panel */
.snapshot-panel {
  background: var(--adv-surface-card, #fff);
  border-top: 1px solid var(--adv-border-light, #e2e8f0);
  padding: var(--adv-space-sm) var(--adv-space-md);
  max-height: 240px;
  overflow-y: auto;
}

:root.dark .snapshot-panel {
  background: var(--adv-surface-card, #1e1e2e);
  border-top-color: var(--adv-border-light, #2a2a3e);
}

.snapshot-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--adv-space-xs, 4px);
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.snapshot-create-btn {
  font-size: 12px;
  padding: 3px 10px;
  background: var(--adv-primary, #8b5cf6);
  color: #fff;
  border: none;
  border-radius: var(--adv-radius-md, 8px);
  cursor: pointer;
  transition: opacity 0.2s;
}

.snapshot-create-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.snapshot-empty {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary, #94a3b8);
  padding: var(--adv-space-xs) 0;
  text-align: center;
}

.snapshot-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.snapshot-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: var(--adv-surface-elevated, #f1f5f9);
  border-radius: var(--adv-radius-md, 8px);
  gap: var(--adv-space-sm, 8px);
}

:root.dark .snapshot-item {
  background: var(--adv-surface-elevated, #2a2a3e);
}

.snapshot-item__info {
  flex: 1;
  min-width: 0;
}

.snapshot-item__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--adv-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.snapshot-item__meta {
  font-size: 11px;
  color: var(--adv-text-tertiary, #94a3b8);
}

.snapshot-item__actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.snapshot-btn {
  font-size: 12px;
  padding: 3px 8px;
  border: none;
  border-radius: var(--adv-radius-sm, 4px);
  cursor: pointer;
  transition: opacity 0.2s;
}

.snapshot-btn--restore {
  background: var(--adv-primary-light, #ede9fe);
  color: var(--adv-primary, #8b5cf6);
}

:root.dark .snapshot-btn--restore {
  background: var(--adv-surface-hover, #3a3a4e);
  color: var(--adv-primary, #a78bfa);
}

.snapshot-btn--delete {
  background: transparent;
  color: var(--adv-text-tertiary, #94a3b8);
}

.snapshot-btn--delete:hover {
  color: var(--adv-danger, #ef4444);
}

/* Archive Viewer */
.archive-content {
  --padding-start: var(--adv-space-md, 16px);
  --padding-end: var(--adv-space-md, 16px);
  --padding-top: var(--adv-space-sm, 8px);
}

.archive-empty {
  text-align: center;
  color: var(--adv-text-tertiary, #94a3b8);
  font-size: var(--adv-font-body-sm, 13px);
  padding: var(--adv-space-xl, 32px) 0;
}

.archive-list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-sm, 8px) 0;
}

.archive-batch {
  background: var(--adv-surface-elevated, #f1f5f9);
  border-radius: var(--adv-radius-lg, 12px);
  overflow: hidden;
}

:root.dark .archive-batch {
  background: var(--adv-surface-elevated, #2a2a3e);
}

.archive-batch__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-sm, 8px) var(--adv-space-md, 16px);
  cursor: pointer;
  user-select: none;
  font-size: var(--adv-font-body-sm, 13px);
}

.archive-batch__summary::-webkit-details-marker {
  display: none;
}

.archive-batch__summary::before {
  content: '▶';
  font-size: 10px;
  color: var(--adv-text-tertiary, #94a3b8);
  transition: transform 0.2s;
}

.archive-batch[open] > .archive-batch__summary::before {
  transform: rotate(90deg);
}

.archive-batch__date {
  font-weight: 600;
  color: var(--adv-text-primary);
}

.archive-batch__badge {
  font-size: 11px;
  background: var(--adv-primary-light, #ede9fe);
  color: var(--adv-primary, #8b5cf6);
  padding: 1px 8px;
  border-radius: var(--adv-radius-sm, 4px);
}

:root.dark .archive-batch__badge {
  background: var(--adv-surface-hover, #3a3a4e);
  color: var(--adv-primary, #a78bfa);
}

.archive-batch__text {
  width: 100%;
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--adv-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.archive-batch[open] .archive-batch__text {
  white-space: normal;
}

.archive-batch__messages {
  padding: 0 var(--adv-space-md, 16px) var(--adv-space-md, 16px);
  border-top: 1px solid var(--adv-border-light, #e2e8f0);
}

:root.dark .archive-batch__messages {
  border-top-color: var(--adv-border-light, #2a2a3e);
}

/* TTS Button */
.message__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tts-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--adv-radius-sm, 4px);
  background: transparent;
  color: var(--adv-text-tertiary, #94a3b8);
  cursor: pointer;
  transition:
    color 0.2s,
    background 0.2s;
  flex-shrink: 0;
  font-size: 16px;
}

.tts-btn:hover {
  color: var(--adv-primary, #8b5cf6);
  background: rgba(139, 92, 246, 0.08);
}

.tts-btn--playing {
  color: var(--adv-primary, #8b5cf6);
  animation: tts-pulse 1.5s ease-in-out infinite;
}

.tts-btn--generating {
  color: var(--adv-text-tertiary, #94a3b8);
  animation: tts-spin 1s linear infinite;
  cursor: wait;
}

.tts-btn--cached {
  color: var(--adv-text-secondary, #64748b);
}

.tts-btn--cached:hover {
  color: var(--adv-primary, #8b5cf6);
}

.tts-btn:disabled {
  cursor: wait;
  opacity: 0.5;
}

@keyframes tts-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes tts-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
