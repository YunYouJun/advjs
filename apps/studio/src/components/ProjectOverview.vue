<script setup lang="ts">
import {
  IonIcon,
} from '@ionic/vue'
import {
  addOutline,
  bookOutline,
  bulbOutline,
  chevronForwardOutline,
  documentTextOutline,
  globeOutline,
  imageOutline,
  libraryOutline,
  musicalNotesOutline,
  peopleOutline,
  timeOutline,
} from 'ionicons/icons'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useProjectContent } from '../composables/useProjectContent'
import { useProjectDescription } from '../composables/useProjectDescription'
import { useRecentActivity } from '../composables/useRecentActivity'
import { useStudioStore } from '../stores/useStudioStore'

const { t } = useI18n()
const router = useRouter()
const studioStore = useStudioStore()

const {
  stats,
  isLoading,
  knowledgeBase,
} = useProjectContent()

const {
  worldMd,
  outlineMd,
  glossaryMd,
  extractTitle,
  extractPreview,
  extractSections,
} = useProjectDescription()

const { recentItems } = useRecentActivity()

// --- Derived data for dashboard cards ---
const projectName = computed(() => studioStore.currentProject?.name || '')

const worldTitle = computed(() => extractTitle(worldMd.value) || t('dashboard.worldSetting'))
const worldPreview = computed(() => extractPreview(worldMd.value))
const worldSections = computed(() => extractSections(worldMd.value))
const hasWorld = computed(() => worldMd.value.trim().length > 0)

const outlineTitle = computed(() => extractTitle(outlineMd.value) || t('dashboard.storyOutline'))
const outlinePreview = computed(() => extractPreview(outlineMd.value))
const outlineSections = computed(() => extractSections(outlineMd.value))
const hasOutline = computed(() => outlineMd.value.trim().length > 0)

const glossaryTitle = computed(() => extractTitle(glossaryMd.value) || t('dashboard.glossary'))
const glossarySections = computed(() => extractSections(glossaryMd.value))
const hasGlossary = computed(() => glossaryMd.value.trim().length > 0)

const knowledgeDomains = computed(() => knowledgeBase.domains.value)

const TYPE_ICON: Record<string, string> = {
  chapter: '📖',
  character: '👤',
  scene: '🎬',
  file: '📄',
}

function navigateTo(path: string) {
  router.push(path)
}

function openFileInEditor(file: string) {
  router.push(`/editor?file=${encodeURIComponent(file)}`)
}

function handleRecentClick(item: { id: string, type: string }) {
  if (item.type === 'chapter') {
    router.push(`/editor?file=${encodeURIComponent(item.id)}`)
  }
  else if (item.type === 'character') {
    navigateTo('/tabs/workspace/characters')
  }
  else if (item.type === 'scene') {
    navigateTo('/tabs/workspace/scenes')
  }
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1)
    return t('time.justNow')
  if (diffMins < 60)
    return t('time.minutesAgo', { n: diffMins })
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24)
    return t('time.hoursAgo', { n: diffHours })
  const diffDays = Math.floor(diffHours / 24)
  return t('time.daysAgo', { n: diffDays })
}
</script>

<template>
  <div class="overview">
    <!-- Loading -->
    <div v-if="isLoading" class="overview__loading">
      {{ t('preview.loadingGame') }}
    </div>

    <!-- Project Header -->
    <header v-if="projectName" class="overview__header">
      <h2 class="overview__title">
        {{ projectName }}
      </h2>
      <p v-if="worldPreview" class="overview__desc">
        {{ worldPreview }}
      </p>
    </header>

    <!-- ═══════════ Stats Row ═══════════ -->
    <nav class="stats" aria-label="Resource navigation">
      <button class="stats__card" data-accent="indigo" @click="navigateTo('/tabs/workspace/chapters')">
        <span class="stats__icon"><IonIcon :icon="bookOutline" /></span>
        <span class="stats__value">{{ stats.chapters }}</span>
        <span class="stats__label">{{ t('preview.chaptersCount') }}</span>
        <IonIcon :icon="chevronForwardOutline" class="stats__arrow" />
      </button>
      <button class="stats__card" data-accent="violet" @click="navigateTo('/tabs/workspace/characters')">
        <span class="stats__icon"><IonIcon :icon="peopleOutline" /></span>
        <span class="stats__value">{{ stats.characters }}</span>
        <span class="stats__label">{{ t('preview.charactersCount') }}</span>
        <IonIcon :icon="chevronForwardOutline" class="stats__arrow" />
      </button>
      <button class="stats__card" data-accent="teal" @click="navigateTo('/tabs/workspace/scenes')">
        <span class="stats__icon"><IonIcon :icon="imageOutline" /></span>
        <span class="stats__value">{{ stats.scenes }}</span>
        <span class="stats__label">{{ t('workspace.scenes') }}</span>
        <IonIcon :icon="chevronForwardOutline" class="stats__arrow" />
      </button>
    </nav>

    <!-- ═══════════ Recent Activity ═══════════ -->
    <section v-if="recentItems.length > 0" class="recent">
      <h3 class="section-label">
        <IonIcon :icon="timeOutline" />
        {{ t('dashboard.recentActivity') }}
      </h3>
      <div class="recent__track">
        <button
          v-for="item in recentItems"
          :key="item.id"
          class="recent__pill"
          @click="handleRecentClick(item)"
        >
          <span class="recent__emoji">{{ TYPE_ICON[item.type] || '📄' }}</span>
          <span class="recent__name">{{ item.label }}</span>
          <time class="recent__time">{{ formatRelativeTime(item.timestamp) }}</time>
        </button>
      </div>
    </section>

    <!-- ═══════════ Content Cards ═══════════ -->
    <section class="cards">
      <!-- World Setting -->
      <button class="card" :class="{ 'card--empty': !hasWorld }" data-accent="blue" @click="openFileInEditor('adv/world.md')">
        <div class="card__head">
          <span class="card__icon"><IonIcon :icon="globeOutline" /></span>
          <span class="card__title">{{ worldTitle }}</span>
        </div>
        <div v-if="worldSections.length > 0" class="card__chips">
          <span v-for="s in worldSections.slice(0, 4)" :key="s" class="chip">{{ s }}</span>
          <span v-if="worldSections.length > 4" class="chip chip--more">+{{ worldSections.length - 4 }}</span>
        </div>
        <span v-else class="card__empty-hint">
          <IonIcon :icon="addOutline" class="card__empty-icon" />
          {{ t('dashboard.clickToEdit') }}
        </span>
      </button>

      <!-- Story Outline -->
      <button class="card" :class="{ 'card--empty': !hasOutline }" data-accent="amber" @click="openFileInEditor('adv/outline.md')">
        <div class="card__head">
          <span class="card__icon"><IonIcon :icon="documentTextOutline" /></span>
          <span class="card__title">{{ outlineTitle }}</span>
        </div>
        <p v-if="outlinePreview" class="card__preview">
          {{ outlinePreview }}
        </p>
        <div v-if="outlineSections.length > 0" class="card__chips">
          <span v-for="s in outlineSections.slice(0, 4)" :key="s" class="chip">{{ s }}</span>
          <span v-if="outlineSections.length > 4" class="chip chip--more">+{{ outlineSections.length - 4 }}</span>
        </div>
        <span v-else-if="!outlinePreview" class="card__empty-hint">
          <IonIcon :icon="addOutline" class="card__empty-icon" />
          {{ t('dashboard.clickToEdit') }}
        </span>
      </button>

      <!-- Glossary -->
      <button class="card" :class="{ 'card--empty': !hasGlossary }" data-accent="rose" @click="openFileInEditor('adv/glossary.md')">
        <div class="card__head">
          <span class="card__icon"><IonIcon :icon="bulbOutline" /></span>
          <span class="card__title">{{ glossaryTitle }}</span>
        </div>
        <div v-if="glossarySections.length > 0" class="card__chips">
          <span v-for="s in glossarySections.slice(0, 6)" :key="s" class="chip">{{ s }}</span>
          <span v-if="glossarySections.length > 6" class="chip chip--more">+{{ glossarySections.length - 6 }}</span>
        </div>
        <span v-else class="card__empty-hint">
          <IonIcon :icon="addOutline" class="card__empty-icon" />
          {{ t('dashboard.clickToEdit') }}
        </span>
      </button>

      <!-- Knowledge Base -->
      <button class="card" :class="{ 'card--empty': stats.knowledge === 0 }" data-accent="emerald" @click="navigateTo('/tabs/workspace')">
        <div class="card__head">
          <span class="card__icon"><IonIcon :icon="libraryOutline" /></span>
          <span class="card__title">{{ t('dashboard.knowledgeBase') }}</span>
          <span v-if="stats.knowledge > 0" class="card__badge">{{ stats.knowledge }}</span>
        </div>
        <div v-if="knowledgeDomains.length > 0" class="card__chips">
          <span v-for="d in knowledgeDomains.slice(0, 5)" :key="d" class="chip">{{ d }}</span>
        </div>
        <span v-else class="card__empty-hint">
          <IonIcon :icon="addOutline" class="card__empty-icon" />
          {{ t('dashboard.noKnowledge') }}
        </span>
      </button>

      <!-- Audio (placeholder) -->
      <div class="card card--disabled" data-accent="violet">
        <div class="card__head">
          <span class="card__icon"><IonIcon :icon="musicalNotesOutline" /></span>
          <span class="card__title">{{ t('dashboard.audioAssets') }}</span>
        </div>
        <span class="card__empty-hint">{{ t('dashboard.comingSoon') }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ─── Accent Palette (data-accent tokens) ─── */
.overview {
  --accent-indigo: 99, 102, 241;
  --accent-violet: 139, 92, 246;
  --accent-teal: 20, 184, 166;
  --accent-blue: 59, 130, 246;
  --accent-amber: 245, 158, 11;
  --accent-rose: 244, 63, 94;
  --accent-emerald: 16, 185, 129;

  padding-bottom: var(--adv-space-lg);
}

[data-accent='indigo'] {
  --_a: var(--accent-indigo);
}
[data-accent='violet'] {
  --_a: var(--accent-violet);
}
[data-accent='teal'] {
  --_a: var(--accent-teal);
}
[data-accent='blue'] {
  --_a: var(--accent-blue);
}
[data-accent='amber'] {
  --_a: var(--accent-amber);
}
[data-accent='rose'] {
  --_a: var(--accent-rose);
}
[data-accent='emerald'] {
  --_a: var(--accent-emerald);
}

/* ─── Loading ─── */
.overview__loading {
  text-align: center;
  padding: var(--adv-space-lg);
  color: var(--adv-text-tertiary);
}

/* ─── Header ─── */
.overview__header {
  padding: var(--adv-space-md) var(--adv-space-md) 0;
}

.overview__title {
  font-size: 22px;
  font-weight: 800;
  color: var(--adv-text-primary);
  margin: 0 0 4px;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.overview__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ─── Stats Row ─── */
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: var(--adv-space-md);
}

.stats__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px 12px;
  border-radius: 14px;
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  transition:
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* Decorative top-bar — uses accent color */
.stats__card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgb(var(--_a));
  opacity: 0;
  transition: opacity 0.2s ease;
}

.stats__card:hover::before {
  opacity: 1;
}

.stats__card:hover {
  border-color: rgba(var(--_a), 0.3);
  box-shadow: 0 4px 16px rgba(var(--_a), 0.1);
}

.stats__card:active {
  transform: scale(0.96);
}

.stats__card:focus-visible {
  outline: 2px solid rgb(var(--_a));
  outline-offset: 2px;
}

.stats__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: rgba(var(--_a), 0.1);
  color: rgb(var(--_a));
}

.stats__value {
  font-size: 24px;
  font-weight: 800;
  color: var(--adv-text-primary);
  line-height: 1;
  letter-spacing: -0.03em;
}

.stats__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--adv-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats__arrow {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--adv-text-tertiary);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.stats__card:hover .stats__arrow {
  opacity: 0.6;
}

/* ─── Section Label ─── */
.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--adv-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 8px;
}

.section-label ion-icon {
  font-size: 14px;
}

/* ─── Recent Activity ─── */
.recent {
  padding: 0 var(--adv-space-md) var(--adv-space-md);
}

.recent__track {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.recent__track::-webkit-scrollbar {
  display: none;
}

.recent__pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 8px;
  border-radius: 20px;
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.12s ease;
}

.recent__pill:hover {
  border-color: rgba(var(--accent-indigo), 0.3);
  box-shadow: 0 2px 8px rgba(var(--accent-indigo), 0.08);
}

.recent__pill:active {
  transform: scale(0.96);
}

.recent__pill:focus-visible {
  outline: 2px solid rgb(var(--accent-indigo));
  outline-offset: 2px;
}

.recent__emoji {
  font-size: 14px;
  line-height: 1;
}

.recent__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--adv-text-primary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent__time {
  font-size: 10px;
  color: var(--adv-text-tertiary);
}

/* ─── Content Cards Grid ─── */
.cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 0 var(--adv-space-md) var(--adv-space-md);
}

.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  min-height: 88px;
}

.card:hover {
  border-color: rgba(var(--_a), 0.3);
  box-shadow: 0 4px 16px rgba(var(--_a), 0.08);
}

.card:active {
  transform: scale(0.97);
}

.card:focus-visible {
  outline: 2px solid rgb(var(--_a));
  outline-offset: 2px;
}

/* Empty card — dashed border, dim */
.card--empty {
  border-style: dashed;
  border-color: rgba(var(--_a), 0.2);
}

.card--empty:hover {
  border-color: rgba(var(--_a), 0.45);
  background: rgba(var(--_a), 0.02);
}

/* Disabled (placeholder) */
.card--disabled {
  cursor: default;
  opacity: 0.5;
  border-style: dashed;
}

.card--disabled:hover {
  border-color: var(--adv-border-subtle);
  box-shadow: none;
  background: var(--adv-surface-card);
}

.card--disabled:active {
  transform: none;
}

/* Card header */
.card__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card__icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
  background: rgba(var(--_a), 0.1);
  color: rgb(var(--_a));
}

.card__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--adv-text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 11px;
  background: rgba(var(--_a), 0.1);
  color: rgb(var(--_a));
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.card__preview {
  font-size: 12px;
  color: var(--adv-text-secondary);
  line-height: 1.55;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Chips */
.card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chip {
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(var(--_a), 0.08);
  color: rgb(var(--_a));
  white-space: nowrap;
}

.chip--more {
  background: transparent;
  color: var(--adv-text-tertiary);
  font-weight: 700;
  padding-left: 4px;
  padding-right: 4px;
}

/* Empty hint */
.card__empty-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(var(--_a), 0.6);
  font-weight: 500;
}

.card__empty-icon {
  font-size: 14px;
}

/* ─── Responsive ─── */
@media (max-width: 767px) {
  .stats {
    gap: 8px;
  }

  .stats__value {
    font-size: 20px;
  }

  .stats__label {
    font-size: 10px;
  }

  .cards {
    grid-template-columns: 1fr;
  }

  .card {
    min-height: 72px;
  }
}

/* ─── Reduced motion ─── */
@media (prefers-reduced-motion: reduce) {
  .stats__card,
  .card,
  .recent__pill,
  .stats__card::before {
    transition: none;
  }
}
</style>
