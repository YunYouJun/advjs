<script setup lang="ts">
import type { WorldEvent } from '@advjs/types'
import type { CharacterDiaryEntry } from '../stores/useCharacterDiaryStore'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import CreateGroupChatModal from '../components/CreateGroupChatModal.vue'
import RelationshipGraph from '../components/RelationshipGraph.vue'
import SelectPlayerCharacterModal from '../components/SelectPlayerCharacterModal.vue'
import StudioPage from '../components/StudioPage.vue'
import ViewModeSwitcher from '../components/ViewModeSwitcher.vue'
import WorldTimeline from '../components/WorldTimeline.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useResponsive } from '../composables/useResponsive'
import { useWorldContext } from '../composables/useWorldContext'
import { useCharacterDiaryStore } from '../stores/useCharacterDiaryStore'
import { useGroupChatStore } from '../stores/useGroupChatStore'
import { useStudioStore } from '../stores/useStudioStore'
import { useViewModeStore } from '../stores/useViewModeStore'
import { useWorldClockStore } from '../stores/useWorldClockStore'
import { useWorldEventStore } from '../stores/useWorldEventStore'
import '../styles/group-chat.css'
import '../styles/player-character.css'
import '../styles/world.css'

const { t } = useI18n()
const router = useRouter()
const studioStore = useStudioStore()
const clockStore = useWorldClockStore()
const eventStore = useWorldEventStore()
const groupChatStore = useGroupChatStore()
const diaryStore = useCharacterDiaryStore()
const { characters, isLoading } = useProjectContent()
const { worldContext } = useWorldContext()
const { isDesktop } = useResponsive()

const viewModeStore = useViewModeStore()

const hasProject = computed(() => !!studioStore.currentProject)
const showEvents = ref(true)
const showGraph = ref(false)
const showCreateGroupModal = ref(false)
const showSelectPlayerModal = ref(false)
const timelineView = ref<'list' | 'timeline'>('list')

const groupRooms = computed(() => groupChatStore.listRooms())

const recentEvents = computed(() => eventStore.getRecentEvents(5))

const EVENT_TYPE_EMOJI: Record<string, string> = {
  daily: '🔵',
  social: '🟢',
  unexpected: '🟠',
  weather: '🌤️',
  manual: '📝',
}

// Register clock advance listener to trigger event generation
const autoDiaryInProgress = ref(false)

async function onClockAdvance(dateChanged: boolean) {
  const weather = await eventStore.generateEvents(
    worldContext.value,
    characters.value,
    clockStore.clock,
    dateChanged,
  )
  if (typeof weather === 'string')
    clockStore.setWeather(weather)
  if (dateChanged && characters.value.length > 0) {
    autoDiaryInProgress.value = true
    await Promise.all(characters.value.map(char => diaryStore.generateDiary(char)))
    autoDiaryInProgress.value = false
  }
}

onMounted(() => {
  clockStore.onAdvance(onClockAdvance)
})

onUnmounted(() => {
  clockStore.offAdvance(onClockAdvance)
})

onMounted(() => {
  if (!studioStore.currentProject)
    studioStore.autoRestoreLastProject()
})

function openCharacterChat(character: { id: string }) {
  router.push(`/tabs/world/chat/${character.id}`)
}

function openGroupChat(roomId: string) {
  router.push(`/tabs/world/group/${roomId}`)
}

function getParticipantCount(room: { participantIds: string[] }): number {
  return room.participantIds.length
}

function toggleClock() {
  if (clockStore.clock.running)
    clockStore.pause()
  else
    clockStore.start()
}

function handleAdvanceTime() {
  clockStore.advanceTime()
}

/**
 * In character mode, filter out the player character from the NPC list.
 */
const displayCharacters = computed(() => {
  if (viewModeStore.mode === 'character' && viewModeStore.playerCharacterId) {
    return characters.value.filter(c => c.id !== viewModeStore.playerCharacterId)
  }
  return characters.value
})

// --- Timeline ---

export interface TimelineEntry {
  id: string
  kind: 'event' | 'diary'
  date: string
  period: string
  characterId?: string
  characterIds?: string[]
  summary: string
  type?: string
  mood?: string
  createdAt: number
  source: WorldEvent | CharacterDiaryEntry
  /** Full diary content (only present when kind === 'diary') */
  diaryContent?: string
}

const PERIOD_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
}

const timelineEntries = computed<TimelineEntry[]>(() => {
  const events: TimelineEntry[] = eventStore.events.map(e => ({
    id: e.id,
    kind: 'event' as const,
    date: e.date,
    period: e.period,
    characterId: e.characterIds?.[0],
    characterIds: e.characterIds,
    summary: e.summary,
    type: e.type,
    createdAt: e.timestamp,
    source: e,
  }))

  const diaries: TimelineEntry[] = []
  for (const [, list] of diaryStore.diaries) {
    for (const d of list) {
      diaries.push({
        id: d.id,
        kind: 'diary' as const,
        date: d.date,
        period: d.period,
        characterId: d.characterId,
        characterIds: [d.characterId],
        summary: d.content.slice(0, 80) + (d.content.length > 80 ? '…' : ''),
        mood: d.mood,
        createdAt: d.createdAt,
        source: d,
        diaryContent: d.content,
      })
    }
  }

  return [...events, ...diaries].sort((a, b) => {
    if (a.date !== b.date)
      return a.date.localeCompare(b.date)
    const pa = PERIOD_ORDER[a.period] ?? 99
    const pb = PERIOD_ORDER[b.period] ?? 99
    if (pa !== pb)
      return pa - pb
    return a.createdAt - b.createdAt
  })
})
</script>

<template>
  <StudioPage :title="t('world.title')">
    <!-- No project state -->
    <div v-if="!hasProject" class="world-empty">
      <div class="world-empty__icon">
        🌍
      </div>
      <h3 class="world-empty__title">
        {{ t('world.noProjectTitle') }}
      </h3>
      <p class="world-empty__desc">
        {{ t('world.noProjectDesc') }}
      </p>
    </div>

    <!-- Loading -->
    <div v-else-if="isLoading" class="world-loading">
      <p>{{ t('world.loading') }}</p>
    </div>

    <!-- No characters -->
    <div v-else-if="characters.length === 0" class="world-empty">
      <div class="world-empty__icon">
        👤
      </div>
      <h3 class="world-empty__title">
        {{ t('world.noCharacters') }}
      </h3>
      <p class="world-empty__desc">
        {{ t('world.noCharactersDesc') }}
      </p>
    </div>

    <!-- Main content with clock + events + characters -->
    <div v-else class="world-main" :class="[{ 'world-main--desktop': isDesktop }]">
      <!-- Desktop: Left sidebar with character list -->
      <aside v-if="isDesktop" class="world-sidebar" role="navigation" :aria-label="t('world.viewAllCharacters')">
        <div class="world-sidebar__header">
          👥 {{ t('world.viewAllCharacters') }}
        </div>
        <div class="world-sidebar__list" role="list">
          <button
            v-for="char in displayCharacters"
            :key="char.id"
            class="world-sidebar__char"
            role="listitem"
            :aria-label="char.name"
            @click="openCharacterChat(char)"
          >
            <span class="world-sidebar__avatar">{{ char.name?.slice(0, 2) || '?' }}</span>
            <span class="world-sidebar__info">
              <span class="world-sidebar__name">{{ char.name }}</span>
              <span v-if="char.faction" class="world-sidebar__faction">{{ char.faction }}</span>
            </span>
          </button>
        </div>
      </aside>

      <!-- Right content (or full-width on mobile) -->
      <div class="world-content">
        <!-- World Clock Bar -->
        <div class="world-clock-bar">
          <div class="world-clock-info">
            <span class="world-clock-date">📅 {{ clockStore.clock.date }}</span>
            <span class="world-clock-period">{{ clockStore.getPeriodEmoji() }} {{ clockStore.getPeriodLabel() }}</span>
            <span v-if="clockStore.clock.weather" class="world-clock-weather">☁️ {{ clockStore.clock.weather }}</span>
          </div>
          <div class="world-clock-controls">
            <button
              class="world-clock-btn"
              :title="clockStore.clock.running ? t('world.pauseClock') : t('world.startClock')"
              @click="toggleClock"
            >
              {{ clockStore.clock.running ? '⏸️' : '▶️' }}
            </button>
            <button
              class="world-clock-btn"
              :disabled="eventStore.isGenerating"
              :title="t('world.advanceTime')"
              @click="handleAdvanceTime"
            >
              ⏭️
            </button>
            <span v-if="autoDiaryInProgress" class="world-auto-diary-hint">
              {{ t('world.autoDiaryGenerating') }}
            </span>
          </div>
        </div>

        <!-- View Mode Switcher -->
        <ViewModeSwitcher />

        <!-- Player Character Section (character mode only) -->
        <div v-if="viewModeStore.mode === 'character'" class="player-character-section">
          <!-- Has player character -->
          <div v-if="viewModeStore.playerCharacter" class="player-character-card">
            <div class="player-character-card__avatar">
              {{ viewModeStore.playerCharacter.name?.slice(0, 2) || '?' }}
            </div>
            <div class="player-character-card__info">
              <div class="player-character-card__label">
                🎮 {{ t('world.currentlyPlaying') }}
              </div>
              <div class="player-character-card__name">
                {{ viewModeStore.playerCharacter.name }}
              </div>
              <div v-if="viewModeStore.playerCharacter.personality" class="player-character-card__personality">
                {{ viewModeStore.playerCharacter.personality.slice(0, 60) }}{{ viewModeStore.playerCharacter.personality.length > 60 ? '...' : '' }}
              </div>
            </div>
            <button class="player-character-card__action" @click="showSelectPlayerModal = true">
              {{ t('world.changeCharacter') }}
            </button>
          </div>

          <!-- No player character yet -->
          <button v-else class="player-select-prompt" @click="showSelectPlayerModal = true">
            <span>🎭</span>
            <span class="player-select-prompt__text">{{ t('world.selectPlayerCharacter') }}</span>
          </button>
        </div>

        <!-- World Events Feed -->
        <div class="world-events-section">
          <div class="world-events-header-row">
            <button
              class="world-events-header"
              @click="showEvents = !showEvents"
            >
              <span>🌍 {{ t('world.worldDynamics') }}</span>
              <span class="world-events-toggle">{{ showEvents ? '▼' : '▶' }}</span>
            </button>
            <div v-if="showEvents" class="world-events-view-switch">
              <button
                class="world-view-btn"
                :class="{ active: timelineView === 'list' }"
                @click="timelineView = 'list'"
              >
                {{ t('world.timelineList') }}
              </button>
              <button
                class="world-view-btn"
                :class="{ active: timelineView === 'timeline' }"
                @click="timelineView = 'timeline'"
              >
                {{ t('world.timeline') }}
              </button>
            </div>
          </div>

          <div v-if="showEvents">
            <!-- List view (original) -->
            <div v-if="timelineView === 'list'" class="world-events-list">
              <div v-if="eventStore.isGenerating" class="world-events-loading">
                {{ t('world.generatingEvents') }}
              </div>
              <div v-else-if="recentEvents.length === 0" class="world-events-empty">
                {{ t('world.noEvents') }}
              </div>
              <div
                v-for="event in recentEvents"
                :key="event.id"
                class="world-event-item"
              >
                <span class="world-event-icon">{{ EVENT_TYPE_EMOJI[event.type] || '🔵' }}</span>
                <span class="world-event-summary">{{ event.summary }}</span>
              </div>
            </div>

            <!-- Timeline view -->
            <WorldTimeline
              v-else
              :entries="timelineEntries"
              :characters="displayCharacters"
              @select-character="(id: string) => openCharacterChat({ id })"
            />
          </div>
        </div>

        <!-- Group Chats Section -->
        <div class="group-chats-section">
          <div class="group-chats-header">
            <span>💬 {{ t('world.groupChats') }}</span>
            <button
              class="group-chats-create-btn"
              :title="t('world.createGroupChat')"
              @click="showCreateGroupModal = true"
            >
              +
            </button>
          </div>

          <div v-if="groupRooms.length > 0" class="group-chats-list">
            <div
              v-for="room in groupRooms"
              :key="room.id"
              class="group-chat-item"
              @click="openGroupChat(room.id)"
            >
              <span class="group-chat-item-icon">🗨️</span>
              <div class="group-chat-item-info">
                <div class="group-chat-item-name">
                  {{ room.name }}
                </div>
                <div class="group-chat-item-count">
                  {{ t('world.participants', { count: getParticipantCount(room) }) }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="group-chats-empty">
            {{ t('world.noGroupChats') }}
          </div>
        </div>

        <!-- Relationship Graph Toggle + Graph -->
        <div v-if="displayCharacters.length > 1" class="world-graph-section">
          <button
            class="world-graph-toggle"
            @click="showGraph = !showGraph"
          >
            <span>🔗 {{ showGraph ? t('world.hideGraph') : t('world.showGraph') }}</span>
            <span class="world-events-toggle">{{ showGraph ? '▼' : '▶' }}</span>
          </button>
          <Transition name="fade">
            <RelationshipGraph
              v-if="showGraph"
              :characters="displayCharacters"
              @select-character="(id: string) => openCharacterChat({ id })"
            />
          </Transition>
        </div>

        <!-- Quick link to characters page (mobile only) -->
        <div v-if="!isDesktop" class="world-characters-link">
          <button class="world-characters-link-btn" @click="router.push('/tabs/workspace/characters')">
            👥 {{ t('world.viewAllCharacters') }}
            <span class="world-characters-link-arrow">→</span>
          </button>
        </div>
      </div><!-- .world-content -->
    </div>

    <!-- Create Group Chat Modal -->
    <CreateGroupChatModal
      :is-open="showCreateGroupModal"
      :characters="characters"
      @close="showCreateGroupModal = false"
    />

    <!-- Select Player Character Modal -->
    <SelectPlayerCharacterModal
      :is-open="showSelectPlayerModal"
      @close="showSelectPlayerModal = false"
    />
  </StudioPage>
</template>

<style scoped>
/* World Clock Bar */
.world-clock-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--adv-space-sm) var(--adv-space-md);
  margin: var(--adv-space-sm) var(--adv-space-md) 0;
  background: var(--adv-surface-card, #fff);
  border-radius: var(--adv-radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

:root.dark .world-clock-bar {
  background: var(--adv-surface-card, #1e1e2e);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.world-clock-info {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm, 8px);
  flex-wrap: wrap;
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-primary);
}

.world-clock-date {
  font-weight: 600;
}

.world-clock-period {
  color: var(--adv-text-secondary);
}

.world-clock-weather {
  color: var(--adv-text-tertiary, #94a3b8);
}

.world-clock-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.world-auto-diary-hint {
  font-size: var(--adv-font-caption, 11px);
  color: #8b5cf6;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

.world-clock-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--adv-surface-elevated, #f1f5f9);
  border-radius: var(--adv-radius-md, 8px);
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.world-clock-btn:hover {
  background: var(--adv-surface-hover, #e2e8f0);
}

.world-clock-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

:root.dark .world-clock-btn {
  background: var(--adv-surface-elevated, #2a2a3e);
}

:root.dark .world-clock-btn:hover {
  background: var(--adv-surface-hover, #3a3a4e);
}

/* World Events Section */
.world-events-section {
  margin: var(--adv-space-sm) var(--adv-space-md);
  background: var(--adv-surface-card, #fff);
  border-radius: var(--adv-radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

:root.dark .world-events-section {
  background: var(--adv-surface-card, #1e1e2e);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.world-events-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: var(--adv-space-sm);
}

.world-events-header-row .world-events-header {
  flex: 1;
}

.world-events-view-switch {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.world-view-btn {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--adv-border-subtle, #e2e8f0);
  background: var(--adv-surface-elevated, #f8fafc);
  color: var(--adv-text-tertiary, #94a3b8);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.world-view-btn:hover {
  border-color: rgba(139, 92, 246, 0.4);
  color: var(--adv-text-primary);
}

.world-view-btn.active {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.4);
  color: #8b5cf6;
  font-weight: 600;
}

:root.dark .world-view-btn {
  background: var(--adv-surface-elevated, #252536);
  border-color: rgba(255, 255, 255, 0.08);
}

:root.dark .world-view-btn.active {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
  color: #a78bfa;
}

.world-events-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border: none;
  background: none;
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  cursor: pointer;
}

.world-events-toggle {
  font-size: 10px;
  color: var(--adv-text-tertiary, #94a3b8);
}

.world-events-list {
  padding: 0 var(--adv-space-md) var(--adv-space-sm);
}

.world-events-loading,
.world-events-empty {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary, #94a3b8);
  padding: var(--adv-space-xs) 0;
}

.world-event-item {
  display: flex;
  align-items: flex-start;
  gap: var(--adv-space-xs, 4px);
  padding: 3px 0;
  font-size: var(--adv-font-body-sm, 13px);
  color: var(--adv-text-secondary);
}

.world-event-icon {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1.5;
}

.world-event-summary {
  line-height: 1.5;
}

/* Relationship Graph Section */
.world-graph-section {
  margin: var(--adv-space-sm) var(--adv-space-md);
  background: var(--adv-surface-card, #fff);
  border-radius: var(--adv-radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

:root.dark .world-graph-section {
  background: var(--adv-surface-card, #1e1e2e);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.world-graph-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--adv-space-sm) var(--adv-space-md);
  border: none;
  background: none;
  color: var(--adv-text-primary);
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  cursor: pointer;
}

/* Fade transition for graph */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Desktop dual-pane layout ── */
.world-main--desktop {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 0;
  height: 100%;
}

.world-sidebar {
  border-right: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.08));
  overflow-y: auto;
  padding: var(--adv-space-sm) 0;
}

:root.dark .world-sidebar {
  border-right-color: rgba(255, 255, 255, 0.06);
}

.world-sidebar__header {
  padding: var(--adv-space-sm) var(--adv-space-md);
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 600;
  color: var(--adv-text-secondary);
}

.world-sidebar__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 var(--adv-space-xs);
}

.world-sidebar__char {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md);
  border: none;
  background: transparent;
  border-radius: var(--adv-radius-md, 8px);
  cursor: pointer;
  text-align: left;
  min-height: 48px;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.world-sidebar__char:hover {
  background: var(--adv-surface-elevated, #f5f5f5);
}

:root.dark .world-sidebar__char:hover {
  background: var(--adv-surface-elevated, #2a2a3e);
}

.world-sidebar__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--adv-gradient-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.world-sidebar__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.world-sidebar__name {
  font-size: var(--adv-font-body-sm, 13px);
  font-weight: 500;
  color: var(--adv-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.world-sidebar__faction {
  font-size: var(--adv-font-caption, 11px);
  color: var(--adv-text-tertiary);
}

.world-content {
  overflow-y: auto;
}
</style>
