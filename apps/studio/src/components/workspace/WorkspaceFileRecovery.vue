<script setup lang="ts">
import type { WorkspaceMutationRecord } from '../../utils/workspaceMutationJournal'
import { IonButton } from '@ionic/vue'
import { useI18n } from 'vue-i18n'
import SCard from '../ui/SCard.vue'

defineProps<{ records: readonly WorkspaceMutationRecord[], busy: boolean, error: string }>()
const emit = defineEmits<{ restore: [id: string], keep: [id: string], download: [id: string], retry: [] }>()
const { t } = useI18n()
</script>

<template>
  <section class="workspace-file-operations" :aria-busy="busy">
    <p v-if="busy" class="workspace-file-operations__status" role="status">
      {{ t('workspace.processingFiles') }}
    </p>
    <SCard v-if="records.length || error" class="workspace-file-recovery" role="region" :aria-label="t('workspace.recoveryTitle')">
      <h3>{{ t('workspace.recoveryTitle') }}</h3>
      <p>{{ t('workspace.recoveryRequired') }}</p>
      <p v-if="error" role="alert">
        {{ error }}
      </p>
      <IonButton v-if="error" size="small" fill="outline" :disabled="busy" @click="emit('retry')">
        {{ t('workspace.retryRecovery') }}
      </IonButton>
      <ul>
        <li v-for="record in records" :key="record.id">
          <ul class="workspace-file-recovery__paths">
            <li v-for="path in record.roots" :key="path">
              {{ path }}
            </li>
          </ul>
          <p v-if="record.drafts.length">
            {{ t('workspace.recoveryPrivateDrafts', { count: record.drafts.length }) }}
          </p>
          <div class="workspace-file-recovery__actions">
            <IonButton size="small" fill="outline" :disabled="busy" @click="emit('download', record.id)">
              {{ t('workspace.downloadRecovery') }}
            </IonButton>
            <IonButton size="small" :disabled="busy" @click="emit('restore', record.id)">
              {{ t('workspace.restoreOperation') }}
            </IonButton>
            <IonButton size="small" color="danger" fill="outline" :disabled="busy" @click="emit('keep', record.id)">
              {{ t('workspace.keepCurrentFiles') }}
            </IonButton>
          </div>
        </li>
      </ul>
    </SCard>
  </section>
</template>

<style scoped>
.workspace-file-operations__status {
  margin: var(--adv-space-md);
  color: var(--adv-text-secondary);
}
.workspace-file-recovery {
  margin: var(--adv-space-md);
  overflow-wrap: anywhere;
}
.workspace-file-recovery h3 {
  margin-top: 0;
}
.workspace-file-recovery__paths {
  max-height: 12rem;
  overflow: auto;
}
.workspace-file-recovery__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-xs);
}
</style>
