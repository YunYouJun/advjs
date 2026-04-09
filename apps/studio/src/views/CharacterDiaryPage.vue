<script setup lang="ts">
import {
  alertController,
  IonButton,
} from '@ionic/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import DiaryEntryContent from '../components/DiaryEntryContent.vue'
import StudioPage from '../components/StudioPage.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useCharacterDiaryStore } from '../stores/useCharacterDiaryStore'
import { showToast } from '../utils/toast'

const { t } = useI18n()
const route = useRoute()
const diaryStore = useCharacterDiaryStore()
const { characters } = useProjectContent()

const characterId = computed(() => route.params.characterId as string)
const character = computed(() => characters.value.find(c => c.id === characterId.value))
const characterName = computed(() => character.value?.name || characterId.value)
const diaryEntries = computed(() => [...diaryStore.getDiaries(characterId.value)].reverse())
const isDiaryGenerating = computed(() => diaryStore.isGenerating(characterId.value))

async function handleGenerate() {
  if (!character.value)
    return

  // dynamic import to avoid circular deps
  const { useWorldClockStore } = await import('../stores/useWorldClockStore')
  const clockStore = useWorldClockStore()
  const { date, period } = clockStore.clock

  if (diaryStore.hasDiary(characterId.value, date, period)) {
    await showToast(t('world.diaryAlreadyExists'), 'warning')
    return
  }

  const entry = await diaryStore.generateDiary(character.value)
  if (!entry) {
    await showToast(t('world.diaryGenerateFailed'), 'danger')
  }
}

async function confirmDelete(diaryId: string) {
  const alert = await alertController.create({
    header: t('common.confirm'),
    message: t('world.diaryDeleteConfirm'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.delete'),
        role: 'destructive',
        handler: () => diaryStore.deleteDiary(characterId.value, diaryId),
      },
    ],
  })
  await alert.present()
}
</script>

<template>
  <StudioPage :title="t('characters.diaryTitle', { name: characterName })" show-back-button :default-href="`/tabs/world/chat/${characterId}`">
    <template #end>
      <IonButton
        :disabled="isDiaryGenerating"
        @click="handleGenerate"
      >
        {{ isDiaryGenerating ? t('world.diaryGenerating') : t('world.diaryGenerate') }}
      </IonButton>
    </template>

    <!-- Diary list -->
    <div v-if="diaryEntries.length > 0" class="diary-list">
      <div
        v-for="entry in diaryEntries"
        :key="entry.id"
        class="diary-item"
      >
        <div class="diary-item__header">
          <span class="diary-item__date">
            📅 {{ entry.date }}
          </span>
          <span class="diary-item__period">
            {{ t(`world.period_${entry.period}`, entry.period) }}
          </span>
          <span v-if="entry.mood" class="diary-item__mood">
            {{ entry.mood }}
          </span>
          <button class="diary-item__delete" @click="confirmDelete(entry.id)">
            ×
          </button>
        </div>
        <div class="diary-item__content">
          <DiaryEntryContent :content="entry.content" :max-length="200" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="diary-empty">
      <div class="diary-empty__icon">
        📓
      </div>
      <p class="diary-empty__title">
        {{ t('characters.diaryEmpty') }}
      </p>
      <p class="diary-empty__hint">
        {{ t('characters.diaryEmptyHint') }}
      </p>
      <IonButton
        fill="outline"
        size="small"
        :disabled="isDiaryGenerating"
        @click="handleGenerate"
      >
        {{ isDiaryGenerating ? t('world.diaryGenerating') : t('world.diaryGenerate') }}
      </IonButton>
    </div>
  </StudioPage>
</template>

<style scoped>
.diary-list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-md, 16px);
}

.diary-item {
  background: var(--adv-surface-card, #fff);
  border: 1px solid var(--adv-border-subtle, #e2e8f0);
  border-radius: var(--adv-radius-lg, 14px);
  padding: var(--adv-space-md, 16px);
}

:root.dark .diary-item {
  background: var(--adv-surface-card, #1e1e2e);
  border-color: rgba(255, 255, 255, 0.06);
}

.diary-item__header {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm, 8px);
  margin-bottom: var(--adv-space-sm, 8px);
}

.diary-item__date {
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.diary-item__period {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary, #94a3b8);
}

.diary-item__mood {
  font-size: var(--adv-font-caption, 11px);
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
  padding: 1px 8px;
  border-radius: 999px;
}

.diary-item__delete {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--adv-text-tertiary, #94a3b8);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
}

.diary-item__delete:hover {
  color: var(--adv-error, #ef4444);
}

.diary-item__content {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-secondary);
  line-height: 1.7;
}

/* Empty state */
.diary-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--adv-space-xl, 48px) var(--adv-space-md, 16px);
  text-align: center;
  gap: var(--adv-space-sm, 8px);
}

.diary-empty__icon {
  font-size: 48px;
  opacity: 0.6;
}

.diary-empty__title {
  font-size: var(--adv-font-body, 15px);
  color: var(--adv-text-primary);
  margin: 0;
  font-weight: 600;
}

.diary-empty__hint {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-tertiary, #94a3b8);
  margin: 0;
  max-width: 280px;
}
</style>
