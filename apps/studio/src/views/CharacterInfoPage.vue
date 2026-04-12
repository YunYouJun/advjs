<script setup lang="ts">
import {
  IonButton,
  IonIcon,
} from '@ionic/vue'
import { chatbubbleOutline, createOutline, journalOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import LayoutPage from '../components/common/LayoutPage.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useCharacterDiaryStore } from '../stores/useCharacterDiaryStore'
import { useCharacterMemoryStore } from '../stores/useCharacterMemoryStore'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
import { getValidAvatarUrl } from '../utils/chatUtils'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { characters } = useProjectContent()
const memoryStore = useCharacterMemoryStore()
const stateStore = useCharacterStateStore()
const diaryStore = useCharacterDiaryStore()

const characterId = computed(() => route.params.characterId as string)
const character = computed(() => characters.value.find(c => c.id === characterId.value))
const avatarUrl = computed(() => getValidAvatarUrl(character.value?.avatar))

const dynamicState = computed(() => stateStore.getState(characterId.value))
const memory = computed(() => memoryStore.getMemory(characterId.value))
const recentDiaries = computed(() => diaryStore.getDiaries(characterId.value).slice(-3).reverse())

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
  <LayoutPage :title="character?.name || characterId" show-back-button default-href="/tabs/world">
    <div v-if="character" class="ci-page">
      <!-- Avatar + Name Header -->
      <div class="ci-hero">
        <div class="ci-hero__avatar">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" class="ci-hero__img">
          <span v-else class="ci-hero__initials">{{ (character.name || characterId).slice(0, 2) }}</span>
        </div>
        <h2 class="ci-hero__name">
          {{ character.name }}
        </h2>
        <span v-if="character.faction" class="ci-hero__faction">{{ character.faction }}</span>
        <div v-if="character.tags?.length" class="ci-hero__tags">
          <span v-for="tag in character.tags" :key="tag" class="ci-hero__tag">{{ tag }}</span>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="ci-quick-actions">
        <IonButton fill="outline" size="small" @click="router.push(`/tabs/world/chat/${characterId}`)">
          <IonIcon slot="start" :icon="chatbubbleOutline" />
          {{ t('characters.actionChat') }}
        </IonButton>
        <IonButton fill="outline" size="small" @click="router.push(`/tabs/world/diary/${characterId}`)">
          <IonIcon slot="start" :icon="journalOutline" />
          {{ t('characters.actionDiary') }}
        </IonButton>
        <IonButton fill="outline" size="small" @click="router.push('/tabs/workspace/characters')">
          <IonIcon slot="start" :icon="createOutline" />
          {{ t('characters.actionEdit') }}
        </IonButton>
      </div>

      <!-- Sections -->
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
        </section>

        <!-- Dynamic State -->
        <section v-if="dynamicState && (dynamicState.location || dynamicState.health || dynamicState.activity)" class="ci-section">
          <h4 class="ci-section__title">
            {{ t('world.currentState') }}
          </h4>
          <div class="ci-state">
            <div v-if="dynamicState.location" class="ci-state__item">
              <span class="ci-state__label">{{ t('world.location') }}</span>
              <span class="ci-state__value">{{ dynamicState.location }}</span>
            </div>
            <div v-if="dynamicState.health" class="ci-state__item">
              <span class="ci-state__label">{{ t('world.health') }}</span>
              <span class="ci-state__value">{{ dynamicState.health }}</span>
            </div>
            <div v-if="dynamicState.activity" class="ci-state__item">
              <span class="ci-state__label">{{ t('world.activity') }}</span>
              <span class="ci-state__value">{{ dynamicState.activity }}</span>
            </div>
          </div>
        </section>

        <!-- Emotional Memory -->
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
          <div v-if="memory.keyEvents.length" class="ci-key-events">
            <h5 class="ci-sub-title">
              {{ t('world.keyEvents') }}
            </h5>
            <div v-for="ev in memory.keyEvents.slice(-5)" :key="ev.timestamp" class="ci-key-event">
              {{ ev.summary }}
            </div>
          </div>
        </section>

        <!-- Relationships -->
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

        <!-- Recent Diary Preview -->
        <section v-if="recentDiaries.length > 0" class="ci-section">
          <div class="ci-section__header-row">
            <h4 class="ci-section__title">
              {{ t('world.diary') }}
            </h4>
            <IonButton fill="clear" size="small" @click="router.push(`/tabs/world/diary/${characterId}`)">
              {{ t('common.viewAll') }}
            </IonButton>
          </div>
          <div class="ci-diary-list">
            <div v-for="entry in recentDiaries" :key="entry.id" class="ci-diary-item">
              <div class="ci-diary-meta">
                <span class="ci-diary-date">{{ entry.date }} {{ entry.period }}</span>
                <span v-if="entry.mood" class="ci-diary-mood">{{ entry.mood }}</span>
              </div>
              <p class="ci-diary-content">
                {{ entry.content.slice(0, 100) }}{{ entry.content.length > 100 ? '…' : '' }}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div v-else class="ci-empty">
      <p>{{ t('workspace.noCharacters') }}</p>
    </div>
  </LayoutPage>
</template>

<style scoped>
.ci-page {
  padding: var(--adv-space-md, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md, 16px);
}

/* ── Hero ── */
.ci-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--adv-space-xs, 4px);
  padding: var(--adv-space-md, 16px) 0;
}

.ci-hero__avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(99, 102, 241, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--adv-space-xs, 4px);
}

.ci-hero__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ci-hero__initials {
  font-size: 28px;
  font-weight: 800;
  color: #8b5cf6;
  text-transform: uppercase;
}

.ci-hero__name {
  font-size: 20px;
  font-weight: 700;
  color: var(--adv-text-primary);
  margin: 0;
}

.ci-hero__faction {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-tertiary);
}

.ci-hero__tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 2px;
}

.ci-hero__tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.08);
  color: #8b5cf6;
}

/* ── Quick actions ── */
.ci-quick-actions {
  display: flex;
  justify-content: center;
  gap: var(--adv-space-xs, 4px);
}

.ci-quick-actions ion-button {
  --color: #8b5cf6;
  --border-color: rgba(139, 92, 246, 0.3);
  font-size: 12px;
}

/* ── Sections ── */
.ci-sections {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-lg, 20px);
}

.ci-section {
  background: var(--adv-surface-card, #fff);
  border: 1px solid var(--adv-border-subtle, #e2e8f0);
  border-radius: var(--adv-radius-lg, 14px);
  padding: var(--adv-space-md, 16px);
}

:root.dark .ci-section {
  background: var(--adv-surface-card, #1e1e2e);
  border-color: rgba(255, 255, 255, 0.06);
}

.ci-section__title {
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 700;
  color: var(--adv-text-primary);
  margin: 0 0 var(--adv-space-sm, 8px);
}

.ci-section__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ci-section__header-row .ci-section__title {
  margin: 0;
}

.ci-section__content {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-secondary);
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
}

/* ── State ── */
.ci-state {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs, 4px);
}

.ci-state__item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm, 8px);
}

.ci-state__label {
  font-size: var(--adv-font-caption, 11px);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  min-width: 48px;
}

.ci-state__value {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-primary);
}

/* ── Emotional bars ── */
.ci-bar-row {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm, 8px);
  margin-bottom: var(--adv-space-xs, 4px);
}

.ci-bar-label {
  font-size: var(--adv-font-caption, 11px);
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
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-secondary);
  min-width: 28px;
  text-align: right;
}

.ci-mood-badge {
  display: inline-block;
  font-size: var(--adv-font-caption, 11px);
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
  padding: 2px 10px;
  border-radius: var(--adv-radius-sm, 6px);
  margin: var(--adv-space-xs, 4px) 0;
}

.ci-sub-title {
  font-size: var(--adv-font-caption, 11px);
  font-weight: 600;
  color: var(--adv-text-tertiary);
  margin: var(--adv-space-sm, 8px) 0 var(--adv-space-xs, 4px);
}

.ci-key-events {
  margin-top: var(--adv-space-xs, 4px);
}

.ci-key-event {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-secondary);
  padding: 4px var(--adv-space-sm, 8px);
  border-left: 2px solid rgba(139, 92, 246, 0.3);
  margin-bottom: var(--adv-space-xs, 4px);
  line-height: 1.5;
}

/* ── Relationships ── */
.ci-rel {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-xs, 4px) 0;
}

.ci-rel__target {
  font-weight: 600;
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body-sm, 13px);
}

.ci-rel__type {
  font-size: var(--adv-font-caption, 11px);
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
  padding: 2px 8px;
  border-radius: var(--adv-radius-sm, 6px);
}

.ci-rel__desc {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary);
}

/* ── Diary preview ── */
.ci-diary-list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm, 8px);
}

.ci-diary-item {
  background: var(--adv-surface-elevated, #f8fafc);
  border-radius: var(--adv-radius-md, 8px);
  padding: var(--adv-space-sm, 8px);
}

:root.dark .ci-diary-item {
  background: var(--adv-surface-elevated, #252536);
}

.ci-diary-meta {
  display: flex;
  align-items: center;
  gap: var(--adv-space-xs, 4px);
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

.ci-diary-content {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* ── Empty ── */
.ci-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--adv-space-xl, 48px);
  color: var(--adv-text-tertiary);
}
</style>
