<script setup lang="ts">
import type { CharacterChatMessage } from '../stores/useCharacterChatStore'
import { IonIcon, IonInput } from '@ionic/vue'
import { closeOutline, searchOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  messages: CharacterChatMessage[]
}>()

const emit = defineEmits<{
  jumpTo: [index: number]
  close: []
}>()

const { t } = useI18n()
const query = ref('')
const currentMatchIndex = ref(0)

const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return []

  const result: { index: number, role: string, snippet: string }[] = []
  for (let i = 0; i < props.messages.length; i++) {
    const msg = props.messages[i]
    const pos = msg.content.toLowerCase().indexOf(q)
    if (pos !== -1) {
      // Extract snippet around match
      const start = Math.max(0, pos - 20)
      const end = Math.min(msg.content.length, pos + q.length + 30)
      const snippet = (start > 0 ? '…' : '')
        + msg.content.slice(start, end)
        + (end < msg.content.length ? '…' : '')
      result.push({ index: i, role: msg.role, snippet })
    }
  }
  return result
})

const matchCount = computed(() => matches.value.length)

function jumpToCurrent() {
  if (matches.value.length > 0) {
    const match = matches.value[currentMatchIndex.value]
    emit('jumpTo', match.index)
  }
}

function nextMatch() {
  if (matchCount.value === 0)
    return
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matchCount.value
  jumpToCurrent()
}

function prevMatch() {
  if (matchCount.value === 0)
    return
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchCount.value) % matchCount.value
  jumpToCurrent()
}

function onInput() {
  currentMatchIndex.value = 0
  if (matches.value.length > 0) {
    jumpToCurrent()
  }
}
</script>

<template>
  <div class="chs">
    <div class="chs-bar">
      <IonIcon :icon="searchOutline" class="chs-bar__icon" />
      <IonInput
        v-model="query"
        :placeholder="t('world.searchPlaceholder')"
        class="chs-bar__input"
        :clear-input="true"
        @ion-input="onInput"
      />
      <span v-if="query && matchCount > 0" class="chs-bar__count">
        {{ currentMatchIndex + 1 }}/{{ matchCount }}
      </span>
      <span v-else-if="query && matchCount === 0" class="chs-bar__count chs-bar__count--empty">
        0
      </span>
      <button v-if="matchCount > 1" class="chs-bar__nav" @click="prevMatch">
        ▲
      </button>
      <button v-if="matchCount > 1" class="chs-bar__nav" @click="nextMatch">
        ▼
      </button>
      <button class="chs-bar__close" @click="emit('close')">
        <IonIcon :icon="closeOutline" />
      </button>
    </div>

    <!-- Match list -->
    <div v-if="query && matches.length > 0" class="chs-matches">
      <button
        v-for="(match, i) in matches"
        :key="match.index"
        class="chs-match"
        :class="{ 'chs-match--active': i === currentMatchIndex }"
        @click="currentMatchIndex = i; jumpToCurrent()"
      >
        <span class="chs-match__role">{{ match.role === 'user' ? '👤' : '🤖' }}</span>
        <span class="chs-match__snippet">{{ match.snippet }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chs {
  background: var(--adv-surface-card);
  border-bottom: 1px solid var(--adv-border-subtle);
}

.chs-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
}

.chs-bar__icon {
  font-size: 18px;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
}

.chs-bar__input {
  flex: 1;
  --background: transparent;
  --padding-start: 4px;
  --min-height: 36px;
  height: 36px;
  font-size: 14px;
}

.chs-bar__count {
  font-size: 12px;
  color: var(--adv-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.chs-bar__count--empty {
  color: var(--ion-color-danger);
}

.chs-bar__nav {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--adv-surface-elevated);
  border-radius: var(--adv-radius-sm);
  color: var(--adv-text-secondary);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chs-bar__close {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: var(--adv-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.chs-matches {
  max-height: 160px;
  overflow-y: auto;
  border-top: 1px solid var(--adv-border-subtle);
}

.chs-match {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  color: var(--adv-text-secondary);
  line-height: 1.4;
}

.chs-match:hover {
  background: var(--adv-surface-elevated);
}

.chs-match--active {
  background: rgba(139, 92, 246, 0.08);
}

.chs-match__role {
  flex-shrink: 0;
  font-size: 14px;
}

.chs-match__snippet {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
