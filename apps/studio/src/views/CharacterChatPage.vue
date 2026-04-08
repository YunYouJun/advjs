<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import {
  actionSheetController,
  alertController,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import {
  arrowBackOutline,
  cameraOutline,
  downloadOutline,
  ellipsisVertical,
  informationCircleOutline,
  searchOutline,
  sendOutline,
  stopOutline,
  trashOutline,
} from 'ionicons/icons'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import CharacterChatWelcome from '../components/CharacterChatWelcome.vue'
import CharacterInfoModal from '../components/CharacterInfoModal.vue'
import ChatHistorySearch from '../components/ChatHistorySearch.vue'
import MarkdownMessage from '../components/MarkdownMessage.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useWorldContext } from '../composables/useWorldContext'
import { useCharacterChatStore } from '../stores/useCharacterChatStore'
import { useCharacterDiaryStore } from '../stores/useCharacterDiaryStore'
import { useCharacterMemoryStore } from '../stores/useCharacterMemoryStore'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { useViewModeStore } from '../stores/useViewModeStore'
import { formatChatTime, getMoodEmoji } from '../utils/chatUtils'
import { uploadToCloud } from '../utils/cloudSync'
import { downloadAsFile, writeFileToDir } from '../utils/fileAccess'
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

function getEffectiveWorldContext(): string {
  return viewModeStore.getEffectiveWorldContext(worldContext.value)
}

const inputText = ref('')
const contentRef = ref<InstanceType<typeof IonContent> | null>(null)
const showInfoModal = ref(false)
const showSearch = ref(false)
const showSnapshots = ref(false)

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
  contentRef.value?.$el?.scrollToBottom?.(300)
})

// Also scroll when streaming content updates
watch(() => characterChatStore.streamingContent, async () => {
  await nextTick()
  contentRef.value?.$el?.scrollToBottom?.(100)
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
  const sheet = await actionSheetController.create({
    header: t('world.moreActions'),
    buttons: [
      {
        text: t('world.snapshots'),
        icon: cameraOutline,
        handler: () => { showSnapshots.value = !showSnapshots.value },
      },
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
    ],
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
    const el = contentRef.value?.$el
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
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonButton @click="goBack">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="arrowBackOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle>
          {{ character?.name || characterId }}
          <span v-if="messages.length > 0" class="header-mood">{{ moodEmoji }}</span>
        </IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="end">
          <IonButton @click="showSearch = !showSearch">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="searchOutline" />
          </IonButton>
          <IonButton @click="showMoreActions">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="ellipsisVertical" />
          </IonButton>
        </IonButtons>
      </IonToolbar>

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
    </IonHeader>

    <IonContent ref="contentRef" :fullscreen="true">
      <div class="messages-container">
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
            <div class="time">
              {{ formatChatTime(msg.timestamp) }}
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
    </IonContent>

    <IonFooter>
      <IonToolbar>
        <div class="chat-input-bar">
          <IonInput
            v-model="inputText"
            :placeholder="t('world.chatPlaceholder')"
            :disabled="!character"
            :clear-input="true"
            class="chat-input"
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
    </IonFooter>

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
  </IonPage>
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
</style>
