<script setup lang="ts">
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import CharacterCard from '../components/CharacterCard.vue'
import CreateGroupChatModal from '../components/CreateGroupChatModal.vue'
import SelectPlayerCharacterModal from '../components/SelectPlayerCharacterModal.vue'
import ViewModeSwitcher from '../components/ViewModeSwitcher.vue'
import { useProjectContent } from '../composables/useProjectContent'
import { useWorldContext } from '../composables/useWorldContext'
import { useCharacterChatStore } from '../stores/useCharacterChatStore'
import { useCharacterMemoryStore } from '../stores/useCharacterMemoryStore'
import { useCharacterStateStore } from '../stores/useCharacterStateStore'
import { useGroupChatStore } from '../stores/useGroupChatStore'
import { useSettingsStore } from '../stores/useSettingsStore'
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
const settingsStore = useSettingsStore()
const characterChatStore = useCharacterChatStore()
const memoryStore = useCharacterMemoryStore()
const stateStore = useCharacterStateStore()
const clockStore = useWorldClockStore()
const eventStore = useWorldEventStore()
const groupChatStore = useGroupChatStore()
const { characters, isLoading, loadFromDir, loadFromCos } = useProjectContent()
const { worldContext, loadFromDir: loadWorldFromDir, loadFromCos: loadWorldFromCos } = useWorldContext()

const viewModeStore = useViewModeStore()

const hasProject = computed(() => !!studioStore.currentProject)
const showEvents = ref(true)
const showCreateGroupModal = ref(false)
const showSelectPlayerModal = ref(false)

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
function onClockAdvance(dateChanged: boolean) {
  eventStore.generateEvents(
    worldContext.value,
    characters.value,
    clockStore.clock,
    dateChanged,
  ).then((weather) => {
    if (typeof weather === 'string')
      clockStore.setWeather(weather)
  })
}

onMounted(() => {
  clockStore.onAdvance(onClockAdvance)
})

onUnmounted(() => {
  clockStore.offAdvance(onClockAdvance)
})

// Load characters and world context when project changes
watch(() => studioStore.currentProject, async (project) => {
  if (!project)
    return
  if (project.dirHandle) {
    await Promise.all([
      loadFromDir(project.dirHandle),
      loadWorldFromDir(project.dirHandle),
    ])
  }
  else if (project.source === 'cos' && project.cosPrefix) {
    await Promise.all([
      loadFromCos(settingsStore.cos, project.cosPrefix),
      loadWorldFromCos(settingsStore.cos, project.cosPrefix),
    ])
  }
}, { immediate: true })

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

function getLastMessagePreview(characterId: string): string {
  const msg = characterChatStore.getLastMessage(characterId)
  if (!msg)
    return ''
  const preview = msg.content.slice(0, 50)
  return preview + (msg.content.length > 50 ? '...' : '')
}

function getMood(characterId: string): string | undefined {
  const memory = memoryStore.getMemory(characterId)
  const mood = memory.emotionalState.mood
  return mood !== 'neutral' ? mood : undefined
}

function getLocation(characterId: string): string | undefined {
  const state = stateStore.getState(characterId)
  return state.location || undefined
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
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('world.title') }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
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
      <div v-else>
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
          <button
            class="world-events-header"
            @click="showEvents = !showEvents"
          >
            <span>🌍 {{ t('world.worldDynamics') }}</span>
            <span class="world-events-toggle">{{ showEvents ? '▼' : '▶' }}</span>
          </button>

          <div v-if="showEvents" class="world-events-list">
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

        <!-- Character list -->
        <div class="world-characters">
          <div
            v-for="character in displayCharacters"
            :key="character.id"
            class="world-character-item"
          >
            <CharacterCard
              :character="character"
              :mood="getMood(character.id)"
              :location="getLocation(character.id)"
              @click="openCharacterChat(character)"
            />
            <p v-if="getLastMessagePreview(character.id)" class="world-character-preview">
              {{ getLastMessagePreview(character.id) }}
            </p>
          </div>
        </div>
      </div>
    </IonContent>

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
  </IonPage>
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
  gap: 4px;
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
</style>
