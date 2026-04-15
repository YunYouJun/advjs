<script setup lang="ts">
import type { AdvCharacter, AdvCharacterDynamicState } from '@advjs/types'
import type { KnowledgeEntry } from '../composables/useKnowledgeBase'
import type { CharacterDiaryEntry } from '../stores/useCharacterDiaryStore'
import type { CharacterMemory } from '../stores/useCharacterMemoryStore'
import { alertController, IonButton, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DiaryEntryContent from './DiaryEntryContent.vue'
import EmotionalArcChart from './EmotionalArcChart.vue'
import KnowledgeManageModal from './KnowledgeManageModal.vue'

defineProps<{
  character: AdvCharacter
  isOpen: boolean
  dynamicState?: AdvCharacterDynamicState
  knowledgeEntries?: KnowledgeEntry[]
  knowledgeLoading?: boolean
  diaries?: CharacterDiaryEntry[]
  isDiaryGenerating?: boolean
  memory?: CharacterMemory
}>()

const emit = defineEmits<{
  close: []
  refreshKnowledge: []
  generateDiary: []
  deleteDiary: [diaryId: string]
}>()

const { t } = useI18n()

const showKnowledgeModal = ref(false)

async function confirmDeleteDiary(diaryId: string) {
  const alert = await alertController.create({
    header: t('common.confirm'),
    message: t('world.diaryDeleteConfirm'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.delete'),
        role: 'destructive',
        handler: () => emit('deleteDiary', diaryId),
      },
    ],
  })
  await alert.present()
}

function affinityClass(affinity: number): string {
  if (affinity >= 60)
    return 'ci-bar__fill--high'
  if (affinity >= 20)
    return 'ci-bar__fill--mid'
  if (affinity >= -20)
    return 'ci-bar__fill--neutral'
  return 'ci-bar__fill--low'
}
</script>

<template>
  <IonModal :is-open="isOpen" :initial-breakpoint="0.75" :breakpoints="[0, 0.5, 0.75, 1]" @did-dismiss="emit('close')">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ character.name }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <div class="ci-sections">
        <section v-if="character.appearance" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.appearance') }}
          </h4>
          <p class="ci-section__content">
            {{ character.appearance }}
          </p>
        </section>

        <section v-if="character.personality" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.personality') }}
          </h4>
          <p class="ci-section__content">
            {{ character.personality }}
          </p>
        </section>

        <section v-if="character.background" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.background') }}
          </h4>
          <p class="ci-section__content">
            {{ character.background }}
          </p>
        </section>

        <section v-if="character.concept" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.concept') }}
          </h4>
          <p class="ci-section__content">
            {{ character.concept }}
          </p>
        </section>

        <section v-if="character.speechStyle" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.speechStyle') }}
          </h4>
          <p class="ci-section__content">
            {{ character.speechStyle }}
          </p>
        </section>

        <section v-if="character.knowledgeDomain" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('world.knowledgeDomain') }}
          </h4>
          <p class="ci-section__content">
            {{ character.knowledgeDomain }}
          </p>
          <IonButton
            v-if="knowledgeEntries"
            fill="outline"
            size="small"
            class="ci-knowledge-btn"
            @click="showKnowledgeModal = true"
          >
            {{ t('world.knowledgeBase') }}
          </IonButton>
        </section>

        <section v-if="character.faction" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.faction') }}
          </h4>
          <p class="ci-section__content">
            {{ character.faction }}
          </p>
        </section>

        <section v-if="dynamicState && (dynamicState.location || dynamicState.health || dynamicState.activity || dynamicState.attributes)" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('world.currentState') }}
          </h4>
          <div class="ci-state">
            <div v-if="dynamicState.location" class="ci-state__item">
              <span class="ci-state__label">{{ t('world.location') }}</span>
              <span class="ci-state__value">📍 {{ dynamicState.location }}</span>
            </div>
            <div v-if="dynamicState.health" class="ci-state__item">
              <span class="ci-state__label">{{ t('world.health') }}</span>
              <span class="ci-state__value">{{ dynamicState.health }}</span>
            </div>
            <div v-if="dynamicState.activity" class="ci-state__item">
              <span class="ci-state__label">{{ t('world.activity') }}</span>
              <span class="ci-state__value">{{ dynamicState.activity }}</span>
            </div>
            <div v-if="dynamicState.attributes && Object.keys(dynamicState.attributes).length > 0" class="ci-state__attrs">
              <span class="ci-state__label">{{ t('world.attributes') }}</span>
              <div v-for="(value, key) in dynamicState.attributes" :key="key" class="ci-state__attr">
                <span class="ci-state__attr-key">{{ key }}</span>
                <span class="ci-state__attr-value">{{ value }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Emotional Memory Section -->
        <section v-if="memory?.emotionalState" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('world.emotionalState') }}
          </h4>
          <div class="ci-bar-row">
            <span class="ci-bar-label">{{ t('world.affinity') }}</span>
            <div class="ci-bar">
              <div
                class="ci-bar__fill"
                :class="affinityClass(memory.emotionalState.affinity)"
                :style="{ width: `${(memory.emotionalState.affinity + 100) / 2}%` }"
              />
            </div>
            <span class="ci-bar-value">{{ memory.emotionalState.affinity }}</span>
          </div>
          <div class="ci-bar-row">
            <span class="ci-bar-label">{{ t('world.trust') }}</span>
            <div class="ci-bar">
              <div
                class="ci-bar__fill ci-bar__fill--trust"
                :style="{ width: `${Math.min(100, Math.max(0, memory.emotionalState.trust))}%` }"
              />
            </div>
            <span class="ci-bar-value">{{ memory.emotionalState.trust }}</span>
          </div>
          <div v-if="memory.emotionalState.mood" class="ci-mood-badge">
            {{ memory.emotionalState.mood }}
          </div>
          <div v-if="memory?.userProfile?.length" class="ci-profile-list">
            <h5 class="ci-sub-title">
              {{ t('world.userProfile') }}
            </h5>
            <div v-for="p in memory.userProfile.slice(-5)" :key="p.key" class="ci-profile-item">
              <span class="ci-profile-key">{{ p.key }}</span>
              <span class="ci-profile-value">{{ p.value }}</span>
            </div>
          </div>
          <div v-if="memory.keyEvents.length" class="ci-key-events">
            <h5 class="ci-sub-title">
              {{ t('world.keyEvents') }}
            </h5>
            <div v-for="ev in memory.keyEvents.slice(-3)" :key="ev.timestamp" class="ci-key-event">
              {{ ev.summary }}
            </div>
          </div>
        </section>

        <!-- Emotional Arc Chart -->
        <section v-if="memory?.emotionalHistory?.length" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('world.emotionalArc') }}
          </h4>
          <EmotionalArcChart :history="memory.emotionalHistory" />
        </section>

        <section v-if="character.relationships?.length" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.relationships') }}
          </h4>
          <div v-for="rel in character.relationships" :key="rel.targetId" class="ci-rel">
            <span class="ci-rel__target">{{ rel.targetId }}</span>
            <span class="ci-rel__type">{{ rel.type }}</span>
            <span v-if="rel.description" class="ci-rel__desc">{{ rel.description }}</span>
          </div>
        </section>

        <section v-if="character.tags?.length" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('contentEditor.tags') }}
          </h4>
          <p class="ci-section__content">
            {{ character.tags.join(', ') }}
          </p>
        </section>

        <!-- Diary Section -->
        <section class="ci-section">
          <div class="ci-diary-header">
            <h4 class="ci-section__title">
              📓 {{ t('world.diary') }}
            </h4>
            <IonButton
              fill="outline"
              size="small"
              class="ci-diary-generate-btn"
              :disabled="isDiaryGenerating"
              @click="emit('generateDiary')"
            >
              {{ isDiaryGenerating ? t('world.diaryGenerating') : t('world.diaryGenerate') }}
            </IonButton>
          </div>
          <div v-if="diaries && diaries.length > 0" class="ci-diary-list">
            <div
              v-for="entry in [...(diaries || [])].reverse()"
              :key="entry.id"
              class="ci-diary-item"
            >
              <div class="ci-diary-meta">
                <span class="ci-diary-date">{{ entry.date }} {{ entry.period }}</span>
                <span v-if="entry.mood" class="ci-diary-mood">{{ entry.mood }}</span>
                <button class="ci-diary-delete" @click="confirmDeleteDiary(entry.id)">
                  ×
                </button>
              </div>
              <p class="ci-diary-content">
                <DiaryEntryContent :content="entry.content" />
              </p>
            </div>
          </div>
          <p v-else class="ci-section__content">
            {{ t('world.diaryEmpty') }}
          </p>
        </section>
      </div>
    </IonContent>

    <!-- Knowledge Base Modal -->
    <KnowledgeManageModal
      v-if="character.knowledgeDomain && knowledgeEntries"
      :is-open="showKnowledgeModal"
      :domain="character.knowledgeDomain"
      :entries="knowledgeEntries"
      :is-loading="knowledgeLoading || false"
      @close="showKnowledgeModal = false"
      @refresh="emit('refreshKnowledge')"
    />
  </IonModal>
</template>

<style scoped>
.ci-sections {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-lg);
}

.ci-section__title {
  font-size: var(--adv-font-body-sm);
  font-weight: 700;
  color: var(--adv-text-primary);
  margin: 0 0 var(--adv-space-xs);
}

.ci-section__content {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.ci-rel {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-xs) 0;
}

.ci-rel__target {
  font-weight: 600;
  color: var(--adv-text-primary);
}

.ci-rel__type {
  font-size: var(--adv-font-caption);
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
  padding: 2px 8px;
  border-radius: var(--adv-radius-sm);
}

.ci-rel__desc {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

.ci-state {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.ci-state__item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
}

.ci-state__label {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  min-width: 48px;
}

.ci-state__value {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-primary);
}

.ci-state__attrs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--adv-space-xs);
}

.ci-state__attr {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding-left: var(--adv-space-sm);
}

.ci-state__attr-key {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
}

.ci-state__attr-value {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: #8b5cf6;
}

.ci-knowledge-btn {
  margin-top: var(--adv-space-xs);
  --color: #8b5cf6;
  --border-color: rgba(139, 92, 246, 0.3);
}

.ci-diary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--adv-space-sm);
}

.ci-diary-header .ci-section__title {
  margin: 0;
}

.ci-diary-generate-btn {
  --color: #8b5cf6;
  --border-color: rgba(139, 92, 246, 0.3);
}

.ci-diary-list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.ci-diary-item {
  background: var(--adv-surface-elevated, #f8fafc);
  border-radius: var(--adv-radius-md, 8px);
  padding: var(--adv-space-sm);
}

:root.dark .ci-diary-item {
  background: var(--adv-surface-elevated, #252536);
}

.ci-diary-meta {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs);
  margin-bottom: 4px;
}

.ci-diary-date {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary, #94a3b8);
}

.ci-diary-mood {
  font-size: var(--adv-font-caption, 11px);
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
  padding: 1px 6px;
  border-radius: var(--adv-radius-sm, 4px);
}

.ci-diary-delete {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--adv-text-tertiary, #94a3b8);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

.ci-diary-delete:hover {
  color: var(--adv-error, #ef4444);
}

.ci-diary-content {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* Emotional memory section */
.ci-bar-row {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  margin-bottom: var(--adv-space-xs);
}

.ci-bar-label {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  min-width: 44px;
}

.ci-bar {
  flex: 1;
  height: 6px;
  background: var(--adv-surface-elevated, #e2e8f0);
  border-radius: 3px;
  overflow: hidden;
}

:root.dark .ci-bar {
  background: rgba(255, 255, 255, 0.1);
}

.ci-bar__fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
  background: #94a3b8;
}

.ci-bar__fill--high {
  background: #8b5cf6;
}

.ci-bar__fill--mid {
  background: #06b6d4;
}

.ci-bar__fill--neutral {
  background: #94a3b8;
}

.ci-bar__fill--low {
  background: #f97316;
}

.ci-bar__fill--trust {
  background: #10b981;
}

.ci-bar-value {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
  min-width: 28px;
  text-align: right;
}

.ci-mood-badge {
  display: inline-block;
  font-size: var(--adv-font-caption);
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
  padding: 2px 10px;
  border-radius: var(--adv-radius-sm);
  margin: var(--adv-space-xs) 0;
}

.ci-sub-title {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  margin: var(--adv-space-sm) 0 var(--adv-space-xs);
}

.ci-profile-list {
  margin-top: var(--adv-space-xs);
}

.ci-profile-item {
  display: flex;
  align-items: flex-start;
  gap: var(--adv-space-sm);
  padding: 3px 0;
}

.ci-profile-key {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: var(--adv-text-secondary);
  min-width: 60px;
  flex-shrink: 0;
}

.ci-profile-value {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  line-height: 1.5;
}

.ci-key-events {
  margin-top: var(--adv-space-xs);
}

.ci-key-event {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
  padding: 4px var(--adv-space-sm);
  border-left: 2px solid rgba(139, 92, 246, 0.3);
  margin-bottom: var(--adv-space-xs);
  line-height: 1.5;
}
</style>
