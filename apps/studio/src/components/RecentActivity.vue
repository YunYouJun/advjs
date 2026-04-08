<script setup lang="ts">
import type { RecentItem } from '../composables/useRecentActivity'
import { IonIcon } from '@ionic/vue'
import { timeOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useRecentActivity } from '../composables/useRecentActivity'
import { getValidAvatarUrl } from '../utils/chatUtils'

const { t } = useI18n()
const router = useRouter()
const { recentItems } = useRecentActivity()

const TYPE_ICON: Record<string, string> = {
  chapter: '\uD83D\uDCD6',
  character: '\uD83D\uDC64',
  scene: '\uD83C\uDFAC',
  file: '\uD83D\uDCC4',
}

const editedItems = computed(() =>
  recentItems.value.filter(i => i.action === 'edit'),
)

const viewedItems = computed(() =>
  recentItems.value.filter(i => i.action === 'view'),
)

const hasEdited = computed(() => editedItems.value.length > 0)
const hasViewed = computed(() => viewedItems.value.length > 0)
const hasAny = computed(() => recentItems.value.length > 0)

const displayEdited = computed(() => {
  const merged = [...editedItems.value]
  const seen = new Map<string, RecentItem>()
  for (const item of merged) {
    const existing = seen.get(item.id)
    if (!existing || item.timestamp > existing.timestamp)
      seen.set(item.id, item)
  }
  return [...seen.values()].sort((a, b) => b.timestamp - a.timestamp)
})

function handleClick(item: RecentItem) {
  if (item.type === 'chapter') {
    router.push(`/editor?file=${encodeURIComponent(item.id)}`)
  }
  else if (item.type === 'character') {
    router.push('/tabs/workspace/characters')
  }
  else if (item.type === 'scene') {
    router.push('/tabs/workspace/scenes')
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

function getAvatarUrl(item: RecentItem): string {
  return getValidAvatarUrl(item.avatar)
}
</script>

<template>
  <section v-if="hasAny" class="recent">
    <!-- Recently Edited -->
    <div v-if="hasEdited" class="recent__group">
      <h3 class="section-label">
        <IonIcon :icon="timeOutline" />
        {{ t('dashboard.recentEdited') }}
      </h3>
      <div class="recent__track">
        <button
          v-for="item in displayEdited"
          :key="`edit-${item.id}`"
          class="recent__pill"
          @click="handleClick(item)"
        >
          <img
            v-if="item.type === 'character' && getAvatarUrl(item)"
            :src="getAvatarUrl(item)"
            :alt="item.label"
            class="recent__avatar"
          >
          <span v-else class="recent__emoji">{{ TYPE_ICON[item.type] || '\uD83D\uDCC4' }}</span>
          <span class="recent__name">{{ item.label }}</span>
          <time class="recent__time">{{ formatRelativeTime(item.timestamp) }}</time>
        </button>
      </div>
    </div>

    <!-- Recently Viewed -->
    <div v-if="hasViewed" class="recent__group">
      <h3 class="section-label">
        <IonIcon :icon="timeOutline" />
        {{ t('dashboard.recentViewed') }}
      </h3>
      <div class="recent__track">
        <button
          v-for="item in viewedItems"
          :key="`view-${item.id}`"
          class="recent__pill"
          @click="handleClick(item)"
        >
          <img
            v-if="item.type === 'character' && getAvatarUrl(item)"
            :src="getAvatarUrl(item)"
            :alt="item.label"
            class="recent__avatar"
          >
          <span v-else class="recent__emoji">{{ TYPE_ICON[item.type] || '\uD83D\uDCC4' }}</span>
          <span class="recent__name">{{ item.label }}</span>
          <time class="recent__time">{{ formatRelativeTime(item.timestamp) }}</time>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.recent {
  padding: 0 var(--adv-space-md) var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.recent__group {
  display: flex;
  flex-direction: column;
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

/* ─── Track (horizontal scroll) ─── */
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

/* ─── Pill ─── */
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
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08);
}

.recent__pill:active {
  transform: scale(0.96);
}

.recent__pill:focus-visible {
  outline: 2px solid rgb(99, 102, 241);
  outline-offset: 2px;
}

/* ─── Emoji icon ─── */
.recent__emoji {
  font-size: 14px;
  line-height: 1;
}

/* ─── Character avatar thumbnail ─── */
.recent__avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--adv-border-subtle);
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

/* ─── Reduced motion ─── */
@media (prefers-reduced-motion: reduce) {
  .recent__pill {
    transition: none;
  }
}
</style>
