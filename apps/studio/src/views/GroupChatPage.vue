<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { ChatMessage } from '../stores/useChatStore'
import {
  actionSheetController,
  alertController,
  IonButton,
  IonIcon,
  IonInput,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import {
  arrowBackOutline,
  cameraOutline,
  downloadOutline,
  searchOutline,
  sendOutline,
  stopOutline,
  trashOutline,
  volumeHighOutline,
  volumeMuteOutline,
} from 'ionicons/icons'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ChatHistorySearch from '../components/ChatHistorySearch.vue'
import LayoutPage from '../components/common/LayoutPage.vue'
import MarkdownMessage from '../components/MarkdownMessage.vue'
import MessageActions from '../components/MessageActions.vue'
import SnapshotTree from '../components/SnapshotTree.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useWorldContext } from '../composables/useWorldContext'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { useCharacterChatStore } from '../stores/useCharacterChatStore'
import { useCharacterMemoryStore } from '../stores/useCharacterMemoryStore'
import { useGroupChatStore } from '../stores/useGroupChatStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { useViewModeStore } from '../stores/useViewModeStore'
import { formatChatTime, getCharacterInitials, getMoodEmoji, getValidAvatarUrl } from '../utils/chatUtils'
import { uploadToCloud } from '../utils/cloudSync'
import { downloadAsFile, writeFileToDir } from '../utils/fileAccess'
import { resolveCharacterTtsSettings } from '../utils/resolveAiConfig'
import { ttsSpeak, ttsStop } from '../utils/ttsClient'
import '../styles/chat.css'
import '../styles/group-chat.css'

type LayoutPageInstance = InstanceType<typeof LayoutPage>

const SAFE_FILENAME_RE = /[^a-z0-9\u4E00-\u9FFF]+/g
const TRIM_UNDERSCORE_RE = /^_|_$/g

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const groupChatStore = useGroupChatStore()
const { characters } = useProjectContent()
const { worldContext } = useWorldContext()
const viewModeStore = useViewModeStore()
const memoryStore = useCharacterMemoryStore()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const aiSettingsStore = useAiSettingsStore()
const characterChatStore = useCharacterChatStore()

// --- TTS state ---
const ttsPlayingIndex = ref(-1)
const ttsGeneratingIndex = ref(-1)

onUnmounted(() => ttsStop())

async function handleGroupTtsPlay(msg: { characterId?: string, content: string }, visibleIdx: number) {
  if (ttsPlayingIndex.value === visibleIdx) {
    ttsStop()
    ttsPlayingIndex.value = -1
    return
  }

  ttsStop()
  ttsPlayingIndex.value = visibleIdx

  try {
    ttsGeneratingIndex.value = visibleIdx
    const override = msg.characterId ? characterChatStore.getAiOverride(msg.characterId) : undefined
    const settings = resolveCharacterTtsSettings(aiSettingsStore.config, override)
    await ttsSpeak(msg.content, settings)
    ttsGeneratingIndex.value = -1
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

const characterMap = computed(() => {
  const m = new Map<string, AdvCharacter>()
  for (const c of characters.value)
    m.set(c.id, c)
  return m
})

function getParticipantMood(characterId: string): string {
  const mem = memoryStore.getMemory(characterId)
  return mem?.emotionalState.mood ? getMoodEmoji(mem.emotionalState.mood) : ''
}

function getEffectiveWorldContext(): string {
  return viewModeStore.getEffectiveWorldContext(worldContext.value)
}

const inputText = ref('')
const layoutPageRef = ref<LayoutPageInstance | null>(null)
const showSearch = ref(false)

const roomId = computed(() => route.params.roomId as string)

const room = computed(() => {
  return groupChatStore.getRoom(roomId.value)
})

const allMessages = computed(() => {
  return room.value?.messages || []
})

// --- Pagination ---
const PAGE_SIZE = 50
const displayCount = ref(PAGE_SIZE)

const hasMore = computed(() => allMessages.value.length > displayCount.value)
const hiddenCount = computed(() => Math.max(0, allMessages.value.length - displayCount.value))

const visibleMessages = computed(() => {
  const start = Math.max(0, allMessages.value.length - displayCount.value)
  return allMessages.value.slice(start)
})

function loadMore() {
  displayCount.value += PAGE_SIZE
}

// Reset pagination when switching rooms
watch(roomId, () => {
  displayCount.value = PAGE_SIZE
})

// Keep backward-compat alias
const messages = allMessages

const participants = computed(() => {
  if (!room.value)
    return []
  return characters.value.filter(c => room.value!.participantIds.includes(c.id))
})

/** Map character ID to its index for coloring */
const participantIndexMap = computed(() => {
  const map = new Map<string, number>()
  if (room.value) {
    room.value.participantIds.forEach((id, index) => {
      map.set(id, index % 6)
    })
  }
  return map
})

function getColorIndex(characterId?: string): number {
  if (!characterId)
    return 0
  return participantIndexMap.value.get(characterId) ?? 0
}

function getAvatarInitial(name?: string): string {
  if (!name)
    return '?'
  return name.charAt(0)
}

// Auto-scroll to bottom when messages change
watch(() => visibleMessages.value.length, async () => {
  await nextTick()
  layoutPageRef.value?.contentRef?.$el?.scrollToBottom?.(300)
})

// Also scroll when streaming content updates
watch(() => groupChatStore.streamingContent, async () => {
  await nextTick()
  layoutPageRef.value?.contentRef?.$el?.scrollToBottom?.(100)
})

// Auto-read: when group AI finishes responding, auto-play TTS for the last character message
watch(() => groupChatStore.isLoading, (newVal, oldVal) => {
  if (oldVal && !newVal && aiSettingsStore.config.ttsAutoRead) {
    const msgs = allMessages.value
    if (msgs.length > 0) {
      const lastMsg = msgs.at(-1)
      if (lastMsg?.role === 'character' && lastMsg.content) {
        handleGroupTtsPlay(lastMsg, msgs.length - 1)
      }
    }
  }
})

function goBack() {
  router.push('/tabs/world')
}

async function send() {
  const text = inputText.value.trim()
  if (!text || !room.value)
    return

  inputText.value = ''
  groupChatStore.sendPlayerMessage(
    roomId.value,
    text,
    characters.value,
    getEffectiveWorldContext(),
  )
}

async function continueTurn() {
  if (!room.value)
    return
  groupChatStore.generateNextTurn(
    roomId.value,
    characters.value,
    getEffectiveWorldContext(),
  )
}

async function confirmDelete() {
  const alert = await alertController.create({
    header: t('world.deleteGroupChat'),
    message: t('world.deleteGroupChatMessage'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.ok'),
        role: 'destructive',
        handler: () => {
          groupChatStore.deleteRoom(roomId.value)
          router.push('/tabs/world')
        },
      },
    ],
  })
  await alert.present()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    send()
  }
}

// --- Search ---

function handleSearchJump(index: number) {
  const totalMessages = allMessages.value.length
  const curVisibleStart = Math.max(0, totalMessages - displayCount.value)
  if (index < curVisibleStart) {
    displayCount.value = totalMessages - index + PAGE_SIZE
  }
  const newVisibleStart = Math.max(0, totalMessages - displayCount.value)
  const visibleIndex = index - newVisibleStart
  nextTick(() => {
    const el = layoutPageRef.value?.contentRef?.$el
    if (!el)
      return
    const msgEls = el.querySelectorAll('.group-message')
    if (msgEls[visibleIndex]) {
      msgEls[visibleIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
      msgEls[visibleIndex].classList.add('group-message--highlight')
      setTimeout(() => {
        msgEls[visibleIndex].classList.remove('group-message--highlight')
      }, 1500)
    }
  })
}

// --- Export ---

async function handleExport() {
  if (allMessages.value.length === 0)
    return
  const roomName = room.value?.name || roomId.value
  const sheet = await actionSheetController.create({
    header: t('world.exportTitle'),
    buttons: [
      { text: t('world.exportAdvMd'), handler: () => exportGroupAsAdvMd(roomName) },
      { text: t('world.exportMarkdown'), handler: () => exportGroupAsMarkdown(roomName) },
      { text: t('world.exportHtml'), handler: () => exportGroupAsHtml(roomName) },
      { text: t('common.cancel'), role: 'cancel' },
    ],
  })
  await sheet.present()
}

function getSpeakerName(msg: { role: string, characterName?: string }): string {
  if (msg.role === 'user')
    return t('systemPrompt.player')
  return msg.characterName || t('world.viewModeCharacter')
}

function groupConversationToAdvMd(roomName: string): string {
  const lines: string[] = [
    '---',
    `plotSummary: ${t('world.groupChats')} - ${roomName}`,
    '---',
    '',
  ]
  for (const msg of allMessages.value) {
    lines.push(`@${getSpeakerName(msg)}`)
    lines.push(msg.content)
    lines.push('')
  }
  return lines.join('\n')
}

function groupConversationToMarkdown(roomName: string): string {
  const lines: string[] = [
    `# Group Chat: ${roomName}`,
    '',
    `> ${new Date().toLocaleDateString()}`,
    '',
  ]
  for (const msg of allMessages.value) {
    const speaker = getSpeakerName(msg)
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    lines.push(`**${speaker}** (${time}):`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')
  }
  return lines.join('\n')
}

async function exportGroupAsAdvMd(roomName: string) {
  const content = groupConversationToAdvMd(roomName)
  const safeName = roomName.toLowerCase().replace(SAFE_FILENAME_RE, '_').replace(TRIM_UNDERSCORE_RE, '')
  await saveExportedFile(`adv/chapters/group-${safeName}.adv.md`, content)
}

async function exportGroupAsMarkdown(roomName: string) {
  const content = groupConversationToMarkdown(roomName)
  const safeName = roomName.toLowerCase().replace(SAFE_FILENAME_RE, '_').replace(TRIM_UNDERSCORE_RE, '')
  downloadAsFile(content, `group-${safeName}.md`)
  const toast = await toastController.create({
    message: t('world.exportSuccess'),
    duration: 2000,
    position: 'top',
  })
  await toast.present()
}

async function exportGroupAsHtml(roomName: string) {
  const { groupChatToHtml } = await import('../utils/conversationHtml')
  const html = groupChatToHtml(allMessages.value, roomName, {
    title: roomName,
    theme: 'dark',
    projectName: studioStore.currentProject?.name,
  })
  const safeName = roomName.toLowerCase().replace(SAFE_FILENAME_RE, '_').replace(TRIM_UNDERSCORE_RE, '')
  downloadAsFile(html, `group-${safeName}.html`, 'text/html;charset=utf-8')
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
      await uploadToCloud(settingsStore.cos, `${project.cosPrefix}${filename}`, content)
    }
    else {
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

// --- Message Actions ---

async function copyGroupMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    const toast = await toastController.create({
      message: t('chat.messageCopied'),
      duration: 1500,
      position: 'top',
    })
    await toast.present()
  }
  catch {
    const toast = await toastController.create({
      message: t('chat.copyFailed'),
      duration: 1500,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

function deleteGroupMessage(timestamp: number) {
  groupChatStore.deleteMessage(roomId.value, timestamp)
}

function handleRegenerateGroupMessage(timestamp: number) {
  if (!room.value)
    return
  // Delete the message and regenerate
  groupChatStore.deleteMessage(roomId.value, timestamp)
  groupChatStore.generateNextTurn(
    roomId.value,
    participants.value,
    getEffectiveWorldContext(),
  )
}

// --- Snapshot helpers ---

const showSnapshots = ref(false)
const snapshotView = ref<'list' | 'tree'>('list')

const snapshotList = computed(() => groupChatStore.getRoomSnapshots(roomId.value))

async function handleCreateSnapshot() {
  const snap = groupChatStore.createRoomSnapshot(roomId.value)
  if (snap) {
    const toast = await toastController.create({
      message: t('world.snapshotCreated'),
      duration: 1500,
      position: 'top',
      color: 'success',
    })
    await toast.present()
  }
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
          groupChatStore.restoreRoomSnapshot(roomId.value, snapshotId)
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
          groupChatStore.deleteRoomSnapshot(roomId.value, snapshotId)
        },
      },
    ],
  })
  await alert.present()
}
</script>

<template>
  <LayoutPage ref="layoutPageRef" :title="room?.name || roomId">
    <template #start>
      <IonButton @click="goBack">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="arrowBackOutline" />
      </IonButton>
    </template>
    <template #end>
      <IonButton @click="showSearch = !showSearch">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="searchOutline" />
      </IonButton>
      <IonButton :disabled="allMessages.length === 0" @click="handleExport">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="downloadOutline" />
      </IonButton>
      <IonButton @click="showSnapshots = !showSnapshots">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="cameraOutline" />
      </IonButton>
      <IonButton color="danger" @click="confirmDelete">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonIcon slot="icon-only" :icon="trashOutline" />
      </IonButton>
    </template>

    <template #header-extra>
      <!-- Search panel -->
      <ChatHistorySearch
        v-if="showSearch"
        :messages="(allMessages as any)"
        @jump-to="handleSearchJump"
        @close="showSearch = false"
      />

      <!-- Snapshot panel (collapsible) -->
      <div v-if="showSnapshots" class="snapshot-panel">
        <div class="snapshot-panel__header">
          <span>📸 {{ t('world.snapshots') }}</span>
          <div class="snapshot-panel__controls">
            <div class="snapshot-view-toggle">
              <button
                class="snapshot-view-btn"
                :class="{ 'snapshot-view-btn--active': snapshotView === 'list' }"
                @click="snapshotView = 'list'"
              >
                {{ t('world.snapshotListView') }}
              </button>
              <button
                class="snapshot-view-btn"
                :class="{ 'snapshot-view-btn--active': snapshotView === 'tree' }"
                @click="snapshotView = 'tree'"
              >
                {{ t('world.snapshotTreeView') }}
              </button>
            </div>
            <button
              class="snapshot-create-btn"
              :disabled="allMessages.length === 0"
              @click="handleCreateSnapshot"
            >
              + {{ t('world.createSnapshot') }}
            </button>
          </div>
        </div>

        <!-- Tree view -->
        <SnapshotTree
          v-if="snapshotView === 'tree'"
          :snapshots="snapshotList"
          :active-snapshot-id="groupChatStore.activeSnapshotId.get(roomId)"
          @restore="handleRestoreSnapshot"
          @delete="handleDeleteSnapshot"
        />

        <!-- List view (original) -->
        <template v-else>
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
        </template>
      </div>
    </template>

    <!-- Participant Status Bar -->
    <div v-if="room?.participantIds?.length" class="gc-participants">
      <button
        v-for="pid in room.participantIds"
        :key="pid"
        class="gc-participant-chip"
        @click="router.push(`/tabs/world/chat/${pid}`)"
      >
        <img
          v-if="getValidAvatarUrl(characterMap.get(pid)?.avatar)"
          :src="getValidAvatarUrl(characterMap.get(pid)?.avatar)"
          class="gc-chip-avatar"
          alt=""
        >
        <span v-else class="gc-chip-initials">
          {{ getCharacterInitials(characterMap.get(pid)?.name) }}
        </span>
        <span class="gc-chip-name">{{ characterMap.get(pid)?.name || pid }}</span>
        <span v-if="getParticipantMood(pid)" class="gc-chip-mood">{{ getParticipantMood(pid) }}</span>
      </button>
    </div>

    <div class="group-messages-container">
      <!-- Room not found fallback -->
      <div v-if="!room" class="empty-state" style="text-align: center; padding: 40px 20px;">
        <p style="font-size: 1.2em; margin-bottom: 8px;">
          ⚠️
        </p>
        <p>{{ t('world.noGroupChats') }}</p>
        <IonButton fill="outline" size="small" @click="router.push('/tabs/world')">
          {{ t('common.back') }}
        </IonButton>
      </div>

      <!-- Empty state -->
      <div v-else-if="messages.length === 0 && !groupChatStore.isLoading" style="text-align: center; padding: 40px 20px; color: var(--adv-text-tertiary);">
        <p>{{ t('world.groupChatPlaceholder') }}</p>
      </div>

      <!-- Load earlier messages button -->
      <div v-if="hasMore" class="load-earlier">
        <button class="load-earlier-btn" @click="loadMore">
          {{ t('chat.loadEarlier') }}
        </button>
        <span class="load-earlier-hint">{{ t('chat.messagesHidden', { count: hiddenCount }) }}</span>
      </div>

      <TransitionGroup name="group-msg">
        <div
          v-for="(msg, index) in visibleMessages"
          :key="msg.timestamp + String(index)"
          class="group-message"
          :class="[msg.role]"
        >
          <!-- Character message header -->
          <div v-if="msg.role === 'character'" class="group-message-header">
            <div
              class="group-avatar"
              :class="`group-avatar--${getColorIndex(msg.characterId)}`"
            >
              {{ getAvatarInitial(msg.characterName) }}
            </div>
            <span
              class="group-speaker-name"
              :class="`group-speaker-name--${getColorIndex(msg.characterId)}`"
            >
              {{ msg.characterName }}
            </span>
          </div>

          <div class="group-bubble">
            <MarkdownMessage v-if="msg.role === 'character'" :content="msg.content" />
            <template v-else>
              {{ msg.content }}
            </template>
          </div>
          <div class="group-time">
            {{ formatChatTime(msg.timestamp) }}
            <button
              v-if="msg.role === 'character' && aiSettingsStore.config.ttsProvider !== 'none'"
              class="tts-btn"
              :class="{
                'tts-btn--playing': ttsPlayingIndex === index,
                'tts-btn--generating': ttsGeneratingIndex === index,
              }"
              :aria-label="ttsPlayingIndex === index ? t('world.ttsStop') : t('world.ttsPlay')"
              :disabled="ttsGeneratingIndex === index"
              @click="handleGroupTtsPlay(msg, index)"
            >
              <IonIcon :icon="ttsPlayingIndex === index ? volumeMuteOutline : volumeHighOutline" />
            </button>
          </div>
          <MessageActions
            :message="{ role: msg.role === 'character' ? 'assistant' : 'user', content: msg.content, timestamp: msg.timestamp } as ChatMessage"
            :is-last="msg.role === 'character' && index === visibleMessages.length - 1"
            :is-loading="groupChatStore.isLoading"
            :show-edit="false"
            @copy="copyGroupMessage(msg.content)"
            @delete="deleteGroupMessage(msg.timestamp)"
            @regenerate="handleRegenerateGroupMessage(msg.timestamp)"
          />
        </div>
      </TransitionGroup>

      <!-- Thinking indicator -->
      <Transition name="group-msg">
        <div v-if="groupChatStore.isLoading" class="group-thinking">
          <template v-if="groupChatStore.selectingSpeaker">
            {{ t('world.selectingSpeaker') }}
          </template>
          <template v-else-if="groupChatStore.currentSpeakerName">
            {{ t('world.speakerThinking', { name: groupChatStore.currentSpeakerName }) }}
          </template>
          <div class="group-thinking-dot">
            <span />
            <span />
            <span />
          </div>
        </div>
      </Transition>
    </div>

    <template #footer>
      <IonToolbar>
        <div class="chat-input-bar">
          <!-- Continue button -->
          <button
            class="group-continue-btn"
            :disabled="groupChatStore.isLoading || participants.length === 0"
            @click="continueTurn"
          >
            {{ t('world.continueChat') }}
          </button>

          <IonInput
            v-model="inputText"
            :placeholder="t('world.groupChatPlaceholder')"
            :disabled="!room"
            :clear-input="true"
            class="chat-input"
            @keydown="handleKeydown"
          />
          <IonButton
            v-if="groupChatStore.isLoading"
            shape="round"
            fill="solid"
            color="danger"
            class="chat-send-btn"
            :aria-label="t('world.stopGeneration')"
            @click="groupChatStore.stopGeneration()"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="stopOutline" />
          </IonButton>
          <IonButton
            v-else
            shape="round"
            fill="solid"
            class="chat-send-btn"
            :disabled="!inputText.trim() || !room"
            :aria-label="t('world.send')"
            @click="send"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="sendOutline" />
          </IonButton>
        </div>
      </IonToolbar>
    </template>
  </LayoutPage>
</template>

<style scoped>
/* Reuse ChatPage footer styles */
ion-footer ion-toolbar {
  --background: var(--adv-surface-card);
  --border-width: 0;
  box-shadow:
    0 -1px 6px rgba(0, 0, 0, 0.06),
    0 -1px 2px rgba(0, 0, 0, 0.04);
}

/* Show msg-actions on group-message hover */
:deep(.group-message:hover .msg-actions),
:deep(.group-message .msg-actions:focus-within) {
  opacity: 1;
  pointer-events: auto;
}

/* Participant status bar */
.gc-participants {
  display: flex;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-sm, 8px) var(--adv-space-md, 16px);
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
  background: var(--adv-surface-card, #fff);
}

.gc-participants::-webkit-scrollbar {
  display: none;
}

:root.dark .gc-participants {
  background: var(--adv-surface-card, #1e1e2e);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.gc-participant-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: var(--adv-space-xs, 4px) var(--adv-space-sm, 8px);
  background: var(--adv-surface-elevated, #f8fafc);
  border: none;
  border-radius: var(--adv-radius-md, 8px);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.2s;
  min-width: 52px;
}

.gc-participant-chip:hover {
  background: var(--adv-surface-hover, #e2e8f0);
}

:root.dark .gc-participant-chip {
  background: var(--adv-surface-elevated, #252536);
}

:root.dark .gc-participant-chip:hover {
  background: rgba(255, 255, 255, 0.1);
}

.gc-chip-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.gc-chip-initials {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.gc-chip-name {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-secondary);
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gc-chip-mood {
  font-size: 12px;
  line-height: 1;
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
</style>
