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
import { closeOutline, saveOutline } from 'ionicons/icons'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FilePreview from './FilePreview.vue'

const props = defineProps<{
  isOpen: boolean
  title: string
  mode: 'create' | 'edit'
  isSaving?: boolean
  aiEnabled?: boolean
  markdown: string
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
const activeTab = ref<'form' | 'markdown' | 'ai'>('form')
const localMarkdown = ref('')

watch(() => props.markdown, v => localMarkdown.value = v)

watch(() => props.isOpen, (open) => {
  if (open) {
    activeTab.value = 'form'
    localMarkdown.value = props.markdown
  }
})

function handleTabChange(newTab: 'form' | 'markdown' | 'ai') {
  const oldTab = activeTab.value
  if (oldTab === 'markdown' && newTab !== 'markdown')
    emit('syncFromMarkdown', localMarkdown.value)
  if (newTab === 'markdown' && oldTab !== 'markdown')
    emit('syncToMarkdown')
  activeTab.value = newTab
}

function handleMarkdownUpdate(value: string) {
  localMarkdown.value = value
  emit('update:markdown', value)
}

function handleCancel() {
  emit('cancel')
  emit('update:isOpen', false)
}

function handleSave() {
  if (activeTab.value === 'markdown')
    emit('syncFromMarkdown', localMarkdown.value)
  emit('save')
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
          <IonButton :aria-label="t('common.cancel')" @click="handleCancel">
            <IonIcon :icon="closeOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle>{{ title }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="end">
          <IonButton
            :disabled="isSaving"
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
      <!-- Form -->
      <div v-show="activeTab === 'form'" class="cem-panel cem-panel--form ion-padding">
        <slot name="form" />
      </div>

      <!-- Markdown -->
      <div v-show="activeTab === 'markdown'" class="cem-panel cem-panel--monaco">
        <FilePreview
          :content="localMarkdown"
          :readonly="false"
          :filename="monacoFilename || 'content.md'"
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
</template>

<style scoped>
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

.cem-panel--form {
  min-height: 100%;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
}

.cem-panel--ai {
  min-height: 100%;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
}
</style>
