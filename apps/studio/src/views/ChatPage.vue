<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonChip,
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
import { addOutline, clipboardOutline, codeOutline, folderOpenOutline, gameControllerOutline, sendOutline, settingsOutline, sparklesOutline, stopOutline, trashOutline } from 'ionicons/icons'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import MarkdownMessage from '../components/MarkdownMessage.vue'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { useChatStore } from '../stores/useChatStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { uploadToCloud } from '../utils/cloudSync'
import { writeFileToDir } from '../utils/fileAccess'
import '../styles/chat.css'

const { t } = useI18n()
const chatStore = useChatStore()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const aiSettings = useAiSettingsStore()
const router = useRouter()
const inputText = ref('')
const contentRef = ref<InstanceType<typeof IonContent> | null>(null)

const hasProject = computed(() => !!studioStore.currentProject)
const isAiConfigured = computed(() => aiSettings.isConfigured)

function goToProjects() {
  router.push('/tabs/workspace')
}

function goToAiSettings() {
  router.push('/tabs/me/settings/ai')
}

// Load project context when current project changes (local or COS)
watch(() => studioStore.currentProject, async (project) => {
  if (!project)
    return
  if (project.dirHandle) {
    await chatStore.loadProjectContext(project.dirHandle)
  }
  else if (project.source === 'cos' && project.cosPrefix) {
    await chatStore.loadProjectContextFromCos(settingsStore.cos, project.cosPrefix)
  }
}, { immediate: true })

// Auto-scroll to bottom when messages change
watch(() => chatStore.messages.length, async () => {
  await nextTick()
  contentRef.value?.$el?.scrollToBottom?.(300)
})

async function send() {
  const text = inputText.value.trim()
  if (!text)
    return

  inputText.value = ''
  chatStore.sendMessage(text)
}

function quickSend(text: string) {
  inputText.value = ''
  chatStore.sendMessage(text)
}

async function copyContext() {
  if (!chatStore.projectContext) {
    const toast = await toastController.create({
      message: t('chat.noContext'),
      duration: 2000,
      position: 'top',
    })
    await toast.present()
    return
  }

  try {
    await navigator.clipboard.writeText(chatStore.projectContext)
    const toast = await toastController.create({
      message: t('chat.copied'),
      duration: 1500,
      position: 'top',
    })
    await toast.present()
  }
  catch {
    const toast = await toastController.create({
      message: t('chat.copyFailed'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
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

/** Save AI-generated content to the project (local FS or COS) */
async function handleSaveContent(payload: { type: string, content: string, filename: string }) {
  const project = studioStore.currentProject
  if (!project)
    return

  try {
    if (project.dirHandle) {
      await writeFileToDir(project.dirHandle, payload.filename, payload.content)
    }
    else if (project.source === 'cos' && project.cosPrefix) {
      const key = `${project.cosPrefix}${payload.filename}`
      await uploadToCloud(settingsStore.cos, key, payload.content)
    }
    else {
      // Fallback: download as file
      const blob = new Blob([payload.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = payload.filename.split('/').pop() || 'file.md'
      a.click()
      URL.revokeObjectURL(url)

      const toast = await toastController.create({
        message: t('chat.savedAsDownload'),
        duration: 2000,
        position: 'top',
      })
      await toast.present()
      return
    }

    const toast = await toastController.create({
      message: t('chat.savedToProject', { file: payload.filename }),
      duration: 2000,
      position: 'top',
      color: 'success',
    })
    await toast.present()

    // Reload project context so the new content is available for future AI conversations
    if (project.dirHandle) {
      await chatStore.loadProjectContext(project.dirHandle)
    }
    else if (project.source === 'cos' && project.cosPrefix) {
      await chatStore.loadProjectContextFromCos(settingsStore.cos, project.cosPrefix)
    }
  }
  catch {
    const toast = await toastController.create({
      message: t('chat.saveFailed'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('chat.title') }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="end">
          <IonButton
            :aria-label="t('chat.toggleWrap')"
            :color="settingsStore.chatWordWrap ? 'primary' : undefined"
            @click="settingsStore.chatWordWrap = !settingsStore.chatWordWrap"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="codeOutline" />
          </IonButton>
          <IonButton aria-label="Copy context" @click="copyContext">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="clipboardOutline" />
          </IonButton>
          <IonButton
            color="danger"
            aria-label="Clear messages"
            @click="chatStore.clearMessages()"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="trashOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent ref="contentRef" :fullscreen="true">
      <div class="messages-container">
        <!-- No project state -->
        <div v-if="!hasProject" class="chat-no-project">
          <div class="chat-no-project__icon">
            <IonIcon :icon="folderOpenOutline" />
          </div>
          <h3 class="chat-no-project__title">
            {{ t('chat.noProjectTitle') }}
          </h3>
          <p class="chat-no-project__desc">
            {{ t('chat.noProjectDesc') }}
          </p>
          <div class="chat-no-project__actions">
            <button class="chat-no-project__btn chat-no-project__btn--primary" @click="goToProjects">
              <IonIcon :icon="addOutline" />
              {{ t('projects.createProject') }}
            </button>
            <button class="chat-no-project__btn" @click="goToProjects">
              <IonIcon :icon="folderOpenOutline" />
              {{ t('projects.openProject') }}
            </button>
          </div>
        </div>

        <!-- AI not configured banner -->
        <div v-if="hasProject && !isAiConfigured" class="ai-banner">
          <div class="ai-banner__icon">
            <IonIcon :icon="sparklesOutline" />
          </div>
          <div class="ai-banner__text">
            <span class="ai-banner__title">{{ t('chat.aiNotConfigured') }}</span>
            <span class="ai-banner__desc">{{ t('chat.aiNotConfiguredDesc') }}</span>
          </div>
          <button class="ai-banner__btn" @click="goToAiSettings">
            <IonIcon :icon="settingsOutline" />
            {{ t('chat.configureAi') }}
          </button>
        </div>

        <!-- Welcome state -->
        <div v-else-if="hasProject && chatStore.messages.length === 0" class="chat-welcome">
          <div class="chat-welcome__icon">
            <IonIcon :icon="gameControllerOutline" />
          </div>
          <h3 class="chat-welcome__title">
            {{ t('chat.welcomeMessage') }}
          </h3>
          <p class="chat-welcome__hint">
            {{ t('chat.welcomeHint') }}
          </p>
          <div class="chat-welcome__suggestions">
            <IonChip color="primary" @click="quickSend(t('chat.suggestion1'))">
              {{ t('chat.suggestion1') }}
            </IonChip>
            <IonChip color="primary" @click="quickSend(t('chat.suggestion2'))">
              {{ t('chat.suggestion2') }}
            </IonChip>
            <IonChip color="primary" @click="quickSend(t('chat.suggestion3'))">
              {{ t('chat.suggestion3') }}
            </IonChip>
          </div>
        </div>

        <TransitionGroup name="msg">
          <div
            v-for="(msg, index) in chatStore.messages"
            :key="msg.timestamp + index"
            class="message"
            :class="[msg.role]"
          >
            <div class="bubble">
              <MarkdownMessage v-if="msg.role === 'assistant'" :content="msg.content" :word-wrap="settingsStore.chatWordWrap" @save="handleSaveContent" />
              <template v-else>
                {{ msg.content }}
              </template>
            </div>
            <div class="time">
              {{ formatTime(msg.timestamp) }}
            </div>
          </div>
        </TransitionGroup>

        <!-- Typing indicator (only when loading and no streaming content yet) -->
        <Transition name="msg">
          <div v-if="chatStore.isLoading && !chatStore.streamingContent" class="message assistant">
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
            :placeholder="hasProject ? t('chat.placeholder') : t('chat.noProjectPlaceholder')"
            :disabled="!hasProject"
            :clear-input="true"
            class="chat-input"
            @keydown="handleKeydown"
          />
          <IonButton
            v-if="chatStore.isLoading"
            shape="round"
            fill="solid"
            color="danger"
            class="chat-send-btn"
            aria-label="Stop generation"
            @click="chatStore.stopGeneration()"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="stopOutline" />
          </IonButton>
          <IonButton
            v-else
            shape="round"
            fill="solid"
            class="chat-send-btn"
            :disabled="!inputText.trim() || !hasProject"
            aria-label="Send message"
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
/* No project state */
.chat-no-project {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--adv-space-2xl) var(--adv-space-lg);
  text-align: center;
}

.chat-no-project__icon {
  width: 80px;
  height: 80px;
  border-radius: var(--adv-radius-xl);
  background: var(--adv-gradient-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--adv-space-lg);
}

.chat-no-project__icon ion-icon {
  font-size: 36px;
  color: var(--adv-text-tertiary);
}

.chat-no-project__title {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  color: var(--adv-text-primary);
  margin: 0 0 var(--adv-space-sm);
}

.chat-no-project__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0 0 var(--adv-space-xl);
  max-width: 280px;
  line-height: 1.5;
}

.chat-no-project__actions {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  width: 100%;
  max-width: 260px;
}

.chat-no-project__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--adv-space-sm);
  height: 44px;
  border-radius: var(--adv-radius-md);
  border: 1.5px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body);
  font-weight: 500;
  cursor: pointer;
  transition:
    transform var(--adv-duration-fast) var(--adv-ease-default),
    box-shadow var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.chat-no-project__btn:active {
  transform: scale(0.98);
}

.chat-no-project__btn--primary {
  background: var(--adv-gradient-primary);
  border-color: transparent;
  color: #fff;
  font-weight: 600;
  box-shadow: var(--adv-shadow-glow);
}

/* Welcome state */
.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--adv-space-2xl) var(--adv-space-lg);
  text-align: center;
}

.chat-welcome__icon {
  width: 80px;
  height: 80px;
  border-radius: var(--adv-radius-xl);
  background: var(--adv-gradient-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--adv-space-lg);
  animation: float 3s ease-in-out infinite;
}

.chat-welcome__icon ion-icon {
  font-size: 36px;
  color: var(--ion-color-primary);
}

.chat-welcome__title {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  color: var(--adv-text-primary);
  margin: 0 0 var(--adv-space-sm);
}

.chat-welcome__hint {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0 0 var(--adv-space-lg);
  max-width: 280px;
  line-height: 1.5;
}

.chat-welcome__suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--adv-space-sm);
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

/* Footer toolbar — elevated above content */
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

/* Input bar */
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

/* ── AI Not Configured Banner ── */
.ai-banner {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  margin: var(--adv-space-sm) var(--adv-space-md);
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  background: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.15);
}

.ai-banner__icon {
  font-size: 20px;
  color: #8b5cf6;
  flex-shrink: 0;
}

.ai-banner__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.ai-banner__title {
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.ai-banner__desc {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

.ai-banner__btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--adv-radius-sm);
  border: 1.5px solid rgba(139, 92, 246, 0.3);
  background: rgba(139, 92, 246, 0.08);
  color: #8b5cf6;
  font-size: var(--adv-font-caption);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background var(--adv-duration-fast) var(--adv-ease-default),
    transform var(--adv-duration-fast) var(--adv-ease-default);
  -webkit-tap-highlight-color: transparent;
}

.ai-banner__btn:hover {
  background: rgba(139, 92, 246, 0.15);
}

.ai-banner__btn:active {
  transform: scale(0.97);
}
</style>
