<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { TimelineEntry } from '../views/WorldPage.vue'
import type { TimelineFilter } from './TimelineFilter.vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCharacterInitials, getValidAvatarUrl } from '../utils/chatUtils'
import DiaryEntryContent from './DiaryEntryContent.vue'
import TimelineFilterComponent from './TimelineFilter.vue'

const props = defineProps<{
  entries: TimelineEntry[]
  characters: AdvCharacter[]
}>()

const emit = defineEmits<{
  selectCharacter: [characterId: string]
}>()

const { t } = useI18n()

const PAGE_SIZE = 60

// --- Filter state (internal) ---

const filter = ref<TimelineFilter>({ kinds: [], characterIds: [], eventTypes: [] })
const displayLimit = ref(PAGE_SIZE)

// Reset pagination when filter changes
watch(filter, () => {
  displayLimit.value = PAGE_SIZE
}, { deep: true })

// --- Character lookup ---

const characterMap = computed<Map<string, AdvCharacter>>(() => {
  const m = new Map<string, AdvCharacter>()
  for (const c of props.characters)
    m.set(c.id, c)
  return m
})

// --- Available event types from current entries ---

const availableEventTypes = computed<string[]>(() =>
  [...new Set(props.entries.filter(e => e.kind === 'event' && e.type).map(e => e.type!))],
)

// --- Filtering ---

const filteredEntries = computed<TimelineEntry[]>(() => {
  return props.entries.filter((e) => {
    if (filter.value.kinds.length && !filter.value.kinds.includes(e.kind))
      return false
    if (filter.value.characterIds.length) {
      const ids = e.characterIds ?? (e.characterId ? [e.characterId] : [])
      if (!filter.value.characterIds.some(id => ids.includes(id)))
        return false
    }
    if (filter.value.eventTypes.length && e.kind === 'event') {
      if (!filter.value.eventTypes.includes(e.type!))
        return false
    }
    return true
  })
})

// --- Grouping helpers ---

const PERIOD_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
}

const PERIOD_EMOJI: Record<string, string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌆',
  night: '🌙',
}

interface PeriodGroup { period: string, entries: TimelineEntry[] }
interface DateGroup { date: string, periods: PeriodGroup[] }

function buildGroups(entries: TimelineEntry[]): DateGroup[] {
  // Show newest first
  const sorted = [...entries].reverse()
  const dateMap = new Map<string, Map<string, TimelineEntry[]>>()
  for (const e of sorted) {
    if (!dateMap.has(e.date))
      dateMap.set(e.date, new Map())
    const pm = dateMap.get(e.date)!
    if (!pm.has(e.period))
      pm.set(e.period, [])
    pm.get(e.period)!.push(e)
  }
  return Array.from(dateMap.entries(), ([date, pm]) => ({
    date,
    periods: Array.from(pm.entries(), ([period, entries]) => ({ period, entries }))
      .sort((a, b) => (PERIOD_ORDER[a.period] ?? 99) - (PERIOD_ORDER[b.period] ?? 99)),
  }))
}

// --- Pagination ---

const pagedEntries = computed<TimelineEntry[]>(() =>
  filteredEntries.value.slice(-displayLimit.value),
)

const pagedGroups = computed<DateGroup[]>(() => buildGroups(pagedEntries.value))

const hasMore = computed(() => filteredEntries.value.length > displayLimit.value)

const hiddenCount = computed(() =>
  Math.max(0, filteredEntries.value.length - displayLimit.value),
)

function loadMore() {
  displayLimit.value += PAGE_SIZE
}

// --- Event type emoji ---

const EVENT_TYPE_EMOJI: Record<string, string> = {
  daily: '🔵',
  social: '🟢',
  unexpected: '🟠',
  weather: '🌤️',
  manual: '📝',
}
</script>

<template>
  <div class="wt">
    <!-- Filter bar -->
    <TimelineFilterComponent
      v-model="filter"
      :characters="characters"
      :available-event-types="availableEventTypes"
    />

    <!-- Load more (top, shows hidden older entries) -->
    <div v-if="hasMore" class="wt-load-more">
      <button class="wt-load-more-btn" @click="loadMore">
        {{ t('world.timelineLoadMore', { count: hiddenCount }) }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="filteredEntries.length === 0" class="wt-empty">
      {{ t('world.timelineEmpty') }}
    </div>

    <!-- Timeline groups -->
    <div v-else class="wt-groups">
      <div v-for="group in pagedGroups" :key="group.date" class="wt-date-group">
        <!-- Date header -->
        <div class="wt-date-label">
          📅 {{ group.date }}
        </div>

        <!-- Period sub-sections -->
        <div v-for="pg in group.periods" :key="pg.period" class="wt-period-section">
          <div class="wt-period-label">
            {{ PERIOD_EMOJI[pg.period] || '🕐' }} {{ t(`world.period_${pg.period}`, pg.period) }}
          </div>

          <!-- Entries -->
          <div class="wt-entries">
            <div
              v-for="entry in pg.entries"
              :key="entry.id"
              class="wt-entry"
              :class="[`wt-entry--${entry.kind}`]"
            >
              <!-- Axis dot -->
              <div class="wt-dot" />

              <!-- Card -->
              <div class="wt-card">
                <!-- Event card -->
                <template v-if="entry.kind === 'event'">
                  <div class="wt-card__header">
                    <span class="wt-event-icon">{{ EVENT_TYPE_EMOJI[entry.type!] || '🔵' }}</span>
                    <span class="wt-event-type">{{ entry.type }}</span>
                    <!-- Involved characters -->
                    <div v-if="entry.characterIds?.length" class="wt-avatars">
                      <button
                        v-for="cid in entry.characterIds.slice(0, 4)"
                        :key="cid"
                        class="wt-avatar-btn"
                        :title="characterMap.get(cid)?.name || cid"
                        @click="emit('selectCharacter', cid)"
                      >
                        <img
                          v-if="getValidAvatarUrl(characterMap.get(cid)?.avatar)"
                          :src="getValidAvatarUrl(characterMap.get(cid)?.avatar)"
                          class="wt-avatar"
                          alt=""
                        >
                        <span v-else class="wt-avatar wt-avatar--initials">
                          {{ getCharacterInitials(characterMap.get(cid)?.name) }}
                        </span>
                      </button>
                    </div>
                  </div>
                  <p class="wt-card__body">
                    {{ entry.summary }}
                  </p>
                </template>

                <!-- Diary card -->
                <template v-else>
                  <div class="wt-card__header">
                    <span class="wt-diary-icon">📓</span>
                    <button
                      v-if="entry.characterId"
                      class="wt-avatar-btn"
                      :title="characterMap.get(entry.characterId)?.name || entry.characterId"
                      @click="emit('selectCharacter', entry.characterId)"
                    >
                      <img
                        v-if="getValidAvatarUrl(characterMap.get(entry.characterId)?.avatar)"
                        :src="getValidAvatarUrl(characterMap.get(entry.characterId)?.avatar)"
                        class="wt-avatar"
                        alt=""
                      >
                      <span v-else class="wt-avatar wt-avatar--initials">
                        {{ getCharacterInitials(characterMap.get(entry.characterId)?.name) }}
                      </span>
                    </button>
                    <span class="wt-diary-name">
                      {{ characterMap.get(entry.characterId || '')?.name || entry.characterId }}
                    </span>
                    <span v-if="entry.mood" class="wt-diary-mood">{{ entry.mood }}</span>
                  </div>
                  <p class="wt-card__body">
                    <DiaryEntryContent :content="entry.diaryContent ?? entry.summary" :max-length="80" />
                  </p>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wt {
  width: 100%;
}

/* Load more */
.wt-load-more {
  text-align: center;
  padding: var(--adv-space-xs) var(--adv-space-md);
}

.wt-load-more-btn {
  border: none;
  background: none;
  color: #8b5cf6;
  font-size: var(--adv-font-caption, 11px);
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.wt-load-more-btn:hover {
  background: rgba(139, 92, 246, 0.06);
}

/* Empty state */
.wt-empty {
  text-align: center;
  padding: var(--adv-space-md) var(--adv-space-md);
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-tertiary, #94a3b8);
}

/* Groups */
.wt-groups {
  padding: 0 var(--adv-space-md) var(--adv-space-sm);
}

.wt-date-group {
  margin-top: var(--adv-space-sm);
}

.wt-date-label {
  font-size: var(--adv-font-caption, 11px);
  font-weight: 700;
  color: var(--adv-text-primary);
  padding: 4px 0 6px;
  position: sticky;
  top: 0;
  background: var(--adv-surface-card, #fff);
  z-index: 1;
}

:root.dark .wt-date-label {
  background: var(--adv-surface-card, #1e1e2e);
}

.wt-period-section {
  margin-bottom: var(--adv-space-xs);
}

.wt-period-label {
  font-size: 10px;
  color: var(--adv-text-tertiary, #94a3b8);
  padding: 2px 0 4px 24px;
}

/* Entries list with left axis */
.wt-entries {
  border-left: 2px solid var(--adv-border-subtle, #e2e8f0);
  margin-left: 8px;
  padding-left: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
}

:root.dark .wt-entries {
  border-left-color: rgba(255, 255, 255, 0.08);
}

/* Each entry row */
.wt-entry {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  position: relative;
}

/* Axis dot */
.wt-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--adv-primary, #8b5cf6);
  flex-shrink: 0;
  margin-top: 6px;
  margin-left: -5px;
}

.wt-entry--diary .wt-dot {
  background: #a78bfa;
}

/* Card */
.wt-card {
  flex: 1;
  min-width: 0;
  background: var(--adv-surface-elevated, #f8fafc);
  border-radius: var(--adv-radius-md, 8px);
  padding: var(--adv-space-xs) var(--adv-space-sm);
}

:root.dark .wt-card {
  background: var(--adv-surface-elevated, #252536);
}

.wt-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.wt-event-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.wt-event-type {
  font-size: 10px;
  color: var(--adv-text-tertiary, #94a3b8);
  text-transform: capitalize;
}

.wt-diary-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.wt-diary-name {
  font-size: var(--adv-font-caption, 11px);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.wt-diary-mood {
  font-size: 10px;
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
  padding: 1px 6px;
  border-radius: 999px;
}

.wt-card__body {
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-secondary);
  line-height: 1.5;
  margin: 0;
}

/* Avatars */
.wt-avatars {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.wt-avatar-btn {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  border-radius: 50%;
}

.wt-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.wt-avatar--initials {
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
  font-size: 8px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
