<script setup lang="ts">
import { IonButton, IonSpinner } from '@ionic/vue'
import { useI18n } from 'vue-i18n'
import FilePreview from '../FilePreview.vue'

const props = defineProps<{
  path: string
  content: string
  ready: boolean
  dirty: boolean
  saving: boolean
  loading: boolean
  error: string
  retryable: boolean
}>()
const emit = defineEmits<{
  'update:content': [content: string]
  'save': []
  'reload': []
}>()
const { t } = useI18n()
function save() {
  if (props.ready && props.dirty && !props.saving && !props.loading)
    emit('save')
}
</script>

<template>
  <section class="workspace-text-preview">
    <div v-if="dirty" class="workspace-text-preview__toolbar">
      <span>{{ t('workspace.modified') }}</span>
      <IonButton size="small" :disabled="saving || loading" @click="save">
        {{ saving ? t('editor.saving') : t('workspace.save') }}
      </IonButton>
    </div>
    <div v-if="error" role="alert" class="workspace-text-preview__error">
      <p>{{ error }}</p>
      <IonButton v-if="retryable" fill="outline" size="small" :disabled="saving || loading" @click="emit('reload')">
        {{ t('workspace.reloadSaved') }}
      </IonButton>
    </div>
    <div v-if="loading" role="status" class="workspace-text-preview__empty">
      <IonSpinner />
      {{ t('workspace.loadingFile') }}
    </div>
    <FilePreview
      v-else-if="ready"
      class="workspace-text-preview__editor"
      :content="content"
      :filename="path"
      :readonly="false"
      @update:content="emit('update:content', $event)"
      @save="save"
    />
    <p v-else-if="!error" class="workspace-text-preview__empty">
      {{ t('workspace.selectFile') }}
    </p>
  </section>
</template>

<style scoped>
.workspace-text-preview {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.workspace-text-preview__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-xs) var(--adv-space-md);
  background: var(--adv-surface-card);
  border-bottom: 1px solid var(--adv-border-subtle);
}

.workspace-text-preview__error {
  padding: var(--adv-space-sm) var(--adv-space-md);
  color: var(--ion-color-danger);
  background: var(--adv-surface-card);
  overflow-wrap: anywhere;
}

.workspace-text-preview__error p {
  margin: 0;
}

.workspace-text-preview__empty {
  padding: var(--adv-space-md);
  color: var(--adv-text-secondary);
}

.workspace-text-preview__editor {
  flex: 1;
  min-height: 0;
  height: auto;
}
</style>
