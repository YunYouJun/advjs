<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { closeOutline, cloudDoneOutline, cloudOfflineOutline, peopleOutline, saveOutline, settingsOutline } from 'ionicons/icons'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useCollabRoom } from '../composables/useCollabRoom'
import { useAuthStore } from '../stores/useAuthStore'
import FilePreview from './FilePreview.vue'

const props = defineProps<{
  isOpen: boolean
  title: string
  mode: 'create' | 'edit'
  isSaving?: boolean
  aiEnabled?: boolean
  markdown: string
  markdownError?: string
  monacoFilename?: string
}>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'update:markdown': [value: string]
  'save': []
  'cancel': []
  'syncFromMarkdown': [md: string]
  'syncToMarkdown': []
}>()

const { t } = useI18n()
const CreativeTeamModal = defineAsyncComponent(() => import('./creative-team/CreativeTeamModal.vue'))
const router = useRouter()
const authStore = useAuthStore()
const collab = useCollabRoom()
const activeTab = defineModel<'form' | 'markdown' | 'ai'>('activeTab', { default: 'form' })
const markdownOpened = ref(false)
const localMarkdown = ref('')
const isCollabToggling = ref(false)
const showCreativeTeam = ref(false)
const creativeTeamOpened = ref(false)

function openCreativeTeam() {
  creativeTeamOpened.value = true
  showCreativeTeam.value = true
}

const collabFilename = computed(() => props.monacoFilename || 'content.md')
const collabText = computed(() => {
  if (activeTab.value !== 'markdown' || !collab.isSynced.value)
    return null
  return collab.getSharedText(collabFilename.value)
})
const onlineCount = computed(() => collab.onlineUsers.value.filter(user => user.online).length)
const collabStatusLabel = computed(() => {
  if (!collab.isAvailable.value)
    return authStore.isLoggedIn ? t('contentEditor.collabUnavailable') : t('contentEditor.collabLoginRequired')
  if (collab.connectionState.value === 'connecting' || isCollabToggling.value)
    return t('contentEditor.collabConnecting')
  if (collab.isSynced.value)
    return t('contentEditor.collabConnected')
  if (collab.connectionState.value === 'error')
    return t('contentEditor.collabFailed')
  return t('contentEditor.collabIdle')
})
const collabStatusIcon = computed(() => collab.isSynced.value ? cloudDoneOutline : cloudOfflineOutline)

watch(() => props.markdown, v => localMarkdown.value = v)

watch(() => props.isOpen, (open) => {
  if (open) {
    markdownOpened.value = activeTab.value === 'markdown'
    localMarkdown.value = props.markdown
  }
  else {
    markdownOpened.value = false
    if (collab.isInRoom.value)
      collab.leaveRoom()
  }
})

function handleTabChange(newTab: 'form' | 'markdown' | 'ai') {
  const oldTab = activeTab.value
  if (oldTab === 'markdown' && newTab !== 'markdown')
    emit('syncFromMarkdown', localMarkdown.value)
  if (newTab === 'markdown' && oldTab !== 'markdown') {
    markdownOpened.value = true
    emit('syncToMarkdown')
  }
  activeTab.value = newTab
}

function handleMarkdownUpdate(value: string) {
  localMarkdown.value = value
  emit('update:markdown', value)
}

async function handleCollabToggle() {
  if (!collab.isAvailable.value || isCollabToggling.value)
    return

  isCollabToggling.value = true
  try {
    if (collab.isInRoom.value) {
      collab.leaveRoom()
      return
    }

    const joined = await collab.joinRoom()
    if (!joined)
      await collab.createAndJoinRoom()
  }
  finally {
    isCollabToggling.value = false
  }
}

function handleCancel() {
  emit('cancel')
  emit('update:isOpen', false)
}

function handleSave() {
  if (props.isSaving || props.markdownError)
    return
  if (activeTab.value === 'markdown')
    emit('syncFromMarkdown', localMarkdown.value)
  emit('save')
}

function handleCreativeNavigate() {
  showCreativeTeam.value = false
  // The existing content editor keeps its local draft when closed.
  handleCancel()
}
</script>

<template>
  <IonModal
    :is-open="isOpen"
    @did-dismiss="handleCancel"
  >
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonButton fill="clear" :aria-label="t('common.cancel')" @click="handleCancel">
            <IonIcon :icon="closeOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle>{{ title }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="end">
          <IonButton fill="clear" @click="openCreativeTeam">
            {{ t('creativeTeam.title') }}
          </IonButton>
          <IonButton
            :disabled="isSaving || Boolean(markdownError)"
            color="primary"
            fill="solid"
            size="small"
            class="cem-save-btn"
            @click="handleSave"
          >
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="start" :icon="saveOutline" />
            {{ isSaving ? t('editor.saving') : t('workspace.save') }}
          </IonButton>
        </IonButtons>
      </IonToolbar>

      <!-- Tab Segment (uses Ionic native iOS style) -->
      <IonToolbar>
        <IonSegment :value="activeTab" @ion-change="handleTabChange(($event.detail.value as 'form' | 'markdown' | 'ai') ?? 'form')">
          <IonSegmentButton value="form">
            <IonLabel>{{ t('contentEditor.formTab') }}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="markdown">
            <IonLabel>Markdown</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton v-if="aiEnabled" value="ai">
            <IonLabel>{{ t('contentEditor.aiTab') }}</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="markdownError" role="alert" class="cem-markdown-error">
        <p>{{ t('contentEditor.markdownInvalid') }}</p>
        <pre>{{ markdownError }}</pre>
      </div>
      <!-- Form -->
      <div v-show="activeTab === 'form'" :inert="Boolean(markdownError)" class="cem-panel cem-panel--form ion-padding">
        <slot name="form" />
      </div>

      <!-- Markdown -->
      <div v-show="activeTab === 'markdown'" class="cem-panel cem-panel--monaco">
        <div class="cem-collab-bar">
          <div class="cem-collab-bar__status">
            <IonIcon :icon="collabStatusIcon" />
            <span>{{ collabStatusLabel }}</span>
            <span v-if="collab.isSynced.value" class="cem-collab-bar__online">
              <IonIcon :icon="peopleOutline" />
              {{ t('contentEditor.collabOnline', { count: onlineCount }) }}
            </span>
          </div>
          <IonButton
            fill="outline"
            size="small"
            :disabled="!collab.isAvailable.value || isCollabToggling"
            @click="handleCollabToggle"
          >
            {{ collab.isInRoom.value ? t('contentEditor.collabStop') : t('contentEditor.collabStart') }}
          </IonButton>
          <IonButton
            v-if="collab.isInRoom.value"
            fill="clear"
            size="small"
            :aria-label="t('contentEditor.collabSettings')"
            @click="router.push('/tabs/workspace/collab')"
          >
            <IonIcon :icon="settingsOutline" />
          </IonButton>
        </div>
        <FilePreview
          v-if="markdownOpened"
          :content="localMarkdown"
          :readonly="collab.myRole.value === 'viewer'"
          :filename="collabFilename"
          preserve-session-on-rename
          :collab-text="collabText"
          @update:content="handleMarkdownUpdate"
          @save="handleSave"
        />
      </div>

      <!-- AI -->
      <div v-show="activeTab === 'ai'" class="cem-panel cem-panel--ai ion-padding">
        <slot name="ai" />
      </div>
    </IonContent>
  </IonModal>
  <!-- Keep the wrapper mounted through Ionic dismissal; modal content remains lazy. -->
  <CreativeTeamModal v-if="creativeTeamOpened" :is-open="showCreativeTeam" :initial-partner="monacoFilename?.includes('character') ? 'character-designer' : 'writer'" @close="showCreativeTeam = false" @navigate="handleCreativeNavigate" />
</template>

<style scoped>
.cem-markdown-error {
  padding: var(--adv-space-sm) var(--adv-space-md);
  color: var(--ion-color-danger);
  background: var(--adv-surface-card);
}

.cem-markdown-error p {
  margin: 0;
}

.cem-markdown-error pre {
  margin-bottom: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--adv-font-body-sm);
}

.cem-save-btn {
  --border-radius: var(--adv-radius-md, 8px);
  text-transform: none;
  font-weight: 600;
  min-height: 36px;
}

.cem-panel--monaco {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.cem-collab-bar {
  min-height: 44px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--adv-border-subtle, rgba(127, 127, 127, 0.18));
  background: var(--adv-surface-card, var(--ion-background-color));
}

.cem-collab-bar__status,
.cem-collab-bar__online {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cem-collab-bar__status {
  min-width: 0;
  color: var(--adv-text-secondary, var(--ion-color-medium));
  font-size: var(--adv-font-body-sm);
}

.cem-collab-bar__online {
  color: var(--ion-color-success);
  white-space: nowrap;
}

.cem-panel--form {
  min-height: 100%;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
}

.cem-panel--ai {
  min-height: 100%;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
}
</style>
