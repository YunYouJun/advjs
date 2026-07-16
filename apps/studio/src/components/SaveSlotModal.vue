<script setup lang="ts">
import type { RuntimeSnapshot } from '@advjs/types'
import type { DbPlaySaveSlot } from '../utils/db'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { closeOutline, saveOutline, trashOutline } from 'ionicons/icons'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlaySaveSlots } from '../composables/usePlaySaveSlots'
import { useStudioStore } from '../stores/useStudioStore'

const props = defineProps<{
  open: boolean
  /** Resolves the current snapshot at save time (called when a slot is clicked). */
  getSnapshot: () => {
    runtime: RuntimeSnapshot
    chapterFile: string
    order: number
    totalNodes: number
    chapterTitle?: string
    previewText?: string
    background: string
    tachies: Map<string, { status: string }>
  }
  /** Current chapter's progress fields (snapshot will embed these). */
  visitedOrders: number[]
  history: number[]
  unlockedCgs: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const studioStore = useStudioStore()
const { slots, refresh, save, remove } = usePlaySaveSlots(() => studioStore.currentProject?.projectId)

const note = ref('')
const slotCount = 12

watch(() => props.open, async (open) => {
  if (open) {
    note.value = ''
    await refresh()
  }
})

interface Cell {
  slot: string
  row?: DbPlaySaveSlot
}

const cells = computed<Cell[]>(() => {
  const byName = new Map<string, DbPlaySaveSlot>()
  for (const row of slots.value)
    byName.set(row.slot, row)
  return Array.from({ length: slotCount }, (_, i) => {
    const name = `slot-${String(i + 1).padStart(2, '0')}`
    return { slot: name, row: byName.get(name) }
  })
})

async function handleSave(cell: Cell) {
  try {
    const base = props.getSnapshot()
    await save(cell.slot, {
      ...base,
      visitedOrders: [...props.visitedOrders],
      history: [...props.history],
      unlockedCGs: [...props.unlockedCgs],
    }, note.value.trim() || undefined)
    const toast = await toastController.create({
      message: t('preview.saveSuccess', { slot: cell.slot }),
      duration: 1500,
      position: 'top',
      color: 'success',
    })
    await toast.present()
    note.value = ''
  }
  catch (e) {
    const toast = await toastController.create({
      message: `${t('preview.saveError')}: ${e instanceof Error ? e.message : String(e)}`,
      duration: 2500,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
}

async function handleDelete(cell: Cell, ev: Event) {
  ev.stopPropagation()
  if (!cell.row)
    return
  // eslint-disable-next-line no-alert
  if (!window.confirm(t('preview.deleteConfirm')))
    return
  await remove(cell.slot)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <IonModal :is-open="open" @did-dismiss="close">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('preview.saveSlotTitle') }}</IonTitle>
        <IonButtons slot="end">
          <IonButton fill="clear" @click="close">
            <IonIcon slot="icon-only" :icon="closeOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <IonItem lines="full">
        <IonLabel position="stacked">
          {{ t('preview.slotNote') }}
        </IonLabel>
        <IonInput v-model="note" :placeholder="t('preview.slotNotePlaceholder')" />
      </IonItem>

      <div class="save-grid">
        <button
          v-for="cell in cells"
          :key="cell.slot"
          type="button"
          class="save-card"
          :class="{ 'save-card--filled': cell.row }"
          @click="handleSave(cell)"
        >
          <div class="save-card__head">
            <span class="save-card__slot">{{ cell.slot }}</span>
            <IonIcon v-if="!cell.row" :icon="saveOutline" />
            <button
              v-else
              type="button"
              class="save-card__del"
              :aria-label="t('preview.deleteSlot')"
              @click="(e: Event) => handleDelete(cell, e)"
            >
              <IonIcon :icon="trashOutline" />
            </button>
          </div>
          <template v-if="cell.row">
            <div class="save-card__title">
              {{ cell.row.chapterTitle || cell.row.chapterFile }}
            </div>
            <div class="save-card__preview">
              {{ cell.row.previewText || '—' }}
            </div>
            <div class="save-card__meta">
              <span>{{ t('preview.currentNode', { order: cell.row.order + 1, total: cell.row.totalNodes }) }}</span>
              <span>{{ formatTime(cell.row.savedAt) }}</span>
            </div>
            <div v-if="cell.row.note" class="save-card__note">
              {{ cell.row.note }}
            </div>
          </template>
          <template v-else>
            <div class="save-card__empty">
              {{ t('preview.emptySlot') }}
            </div>
          </template>
        </button>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.save-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 16px;
}

@media (min-width: 600px) {
  .save-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.save-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 116px;
  padding: 12px 14px;
  border-radius: var(--adv-radius-md);
  border: 1px dashed rgba(var(--adv-text-secondary-rgb, 100, 100, 100), 0.3);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition:
    border-color 0.15s ease,
    transform 0.1s ease;
}

.save-card:hover {
  border-color: var(--ion-color-primary);
}

.save-card:active {
  transform: scale(0.98);
}

.save-card--filled {
  border-style: solid;
}

.save-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
}

.save-card__slot {
  font-family:
    ui-monospace,
    SF Mono,
    Menlo,
    monospace;
  font-weight: 600;
}

.save-card__del {
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

.save-card__del:hover {
  background: rgba(244, 67, 54, 0.08);
  color: #f44336;
}

.save-card__title {
  font-weight: 600;
  font-size: var(--adv-font-body);
  line-height: 1.2;
}

.save-card__preview {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.save-card__meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

.save-card__note {
  font-size: var(--adv-font-caption);
  color: var(--ion-color-primary);
  font-style: italic;
}

.save-card__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--adv-text-tertiary);
  font-size: var(--adv-font-body-sm);
}
</style>
