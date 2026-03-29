<script setup lang="ts">
import {
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
} from '@ionic/vue'
import {
  arrowBackOutline,
  sendOutline,
  stopOutline,
  trashOutline,
} from 'ionicons/icons'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import MarkdownMessage from '../components/MarkdownMessage.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useWorldContext } from '../composables/useWorldContext'
import { useGroupChatStore } from '../stores/useGroupChatStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { useViewModeStore } from '../stores/useViewModeStore'
import '../styles/group-chat.css'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const groupChatStore = useGroupChatStore()
const { characters, loadFromDir, loadFromCos } = useProjectContent()
const { worldContext, loadFromDir: loadWorldFromDir, loadFromCos: loadWorldFromCos } = useWorldContext()
const viewModeStore = useViewModeStore()

function getEffectiveWorldContext(): string {
  return viewModeStore.getEffectiveWorldContext(worldContext.value)
}

const inputText = ref('')
const contentRef = ref<InstanceType<typeof IonContent> | null>(null)

const roomId = computed(() => route.params.roomId as string)

const room = computed(() => {
  return groupChatStore.getRoom(roomId.value)
})

const messages = computed(() => {
  return room.value?.messages || []
})

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
watch(() => groupChatStore.streamingContent, async () => {
  await nextTick()
  contentRef.value?.$el?.scrollToBottom?.(100)
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
        <IonTitle>{{ room?.name || roomId }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="end">
          <IonButton color="danger" @click="confirmDelete">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="trashOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent ref="contentRef" :fullscreen="true">
      <div class="group-messages-container">
        <!-- Empty state -->
        <div v-if="messages.length === 0 && !groupChatStore.isLoading" style="text-align: center; padding: 40px 20px; color: var(--adv-text-tertiary);">
          <p>{{ t('world.groupChatPlaceholder') }}</p>
        </div>

        <TransitionGroup name="group-msg">
          <div
            v-for="(msg, index) in messages"
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
              {{ formatTime(msg.timestamp) }}
            </div>
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
    </IonContent>

    <IonFooter>
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
    </IonFooter>
  </IonPage>
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
</style>
