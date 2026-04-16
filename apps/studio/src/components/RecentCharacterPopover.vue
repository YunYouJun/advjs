<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { IonIcon } from '@ionic/vue'
import { chatbubbleOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useProjectContent } from '../composables/useProjectContent'
import { useCharacterChatStore } from '../stores/useCharacterChatStore'
import { getValidAvatarUrl } from '../utils/chatUtils'

const props = withDefaults(defineProps<{
  /** Maximum number of recent characters to show */
  max?: number
  /** Whether to show the component even when empty */
  showEmpty?: boolean
}>(), {
  max: 3,
  showEmpty: false,
})

const emit = defineEmits<{
  (e: 'select', characterId: string): void
}>()

const { t } = useI18n()
const router = useRouter()
const chatStore = useCharacterChatStore()
const { characters } = useProjectContent()

interface RecentCharacterEntry {
  characterId: string
  character: AdvCharacter | undefined
  lastTimestamp: number
  messageCount: number
  lastMessage: string
}

const recentCharacters = computed<RecentCharacterEntry[]>(() => {
  const entries: RecentCharacterEntry[] = []

  for (const [characterId, conv] of chatStore.conversations.entries()) {
    if (conv.messages.length === 0)
      continue
    const lastMsg = conv.messages.at(-1)
    entries.push({
      characterId,
      character: characters.value.find(c => c.id === characterId),
      lastTimestamp: lastMsg?.timestamp ?? 0,
      messageCount: conv.messages.length,
      lastMessage: lastMsg?.content ?? '',
    })
  }

  return entries
    .filter(e => e.lastTimestamp > 0)
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
    .slice(0, props.max)
})

const hasRecent = computed(() => recentCharacters.value.length > 0)

function handleSelect(characterId: string) {
  emit('select', characterId)
  router.push(`/tabs/world/character/${characterId}`)
}

function formatTimeAgo(timestamp: number): string {
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

function truncate(text: string, maxLen = 40): string {
  if (text.length <= maxLen)
    return text
  return `${text.slice(0, maxLen)}…`
}

function getAvatar(entry: RecentCharacterEntry): string {
  return getValidAvatarUrl(entry.character?.avatar)
}
</script>

<template>
  <div v-if="hasRecent || showEmpty" class="recent-chars">
    <div class="recent-chars__header">
      <IonIcon :icon="chatbubbleOutline" class="recent-chars__header-icon" />
      <span class="recent-chars__title">{{ t('world.recentChats') }}</span>
    </div>
    <div v-if="hasRecent" class="recent-chars__list">
      <button
        v-for="entry in recentCharacters"
        :key="entry.characterId"
        class="recent-char"
        @click="handleSelect(entry.characterId)"
      >
        <div class="recent-char__avatar">
          <img :src="getAvatar(entry)" :alt="entry.character?.name || entry.characterId">
        </div>
        <div class="recent-char__info">
          <span class="recent-char__name">{{ entry.character?.name || entry.characterId }}</span>
          <span class="recent-char__preview">{{ truncate(entry.lastMessage) }}</span>
        </div>
        <span class="recent-char__time">{{ formatTimeAgo(entry.lastTimestamp) }}</span>
      </button>
    </div>
    <div v-else class="recent-chars__empty">
      <span>{{ t('world.noRecentChats') }}</span>
    </div>
  </div>
</template>

<style scoped>
.recent-chars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recent-chars__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}

.recent-chars__header-icon {
  font-size: 14px;
  color: var(--ion-color-primary, #6366f1);
}

.recent-chars__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--adv-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.recent-chars__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recent-char {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: var(--adv-surface-card);
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.recent-char:hover {
  background: var(--adv-surface-elevated, #f5f5f5);
  border-color: var(--adv-border-subtle);
}

:root.dark .recent-char:hover {
  background: var(--adv-surface-elevated, #2a2a3e);
}

.recent-char:active {
  transform: scale(0.98);
}

.recent-char__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(99, 102, 241, 0.1);
}

.recent-char__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recent-char__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.recent-char__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--adv-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-char__preview {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-char__time {
  font-size: 10px;
  color: var(--adv-text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.recent-chars__empty {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--adv-text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .recent-char {
    transition: none;
  }
}
</style>
