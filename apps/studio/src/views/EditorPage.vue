<script setup lang="ts">
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useCloudSync } from '../composables/useCloudSync'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { downloadFromCloud, uploadToCloud } from '../utils/cloudSync'
import { readFileFromDir, writeFileToDir } from '../utils/fileAccess'

const { t } = useI18n()
const route = useRoute()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const content = ref('')
const isSaving = ref(false)
const initialContent = ref('')

const {
  isDirty: cloudDirty,
  isSaving: cloudSaving,
  lastSaved: cloudLastSaved,
  autoSave: cloudAutoSave,
  saveNow: cloudSaveNow,
  isCosConfigured,
} = useCloudSync()

const filePath = computed(() => {
  return (route.query.file as string) || ''
})

const fileName = computed(() => {
  return filePath.value.split('/').pop() || 'Untitled'
})

/**
 * Whether auto-save should be active for current context.
 */
const isAutoSaveActive = computed(() => {
  const project = studioStore.currentProject
  if (!project)
    return false
  // Auto-save works for COS projects, or local projects when COS is configured
  return (project.source === 'cos' || isCosConfigured()) && settingsStore.cos.autoSave
})

/**
 * Save status indicator text.
 */
const saveStatusText = computed(() => {
  if (cloudSaving.value)
    return t('editor.saving')
  if (cloudLastSaved.value && !cloudDirty.value)
    return t('editor.autoSaved')
  if (cloudDirty.value)
    return t('editor.unsaved')
  return ''
})

/**
 * Save status color class.
 */
const saveStatusClass = computed(() => {
  if (cloudSaving.value)
    return 'save-status--saving'
  if (cloudLastSaved.value && !cloudDirty.value)
    return 'save-status--saved'
  if (cloudDirty.value)
    return 'save-status--unsaved'
  return ''
})

onMounted(async () => {
  if (!filePath.value)
    return

  const project = studioStore.currentProject
  if (!project)
    return

  try {
    if (project.source === 'cos') {
      content.value = await downloadFromCloud(settingsStore.cos, filePath.value)
    }
    else if (project.dirHandle) {
      content.value = await readFileFromDir(project.dirHandle, filePath.value)
    }
    initialContent.value = content.value
  }
  catch {
    content.value = ''
    const toast = await toastController.create({
      message: t('editor.readFailed', { file: filePath.value }),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
})

// Watch content changes for auto-save
watch(content, (newVal) => {
  if (!isAutoSaveActive.value)
    return
  if (newVal === initialContent.value)
    return

  const project = studioStore.currentProject
  if (!project)
    return

  // For COS projects, auto-save directly to the file key
  if (project.source === 'cos' && filePath.value) {
    cloudAutoSave(filePath.value, newVal)
  }
  // For local projects with COS configured, auto-save to COS with project prefix
  else if (project.source === 'local' && isCosConfigured() && filePath.value) {
    const prefix = project.cosPrefix || `${project.name}/`
    cloudAutoSave(prefix + filePath.value, newVal)
  }
})

onUnmounted(() => {
  // Clean up is handled by the composable's watchers
})

async function save() {
  isSaving.value = true

  try {
    const project = studioStore.currentProject

    if (project?.source === 'cos' && filePath.value) {
      // Save to COS (immediate, bypasses debounce)
      await cloudSaveNow(filePath.value, content.value)
      await uploadToCloud(settingsStore.cos, filePath.value, content.value)
      initialContent.value = content.value
      const toast = await toastController.create({
        message: t('editor.saved'),
        duration: 1000,
        position: 'top',
        color: 'success',
      })
      await toast.present()
    }
    else if (project?.dirHandle && filePath.value) {
      // Write back to file system
      await writeFileToDir(project.dirHandle, filePath.value, content.value)
      initialContent.value = content.value

      // Also upload to COS if configured and autoSave is on
      if (isCosConfigured() && settingsStore.cos.autoSave) {
        const prefix = project.cosPrefix || `${project.name}/`
        await cloudSaveNow(prefix + filePath.value, content.value)
      }

      const toast = await toastController.create({
        message: t('editor.saved'),
        duration: 1000,
        position: 'top',
        color: 'success',
      })
      await toast.present()
    }
    else {
      // Fallback: download as file
      const blob = new Blob([content.value], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName.value
      a.click()
      URL.revokeObjectURL(url)

      const toast = await toastController.create({
        message: t('editor.downloaded'),
        duration: 1500,
        position: 'top',
      })
      await toast.present()
    }
  }
  catch {
    const toast = await toastController.create({
      message: t('editor.saveFailed'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
  finally {
    isSaving.value = false
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/play" />
        </IonButtons>
        <IonTitle>{{ fileName }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="end">
          <IonNote v-if="saveStatusText" class="save-status" :class="saveStatusClass">
            {{ saveStatusText }}
          </IonNote>
          <IonButton :disabled="isSaving" @click="save">
            {{ isSaving ? t('editor.saving') : t('editor.save') }}
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent :fullscreen="true">
      <textarea
        v-model="content"
        class="editor-textarea"
        :placeholder="t('editor.editPlaceholder', { file: fileName })"
        spellcheck="false"
      />
    </IonContent>
  </IonPage>
</template>

<style scoped>
.editor-textarea {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: var(--adv-space-md);
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: var(--ion-background-color, #fff);
  color: var(--ion-text-color, #000);
  box-sizing: border-box;
  transition: background-color var(--adv-duration-slow) var(--adv-ease-default);
}

.save-status {
  font-size: var(--adv-font-caption);
  padding-right: var(--adv-space-xs);
  display: flex;
  align-items: center;
  gap: 4px;
}

.save-status::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.save-status--saving::before {
  background: var(--ion-color-warning);
}

.save-status--saved::before {
  background: var(--ion-color-success);
}

.save-status--unsaved::before {
  background: var(--ion-color-danger);
}
</style>
