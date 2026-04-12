<script setup lang="ts">
import type { TimelineEntry } from '../types/timeline'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import LayoutPage from '../components/common/LayoutPage.vue'
import CreateGroupChatModal from '../components/CreateGroupChatModal.vue'
import GroupChatsSection from '../components/GroupChatsSection.vue'
import SelectPlayerCharacterModal from '../components/SelectPlayerCharacterModal.vue'
import ViewModeSwitcher from '../components/ViewModeSwitcher.vue'
import WorldClockBar from '../components/WorldClockBar.vue'
import WorldEventsSection from '../components/WorldEventsSection.vue'
import WorldGraphSection from '../components/WorldGraphSection.vue'
import WorldSidebar from '../components/WorldSidebar.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useResponsive } from '../composables/useResponsive'
import { useWorldContext } from '../composables/useWorldContext'
import { useCharacterDiaryStore } from '../stores/useCharacterDiaryStore'
import { useStudioStore } from '../stores/useStudioStore'
import { useViewModeStore } from '../stores/useViewModeStore'
import { useWorldClockStore } from '../stores/useWorldClockStore'
import { useWorldEventStore } from '../stores/useWorldEventStore'
import { PERIOD_ORDER } from '../types/timeline'
import '../styles/group-chat.css'
import '../styles/player-character.css'
import '../styles/world.css'

const { t } = useI18n()
const router = useRouter()
const studioStore = useStudioStore()
const clockStore = useWorldClockStore()
const eventStore = useWorldEventStore()
const diaryStore = useCharacterDiaryStore()
const { characters, isLoading } = useProjectContent()
const { worldContext } = useWorldContext()
const { isDesktop } = useResponsive()
const viewModeStore = useViewModeStore()

const hasProject = computed(() => !!studioStore.currentProject)
const showCreateGroupModal = ref(false)
const showSelectPlayerModal = ref(false)

const recentEvents = computed(() => eventStore.getRecentEvents(5))

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

/**
 * In character mode, filter out the player character from the NPC list.
 */
const displayCharacters = computed(() => {
  if (viewModeStore.mode === 'character' && viewModeStore.playerCharacterId) {
    return characters.value.filter(c => c.id !== viewModeStore.playerCharacterId)
  }
  return characters.value
})

// --- Timeline entries ---

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
  <LayoutPage :title="t('world.title')">
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
      <span class="world-loading__spinner">⏳</span>
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
      <WorldSidebar
        v-if="isDesktop"
        :characters="displayCharacters"
        @select-character="openCharacterChat"
      />

      <!-- Right content (or full-width on mobile) -->
      <div class="world-content">
        <WorldClockBar
          :auto-diary-in-progress="autoDiaryInProgress"
          @advance-time="clockStore.advanceTime()"
        />

        <ViewModeSwitcher />

        <!-- Player Character Section (character mode only) -->
        <div v-if="viewModeStore.mode === 'character'" class="player-character-section">
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

          <button v-else class="player-select-prompt" @click="showSelectPlayerModal = true">
            <span>🎭</span>
            <span class="player-select-prompt__text">{{ t('world.selectPlayerCharacter') }}</span>
          </button>
        </div>

        <WorldEventsSection
          :is-generating="eventStore.isGenerating"
          :recent-events="recentEvents"
          :timeline-entries="timelineEntries"
          :display-characters="displayCharacters"
          @select-character="(id: string) => openCharacterChat({ id })"
        />

        <GroupChatsSection
          @open-group="openGroupChat"
          @create-group="showCreateGroupModal = true"
        />

        <WorldGraphSection
          v-if="displayCharacters.length > 1"
          :characters="displayCharacters"
          @select-character="(id: string) => openCharacterChat({ id })"
        />

        <!-- Quick link to characters page (mobile only) -->
        <div v-if="!isDesktop" class="world-characters-link">
          <button class="world-characters-link-btn" @click="router.push('/tabs/workspace/characters')">
            👥 {{ t('world.viewAllCharacters') }}
            <span class="world-characters-link-arrow">→</span>
          </button>
        </div>
      </div>
    </div>

    <CreateGroupChatModal
      :is-open="showCreateGroupModal"
      :characters="characters"
      @close="showCreateGroupModal = false"
    />

    <SelectPlayerCharacterModal
      :is-open="showSelectPlayerModal"
      @close="showSelectPlayerModal = false"
    />
  </LayoutPage>
</template>

<style scoped>
/* ── Main layout ── */
.world-main {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* ── Desktop dual-pane layout ── */
.world-main--desktop {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 0;
  height: 100%;
  overflow: hidden;
}

/* ── Content area ── */
.world-content {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-md, 16px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Desktop: content scrolls within the right pane */
.world-main--desktop .world-content {
  padding: var(--adv-space-md, 16px) var(--adv-space-lg, 24px);
  height: 100%;
}

/* ── Remove redundant margin from section cards
   since the parent gap handles vertical spacing ── */
.world-content :deep(.world-events-section),
.world-content :deep(.group-chats-section),
.world-content :deep(.world-graph-section) {
  margin-left: 0;
  margin-right: 0;
  margin-top: 0;
  margin-bottom: 0;
}

.world-content :deep(.view-mode-switcher) {
  margin-left: 0;
  margin-right: 0;
}

.world-content :deep(.player-character-section) {
  margin-left: 0;
  margin-right: 0;
}

/* ── Reduce motion ── */
@media (prefers-reduced-motion: reduce) {
  .world-content {
    scroll-behavior: auto;
  }
}
</style>
