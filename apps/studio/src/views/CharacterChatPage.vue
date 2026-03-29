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
  downloadOutline,
  informationCircleOutline,
  searchOutline,
  sendOutline,
  stopOutline,
  trashOutline,
} from 'ionicons/icons'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import CharacterChatWelcome from '../components/CharacterChatWelcome.vue'
import CharacterInfoModal from '../components/CharacterInfoModal.vue'
import ChatHistorySearch from '../components/ChatHistorySearch.vue'
import MarkdownMessage from '../components/MarkdownMessage.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useWorldContext } from '../composables/useWorldContext'
import { useCharacterChatStore } from '../stores/useCharacterChatStore'
import { useCharacterMemoryStore } from '../stores/useCharacterMemoryStore'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { useViewModeStore } from '../stores/useViewModeStore'
import { getMoodEmoji } from '../utils/chatUtils'
import { uploadToCloud } from '../utils/cloudSync'
import { writeFileToDir } from '../utils/fileAccess'
import '../styles/chat.css'

const SAFE_FILENAME_RE = /[^a-z0-9\u4E00-\u9FFF]+/g
const TRIM_UNDERSCORE_RE = /^_|_$/g

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const characterChatStore = useCharacterChatStore()
const memoryStore = useCharacterMemoryStore()
const stateStore = useCharacterStateStore()
const { characters, loadFromDir, loadFromCos, knowledgeBase } = useProjectContent()
const { worldContext, loadFromDir: loadWorldFromDir, loadFromCos: loadWorldFromCos } = useWorldContext()
const viewModeStore = useViewModeStore()

function getEffectiveWorldContext(): string {
  return viewModeStore.getEffectiveWorldContext(worldContext.value)
}

const inputText = ref('')
const contentRef = ref<InstanceType<typeof IonContent> | null>(null)
const showInfoModal = ref(false)
const showSearch = ref(false)

const characterId = computed(() => route.params.characterId as string)

const character = computed<AdvCharacter | undefined>(() => {
  return characters.value.find(c => c.id === characterId.value)
})

const messages = computed(() => {
  return characterChatStore.getMessages(characterId.value)
})

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

// Load project content if needed
onMounted(async () => {
  const project = studioStore.currentProject
  if (!project)
    return
  if (characters.value.length === 0) {
    if (project.dirHandle) {
      await Promise.all([
        loadFromDir(project.dirHandle),
        loadWorldFromDir(project.dirHandle),
      ])
    }
    else if (project.source === 'cos' && project.cosPrefix) {
      await Promise.all([
        loadFromCos(settingsStore.cos, project.cosPrefix),
        loadWorldFromCos(settingsStore.cos, project.cosPrefix),
      ])
    }
  }
})

// Auto-scroll to bottom when messages change
watch(() => messages.value.length, async () => {
  await nextTick()
  contentRef.value?.$el?.scrollToBottom?.(300)
})

// Also scroll when streaming content updates
watch(() => characterChatStore.streamingContent, async () => {
  await nextTick()
  contentRef.value?.$el?.scrollToBottom?.(100)
})

function goBack() {
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
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)

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
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename.split('/').pop() || 'export.md'
      a.click()
      URL.revokeObjectURL(url)
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
  // Scroll to the message at the given index
  const el = contentRef.value?.$el
  if (!el)
    return
  const msgElements = el.querySelectorAll('.message')
  if (msgElements[index]) {
    msgElements[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Brief highlight
    msgElements[index].classList.add('message--highlight')
    setTimeout(() => {
      msgElements[index].classList.remove('message--highlight')
    }, 1500)
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    send()
  }
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
          <IonButton :disabled="messages.length === 0" @click="handleExport">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="downloadOutline" />
          </IonButton>
          <IonButton @click="showInfoModal = true">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="informationCircleOutline" />
          </IonButton>
          <IonButton color="danger" @click="confirmClear">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="trashOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>

      <!-- Search bar (collapsible) -->
      <ChatHistorySearch
        v-if="showSearch"
        :messages="messages"
        @jump-to="handleSearchJump"
        @close="showSearch = false"
      />
    </IonHeader>

    <IonContent ref="contentRef" :fullscreen="true">
      <div class="messages-container">
        <!-- Welcome state -->
        <CharacterChatWelcome
          v-if="character && messages.length === 0"
          :character="character"
          @send="quickSend"
        />

        <TransitionGroup name="msg">
          <div
            v-for="(msg, index) in messages"
            :key="msg.timestamp + index"
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
              {{ formatTime(msg.timestamp) }}
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
      @close="showInfoModal = false"
      @refresh-knowledge="reloadKnowledge"
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
</style>
