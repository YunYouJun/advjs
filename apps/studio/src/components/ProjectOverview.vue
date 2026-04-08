<script setup lang="ts">
import {
  IonIcon,
} from '@ionic/vue'
import {
  addOutline,
  bookOutline,
  brushOutline,
  bulbOutline,
  cubeOutline,
  documentTextOutline,
  globeOutline,
  imageOutline,
  libraryOutline,
  musicalNotesOutline,
  peopleOutline,
  settingsOutline,
  timeOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useProjectContent } from '../composables/useProjectContent'
import { useProjectDescription } from '../composables/useProjectDescription'
import { useStudioStore } from '../stores/useStudioStore'
import { useWorldEventStore } from '../stores/useWorldEventStore'
import ProjectSettingsModal from './ProjectSettingsModal.vue'
import RecentActivity from './RecentActivity.vue'
import StatsCard from './StatsCard.vue'

const { t } = useI18n()
const router = useRouter()
const studioStore = useStudioStore()
const showSettings = ref(false)

const {
  stats,
  isLoading,
  knowledgeBase,
} = useProjectContent()

const {
  worldMd,
  outlineMd,
  glossaryMd,
  propsMd,
  writingStyleMd,
  extractTitle,
  extractPreview,
  extractSections,
} = useProjectDescription()

const worldEventStore = useWorldEventStore()

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

const glossarySections = computed(() => extractSections(glossaryMd.value))

const propsSections = computed(() => extractSections(propsMd.value))

const styleTitle = computed(() => extractTitle(writingStyleMd.value) || t('dashboard.writingStyle'))
const styleSections = computed(() => extractSections(writingStyleMd.value))
const hasStyle = computed(() => writingStyleMd.value.trim().length > 0)

const timelineEvents = computed(() => worldEventStore.events.slice(-5).reverse())
const hasTimeline = computed(() => worldEventStore.events.length > 0)

const knowledgeDomains = computed(() => knowledgeBase.domains.value)

function navigateTo(path: string) {
  router.push(path)
}

function openFileInEditor(file: string) {
  router.push(`/editor?file=${encodeURIComponent(file)}`)
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
      <div class="overview__header-row">
        <h2 class="overview__title">
          {{ projectName }}
        </h2>
        <button class="overview__settings-btn" :title="t('projectSettings.title')" @click="showSettings = true">
          <IonIcon :icon="settingsOutline" />
        </button>
      </div>
      <p v-if="worldPreview" class="overview__desc">
        {{ worldPreview }}
      </p>
    </header>

    <!-- ═══════════ Stats Row ═══════════ -->
    <nav class="stats" aria-label="Resource navigation">
      <StatsCard
        accent="indigo"
        :icon="bookOutline"
        :value="stats.chapters"
        :label="t('preview.chaptersCount')"
        @click="navigateTo('/tabs/workspace/chapters')"
      />
      <StatsCard
        accent="violet"
        :icon="peopleOutline"
        :value="stats.characters"
        :label="t('preview.charactersCount')"
        @click="navigateTo('/tabs/workspace/characters')"
      />
      <StatsCard
        accent="teal"
        :icon="imageOutline"
        :value="stats.scenes"
        :label="t('workspace.scenes')"
        @click="navigateTo('/tabs/workspace/scenes')"
      />
      <StatsCard
        accent="orange"
        :icon="cubeOutline"
        :value="propsSections.length"
        :label="t('dashboard.props')"
        @click="openFileInEditor('adv/props.md')"
      />
      <StatsCard
        accent="rose"
        :icon="bulbOutline"
        :value="glossarySections.length"
        :label="t('dashboard.glossary')"
        @click="openFileInEditor('adv/glossary.md')"
      />
    </nav>

    <!-- ═══════════ Recent Activity ═══════════ -->
    <RecentActivity />

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

      <!-- Writing Style -->
      <button class="card" :class="{ 'card--empty': !hasStyle }" data-accent="pink" @click="openFileInEditor('adv/writing-style.md')">
        <div class="card__head">
          <span class="card__icon"><IonIcon :icon="brushOutline" /></span>
          <span class="card__title">{{ styleTitle }}</span>
        </div>
        <div v-if="styleSections.length > 0" class="card__chips">
          <span v-for="s in styleSections.slice(0, 6)" :key="s" class="chip">{{ s }}</span>
          <span v-if="styleSections.length > 6" class="chip chip--more">+{{ styleSections.length - 6 }}</span>
        </div>
        <span v-else class="card__empty-hint">
          <IonIcon :icon="addOutline" class="card__empty-icon" />
          {{ t('dashboard.clickToEdit') }}
        </span>
      </button>

      <!-- Timeline -->
      <button class="card" :class="{ 'card--empty': !hasTimeline }" data-accent="cyan" @click="navigateTo('/tabs/world')">
        <div class="card__head">
          <span class="card__icon"><IonIcon :icon="timeOutline" /></span>
          <span class="card__title">{{ t('dashboard.timeline') }}</span>
          <span v-if="worldEventStore.events.length > 0" class="card__badge">{{ worldEventStore.events.length }}</span>
        </div>
        <div v-if="timelineEvents.length > 0" class="card__timeline">
          <div v-for="evt in timelineEvents.slice(0, 3)" :key="evt.id" class="card__timeline-item">
            <span class="card__timeline-dot" />
            <span class="card__timeline-text">{{ evt.summary }}</span>
          </div>
          <span v-if="worldEventStore.events.length > 3" class="card__timeline-more">
            {{ t('dashboard.viewAll') }}
          </span>
        </div>
        <span v-else class="card__empty-hint">
          <IonIcon :icon="addOutline" class="card__empty-icon" />
          {{ t('dashboard.noTimeline') }}
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

    <!-- Project Settings Modal -->
    <ProjectSettingsModal :open="showSettings" @close="showSettings = false" />
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
  --accent-orange: 249, 115, 22;
  --accent-pink: 236, 72, 153;
  --accent-cyan: 6, 182, 212;

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
[data-accent='orange'] {
  --_a: var(--accent-orange);
}
[data-accent='pink'] {
  --_a: var(--accent-pink);
}
[data-accent='cyan'] {
  --_a: var(--accent-cyan);
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

.overview__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-sm);
}

.overview__title {
  font-size: 22px;
  font-weight: 800;
  color: var(--adv-text-primary);
  margin: 0 0 4px;
  line-height: 1.25;
  letter-spacing: -0.02em;
  flex: 1;
  min-width: 0;
}

.overview__settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  color: var(--adv-text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  font-size: 18px;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.overview__settings-btn:hover {
  color: var(--adv-text-primary);
  border-color: rgba(var(--accent-indigo), 0.3);
  background: rgba(var(--accent-indigo), 0.06);
}

.overview__settings-btn:active {
  transform: scale(0.92);
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

/* Timeline items */
.card__timeline {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card__timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.card__timeline-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--_a));
  flex-shrink: 0;
  margin-top: 5px;
}

.card__timeline-text {
  font-size: 11px;
  color: var(--adv-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card__timeline-more {
  font-size: 11px;
  color: rgba(var(--_a), 0.7);
  font-weight: 500;
}

/* ─── Responsive ─── */
@media (max-width: 767px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  /* On mobile, all stats cards span 1 col */
  .stats :deep(.stats__card:nth-child(-n + 3)),
  .stats :deep(.stats__card:nth-child(n + 4)) {
    grid-column: span 1;
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
  .card {
    transition: none;
  }
}
</style>
