<script setup lang="ts">
import type { DbPlaySaveSlot } from '../utils/db'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { closeOutline, folderOpenOutline, trashOutline } from 'ionicons/icons'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlaySaveSlots } from '../composables/usePlaySaveSlots'
import { useStudioStore } from '../stores/useStudioStore'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** Selected slot — parent restores chapter + position from row payload. */
  'select': [row: DbPlaySaveSlot]
}>()

const { t } = useI18n()
const studioStore = useStudioStore()
const { slots, refresh, remove } = usePlaySaveSlots(() => studioStore.currentProject?.projectId)

const sorted = computed(() => [...slots.value].sort((a, b) => b.savedAt - a.savedAt))

watch(() => props.open, async (open) => {
  if (open)
    await refresh()
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function close() {
  emit('update:open', false)
}

async function handleSelect(row: DbPlaySaveSlot) {
  emit('select', row)
  close()
}

async function handleDelete(row: DbPlaySaveSlot, ev: Event) {
  ev.stopPropagation()
  // eslint-disable-next-line no-alert
  if (!window.confirm(t('preview.deleteConfirm')))
    return
  await remove(row.slot)
}
</script>

<template>
  <IonModal :is-open="open" @did-dismiss="close">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('preview.loadSlotTitle') }}</IonTitle>
        <IonButtons slot="end">
          <IonButton fill="clear" @click="close">
            <IonIcon slot="icon-only" :icon="closeOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <div v-if="sorted.length === 0" class="load-empty">
        <IonIcon :icon="folderOpenOutline" />
        <p>{{ t('preview.noSlots') }}</p>
      </div>
      <div v-else class="load-list">
        <button
          v-for="row in sorted"
          :key="row.slot"
          type="button"
          class="load-card"
          @click="handleSelect(row)"
        >
          <div class="load-card__head">
            <span class="load-card__slot">{{ row.slot }}</span>
            <button
              type="button"
              class="load-card__del"
              :aria-label="t('preview.deleteSlot')"
              @click="(e: Event) => handleDelete(row, e)"
            >
              <IonIcon :icon="trashOutline" />
            </button>
          </div>
          <div class="load-card__title">
            {{ row.chapterTitle || row.chapterFile }}
          </div>
          <div class="load-card__preview">
            {{ row.previewText || '—' }}
          </div>
          <div class="load-card__meta">
            <span>{{ t('preview.currentNode', { order: row.order + 1, total: row.totalNodes }) }}</span>
            <span>{{ formatTime(row.savedAt) }}</span>
          </div>
          <div v-if="row.note" class="load-card__note">
            {{ row.note }}
          </div>
        </button>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.load-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--adv-text-secondary);
}

.load-empty ion-icon {
  font-size: 48px;
  color: var(--adv-text-tertiary);
}

.load-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.load-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: var(--adv-radius-md);
  border: 1px solid rgba(var(--adv-text-secondary-rgb, 100, 100, 100), 0.15);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition:
    border-color 0.15s ease,
    transform 0.1s ease;
}

.load-card:hover {
  border-color: var(--ion-color-primary);
}

.load-card:active {
  transform: scale(0.98);
}

.load-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
}

.load-card__slot {
  font-family:
    ui-monospace,
    SF Mono,
    Menlo,
    monospace;
  font-weight: 600;
}

.load-card__del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--adv-text-secondary);
  cursor: pointer;
  border-radius: var(--adv-radius-sm);
}

.load-card__del:hover {
  background: rgba(244, 67, 54, 0.08);
  color: #f44336;
}

.load-card__title {
  font-weight: 600;
  font-size: var(--adv-font-body);
}

.load-card__preview {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.load-card__meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

.load-card__note {
  font-size: var(--adv-font-caption);
  color: var(--ion-color-primary);
  font-style: italic;
}
</style>
