<script setup lang="ts">
import {
  alertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import {
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useStudioStore } from '../stores/useStudioStore'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const router = useRouter()
const studioStore = useStudioStore()

const activeTab = ref('general')

const editName = ref('')
const editUrl = ref('')
const editCosPrefix = ref('')
const editDescription = ref('')
const coverFileInput = ref<HTMLInputElement | null>(null)

const project = computed(() => studioStore.currentProject)

const sourceLabel = computed(() => {
  const s = project.value?.source
  if (s === 'url')
    return t('projects.sourceUrl')
  if (s === 'cos')
    return t('projects.sourceCos')
  return t('projects.sourceLocal')
})

const showUrlField = computed(() =>
  project.value?.source === 'url' || !!project.value?.url,
)

const showCosField = computed(() =>
  project.value?.source === 'cos' || !!project.value?.cosPrefix,
)

watch(() => props.open, (isOpen) => {
  if (isOpen && project.value) {
    editName.value = project.value.name
    editUrl.value = project.value.url || ''
    editCosPrefix.value = project.value.cosPrefix || ''
    editDescription.value = project.value.description || ''
    activeTab.value = 'general'
  }
})

const hasChanges = computed(() => {
  if (!project.value)
    return false
  return (
    editName.value.trim() !== project.value.name
    || (editUrl.value.trim() || '') !== (project.value.url || '')
    || (editCosPrefix.value.trim() || '') !== (project.value.cosPrefix || '')
    || (editDescription.value.trim() || '') !== (project.value.description || '')
  )
})

const canSave = computed(() => !!editName.value.trim() && hasChanges.value)

async function copyProjectId() {
  if (!project.value?.projectId)
    return
  await navigator.clipboard.writeText(project.value.projectId)
  const toast = await toastController.create({
    message: t('projectSettings.projectIdCopied'),
    duration: 1200,
    position: 'top',
    color: 'medium',
  })
  await toast.present()
}

async function handleSave() {
  if (!project.value || !editName.value.trim())
    return

  studioStore.updateProject(project.value.projectId, {
    name: editName.value.trim(),
    url: editUrl.value.trim() || undefined,
    cosPrefix: editCosPrefix.value.trim() || undefined,
    description: editDescription.value.trim() || undefined,
  })

  const toast = await toastController.create({
    message: t('projectSettings.saved'),
    duration: 1500,
    position: 'top',
    color: 'success',
  })
  await toast.present()
  emit('close')
}

async function handleCoverUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // reset for re-selection
  if (!file || !project.value)
    return

  // Resize and convert to JPEG data URL
  const dataUrl = await resizeImage(file, 800, 0.8)
  studioStore.updateProject(project.value.projectId, { cover: dataUrl })
}

function handleCoverRemove() {
  if (!project.value)
    return
  studioStore.updateProject(project.value.projectId, { cover: undefined })
}

function resizeImage(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

async function handleDelete() {
  if (!project.value)
    return

  const projectToRemove = project.value
  const alert = await alertController.create({
    header: t('projectSettings.deleteTitle'),
    message: t('projectSettings.deleteMessage', { name: projectToRemove.name }),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.delete'),
        role: 'destructive',
        handler: async () => {
          const idx = studioStore.projects.findIndex(p => p.projectId === projectToRemove.projectId)
          if (idx !== -1)
            studioStore.removeProject(idx)
          await studioStore.switchProject(null)
          emit('close')
          router.push('/')
        },
      },
    ],
  })
  await alert.present()
}
</script>

<template>
  <IonModal
    :is-open="open"
    :initial-breakpoint="0.75"
    :breakpoints="[0, 0.75, 1]"
    @did-dismiss="emit('close')"
  >
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonButton fill="clear" @click="emit('close')">
            <div class="i-carbon-close" />
          </IonButton>
        </IonButtons>
        <IonTitle>{{ t('projectSettings.title') }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="end">
          <IonButton
            :strong="true"
            :disabled="!canSave"
            color="primary"
            @click="handleSave"
          >
            {{ t('projectSettings.save') }}
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent class="settings-content">
      <TabsRoot v-model="activeTab" class="tabs-root">
        <TabsList class="tabs-list">
          <TabsTrigger value="general" class="tabs-trigger">
            <div class="i-carbon-settings tabs-trigger-icon" />
            <span>{{ t('projectSettings.segGeneral') }}</span>
          </TabsTrigger>
          <TabsTrigger value="sync" class="tabs-trigger">
            <div class="i-carbon-cloud tabs-trigger-icon" />
            <span>{{ t('projectSettings.segSync') }}</span>
          </TabsTrigger>
          <TabsTrigger value="info" class="tabs-trigger">
            <div class="i-carbon-information tabs-trigger-icon" />
            <span>{{ t('projectSettings.segInfo') }}</span>
          </TabsTrigger>
        </TabsList>

        <!-- ── General ── -->
        <TabsContent value="general" class="tabs-panel">
          <section class="card">
            <h3 class="card-title">
              {{ t('projectSettings.general') }}
            </h3>

            <div class="field field--clickable" role="button" tabindex="0" @click="copyProjectId" @keydown.enter="copyProjectId">
              <label class="field-label">{{ t('projectSettings.projectId') }}</label>
              <div class="field-row">
                <span class="field-value field-value--mono field-value--muted">{{ project?.projectId }}</span>
                <div class="i-carbon-copy field-action-icon" />
              </div>
            </div>

            <div class="field">
              <label class="field-label" for="ps-name">{{ t('projectSettings.name') }}</label>
              <input
                id="ps-name"
                v-model="editName"
                class="field-input"
                type="text"
                :placeholder="t('projects.projectNamePlaceholder')"
              >
            </div>

            <div class="field field--last">
              <label class="field-label">{{ t('projectSettings.source') }}</label>
              <span class="field-value field-value--muted">{{ sourceLabel }}</span>
            </div>
          </section>

          <!-- Description -->
          <section class="card">
            <h3 class="card-title">
              {{ t('projectSettings.description') || 'Description' }}
            </h3>
            <div class="field field--last">
              <textarea
                v-model="editDescription"
                class="field-input field-textarea"
                rows="3"
                :placeholder="t('projectSettings.descriptionPlaceholder') || 'Short description for project cards...'"
              />
            </div>
          </section>

          <!-- Cover Image -->
          <section class="card">
            <h3 class="card-title">
              {{ t('projectSettings.cover') }}
            </h3>
            <div v-if="project?.cover" class="cover-preview">
              <img :src="project.cover" alt="Cover" class="cover-preview__img">
              <button class="cover-preview__remove" @click="handleCoverRemove">
                <div class="i-carbon-close" />
              </button>
            </div>
            <div class="field field--last">
              <button class="btn-upload" @click="coverFileInput?.click()">
                <div class="i-carbon-image" />
                {{ project?.cover ? t('projectSettings.coverUpload') : t('projectSettings.coverUpload') }}
              </button>
              <input
                ref="coverFileInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleCoverUpload"
              >
              <p class="hint hint--inline">
                {{ t('projectSettings.coverHint') }}
              </p>
            </div>
          </section>
        </TabsContent>

        <!-- ── Sync ── -->
        <TabsContent value="sync" class="tabs-panel">
          <section class="card">
            <h3 class="card-title">
              {{ t('projectSettings.connectionSettings') }}
            </h3>

            <div v-if="showUrlField" class="field">
              <label class="field-label" for="ps-url">{{ t('projectSettings.url') }}</label>
              <input
                id="ps-url"
                v-model="editUrl"
                class="field-input"
                type="url"
                placeholder="https://..."
              >
            </div>

            <div v-if="showCosField" class="field">
              <label class="field-label" for="ps-cos">{{ t('projectSettings.cosPrefix') }}</label>
              <input
                id="ps-cos"
                v-model="editCosPrefix"
                class="field-input"
                type="text"
                placeholder="my-project/"
              >
            </div>

            <p v-if="!showUrlField && !showCosField" class="empty-state">
              {{ t('projectSettings.noSyncConfig') }}
            </p>
          </section>

          <p class="hint">
            {{ t('projectSettings.syncHint') }}
          </p>
        </TabsContent>

        <!-- ── Info / Danger ── -->
        <TabsContent value="info" class="tabs-panel">
          <section class="card">
            <h3 class="card-title">
              {{ t('projectSettings.info') }}
            </h3>

            <div class="field">
              <label class="field-label">{{ t('projectSettings.source') }}</label>
              <span class="field-value field-value--muted">{{ sourceLabel }}</span>
            </div>

            <div class="field field--clickable field--last" role="button" tabindex="0" @click="copyProjectId" @keydown.enter="copyProjectId">
              <label class="field-label">{{ t('projectSettings.projectId') }}</label>
              <div class="field-row">
                <span class="field-value field-value--mono field-value--muted">{{ project?.projectId }}</span>
                <div class="i-carbon-copy field-action-icon" />
              </div>
            </div>
          </section>

          <section class="card card--danger">
            <h3 class="card-title card-title--danger">
              {{ t('projectSettings.dangerZone') }}
            </h3>

            <button class="btn-danger" @click="handleDelete">
              <div class="i-carbon-trash-can" />
              {{ t('projectSettings.removeProject') }}
            </button>

            <p class="hint hint--inline">
              {{ t('projectSettings.removeHint') }}
            </p>
          </section>
        </TabsContent>
      </TabsRoot>
    </IonContent>
  </IonModal>
</template>

<style scoped>
/* ── Content ── */
.settings-content {
  --background: var(--ion-color-light, #f4f5f8);
}

/* ── Tabs ── */
.tabs-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tabs-list {
  display: flex;
  gap: 2px;
  padding: 0 16px;
  background: var(--ion-background-color, #fff);
  border-bottom: 1px solid var(--ion-border-color, #e0e0e0);
}

.tabs-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--ion-color-medium, #92949c);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition:
    color 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}

.tabs-trigger:hover {
  color: var(--ion-text-color, #1a1a1a);
}

.tabs-trigger[data-state='active'] {
  color: var(--ion-color-primary, #3880ff);
  border-bottom-color: var(--ion-color-primary, #3880ff);
}

.tabs-trigger-icon {
  font-size: 15px;
}

/* ── Panel ── */
.tabs-panel {
  padding: 20px 16px 40px;
}

/* ── Card ── */
.card {
  background: var(--ion-item-background, #fff);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.card--danger {
  background: rgba(235, 68, 90, 0.03);
  border: 1px solid rgba(235, 68, 90, 0.15);
}

.card-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ion-color-medium, #92949c);
  margin: 0 0 16px;
}

.card-title--danger {
  color: var(--ion-color-danger, #eb445a);
}

/* ── Field ── */
.field {
  margin-bottom: 18px;
}

.field--last {
  margin-bottom: 0;
}

.field--clickable {
  cursor: pointer;
  border-radius: 8px;
  margin: 0 -8px 18px;
  padding: 8px;
  transition: background 0.15s;
}

.field--clickable:hover {
  background: var(--ion-color-light, #f4f5f8);
}

.field--clickable.field--last {
  margin-bottom: -8px;
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--ion-color-medium, #92949c);
  margin-bottom: 6px;
  line-height: 1;
}

.field-input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--ion-border-color, #d7d8da);
  background: var(--ion-background-color, #fff);
  font-size: 15px;
  line-height: 1.4;
  color: var(--ion-text-color, #1a1a1a);
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--ion-color-primary, #3880ff);
  box-shadow: 0 0 0 3px rgba(56, 128, 255, 0.1);
}

.field-input::placeholder {
  color: var(--ion-placeholder-color, #a2a4ab);
}

.field-value {
  font-size: 15px;
  color: var(--ion-text-color, #1a1a1a);
  line-height: 1.5;
}

.field-value--muted {
  color: var(--ion-color-medium, #92949c);
}

.field-value--mono {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 13px;
  word-break: break-all;
}

.field-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.field-action-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--ion-color-medium, #92949c);
  margin-top: 2px;
  margin-left: auto;
}

/* ── Danger button ── */
.btn-danger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid var(--ion-color-danger, #eb445a);
  background: transparent;
  color: var(--ion-color-danger, #eb445a);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  box-sizing: border-box;
}

.btn-danger:hover {
  background: rgba(235, 68, 90, 0.06);
}

/* ── Hints ── */
.hint {
  font-size: 12px;
  color: var(--ion-color-medium, #92949c);
  line-height: 1.6;
  margin: 0;
  padding: 0 4px;
}

.hint--inline {
  margin-top: 12px;
}

.empty-state {
  text-align: center;
  color: var(--ion-color-medium, #92949c);
  font-size: 14px;
  padding: 16px 0 0;
  margin: 0;
}

/* ── Textarea ── */
.field-textarea {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  line-height: 1.5;
}

/* ── Cover Preview ── */
.cover-preview {
  position: relative;
  margin-bottom: 12px;
  border-radius: 10px;
  overflow: hidden;
  max-height: 180px;
}

.cover-preview__img {
  width: 100%;
  height: auto;
  max-height: 180px;
  object-fit: cover;
  display: block;
  border-radius: 10px;
}

.cover-preview__remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s;
}

.cover-preview__remove:hover {
  background: rgba(235, 68, 90, 0.8);
}

/* ── Upload Button ── */
.btn-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px dashed var(--ion-border-color, #d7d8da);
  background: transparent;
  color: var(--ion-color-primary, #3880ff);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
  box-sizing: border-box;
}

.btn-upload:hover {
  background: rgba(56, 128, 255, 0.04);
  border-color: var(--ion-color-primary, #3880ff);
}
</style>
