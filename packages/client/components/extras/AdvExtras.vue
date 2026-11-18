<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAdvContext } from '../../composables/useAdvContext'
import { useAdvExtras } from '../../composables/useAdvExtras'
import { useExtrasI18n } from '../../composables/useExtrasI18n'

type ExtrasTab = 'endings' | 'achievements' | 'replays' | 'music'

const { $adv } = useAdvContext()
const router = useRouter()
const { t } = useExtrasI18n()
const { endings, achievements, replays, tracks, route, visibleRoute } = useAdvExtras()
const idPrefix = useId()

const tabs = computed(() => {
  const game = $adv.gameConfig.value
  const all: Array<{ id: ExtrasTab, count: number, total: number, shown: boolean }> = [
    { id: 'endings', count: endings.value.filter(item => item.unlocked).length, total: endings.value.length, shown: Boolean(game.endings?.items.length) },
    { id: 'achievements', count: achievements.value.filter(item => item.unlocked).length, total: achievements.value.length, shown: Boolean(game.achievements?.items.length) },
    { id: 'replays', count: replays.value.filter(item => item.available).length, total: replays.value.length, shown: Boolean(game.replays?.length) },
    { id: 'music', count: tracks.value.filter(track => track.heard).length, total: tracks.value.length, shown: Boolean(game.musicRoom) },
  ]
  return all.filter(tab => tab.shown)
})
const active = shallowRef<ExtrasTab>()
watch(tabs, (value) => {
  if (!value.some(tab => tab.id === active.value))
    active.value = value[0]?.id
}, { immediate: true })

function navigateTabs(event: KeyboardEvent) {
  const current = tabs.value.findIndex(tab => tab.id === active.value)
  const count = tabs.value.length
  let next: number
  switch (event.key) {
    case 'ArrowLeft':
      next = (current + count - 1) % count
      break
    case 'ArrowRight':
      next = (current + 1) % count
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = count - 1
      break
    default:
      return
  }
  const tab = tabs.value[next]
  if (!tab)
    return
  event.preventDefault()
  active.value = tab.id
  const tablist = event.currentTarget as HTMLElement
  tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}

const playing = shallowRef<string>()
async function toggleTrack(id: string) {
  const next = playing.value === id ? null : id
  playing.value = next ?? undefined
  try {
    await $adv.$audio.playMusic(next)
  }
  catch {
    if (playing.value === next)
      playing.value = undefined
  }
}
onBeforeUnmount(() => {
  if (playing.value)
    void $adv.$audio.playMusic(null).catch(() => {})
})

function replay(id: string) {
  void router.push({ path: '/replay', query: { id } })
}
</script>

<template>
  <section class="adv-extras" :aria-labelledby="`${idPrefix}-title`">
    <header class="adv-extras__header">
      <h1 :id="`${idPrefix}-title`">
        {{ t('extras.title') }}
      </h1>
      <nav class="adv-extras__links">
        <RouterLink v-if="route?.nodes.length" to="/flow-chart">
          <b>{{ t('extras.route') }}</b>
          <small>{{ t('route.visited', { count: visibleRoute?.nodes.length ?? 0, total: route.nodes.length }) }}</small>
        </RouterLink>
        <RouterLink v-if="$adv.gameConfig.value.gallery" to="/gallery">
          <b>{{ t('extras.gallery') }}</b>
          <small>{{ t('extras.found', { count: $adv.gallery?.unlocked.value.length ?? 0, total: $adv.gameConfig.value.gallery.items.length }) }}</small>
        </RouterLink>
      </nav>
    </header>

    <div v-if="tabs.length" class="adv-extras__tabs" role="tablist" :aria-label="t('extras.tabs')" @keydown="navigateTabs">
      <button
        v-for="tab in tabs"
        :id="`${idPrefix}-tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="active === tab.id"
        :aria-controls="`${idPrefix}-panel-${tab.id}`"
        :tabindex="active === tab.id ? 0 : -1"
        @click="active = tab.id"
      >
        {{ t(`extras.${tab.id}`) }}
        <small>{{ t('extras.found', { count: tab.count, total: tab.total }) }}</small>
      </button>
    </div>
    <p v-else class="adv-extras__empty">
      {{ t('extras.empty') }}
    </p>

    <div
      v-if="active"
      :id="`${idPrefix}-panel-${active}`"
      class="adv-extras__panel"
      role="tabpanel"
      :aria-labelledby="`${idPrefix}-tab-${active}`"
      tabindex="0"
    >
      <ul v-if="active === 'endings' || active === 'achievements'" class="adv-extras__list">
        <li
          v-for="item in active === 'endings' ? endings : achievements"
          :key="item.id"
          class="adv-extras__entry"
          :class="{ 'is-locked': !item.unlocked }"
        >
          <span class="adv-extras__mark" aria-hidden="true">{{ item.unlocked ? '◆' : '◇' }}</span>
          <div>
            <h2>{{ item.unlocked ? item.title : t('extras.locked') }}</h2>
            <p>{{ item.unlocked ? item.description ?? item.hint : item.hint ?? t('extras.lockedHint') }}</p>
          </div>
        </li>
      </ul>

      <template v-else-if="active === 'replays'">
        <p class="adv-extras__note">
          {{ t('extras.replayNote') }}
        </p>
        <ul class="adv-extras__list">
          <li v-for="item in replays" :key="item.id" class="adv-extras__entry" :class="{ 'is-locked': !item.available }">
            <span class="adv-extras__mark" aria-hidden="true">{{ item.available ? '▶' : '◇' }}</span>
            <div>
              <h2>{{ item.available ? item.title : t('extras.locked') }}</h2>
              <p>{{ item.available ? item.hint : item.hint ?? t('extras.replayLocked') }}</p>
            </div>
            <button v-if="item.available" type="button" @click="replay(item.id)">
              {{ t('extras.replayAction') }}
            </button>
          </li>
        </ul>
      </template>

      <ul v-else-if="active === 'music'" class="adv-extras__list">
        <li v-for="track in tracks" :key="track.id" class="adv-extras__entry" :class="{ 'is-locked': !track.heard, 'is-playing': playing === track.id }">
          <span class="adv-extras__mark" aria-hidden="true">{{ track.heard ? '♪' : '◇' }}</span>
          <div>
            <h2>{{ track.heard ? track.title : t('extras.unheard') }}</h2>
            <p v-if="track.heard">
              {{ playing === track.id ? t('extras.nowPlaying') : track.description }}
            </p>
          </div>
          <button v-if="track.heard" type="button" :aria-pressed="playing === track.id" @click="toggleTrack(track.id)">
            {{ playing === track.id ? t('extras.stop') : t('extras.play') }}
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.adv-extras {
  --extras-ink: var(--adv-theme-extras-ink, #f3eee4);
  --extras-muted: var(--adv-theme-extras-muted, #99a7bf);
  --extras-accent: var(--adv-theme-extras-accent, #75ddeb);
  --extras-surface: var(--adv-theme-extras-surface, rgb(8 13 26 / 86%));
  width: min(64rem, calc(100% - 2rem));
  margin: 0 auto;
  padding: clamp(3.5rem, 6vw, 5rem) 0;
  color: var(--extras-ink);
  text-align: left;
}

.adv-extras__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid color-mix(in srgb, var(--extras-accent), transparent 70%);
  padding-bottom: 1.25rem;
}

.adv-extras__header h1 {
  margin: 0.35rem 0 0;
  font: 600 clamp(2rem, 5vw, 4rem)/1.1 serif;
}

.adv-extras__links {
  display: flex;
  gap: 0.75rem;
}

.adv-extras__links a {
  display: grid;
  gap: 0.2rem;
  min-width: 8.5rem;
  border: 1px solid color-mix(in srgb, var(--extras-accent), transparent 65%);
  background: var(--extras-surface);
  padding: 0.7rem 0.9rem;
  color: var(--extras-ink);
  text-decoration: none;
}

.adv-extras__links a:hover,
.adv-extras__links a:focus-visible {
  border-color: var(--extras-accent);
  outline: none;
}

.adv-extras__links small,
.adv-extras__tabs small {
  color: var(--extras-muted);
  font: 0.72rem/1.2 monospace;
}

.adv-extras__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  margin-bottom: 1rem;
  background: color-mix(in srgb, var(--extras-accent), transparent 82%);
}

.adv-extras__tabs button {
  display: flex;
  flex: 1 1 8rem;
  gap: 0.6rem;
  align-items: baseline;
  justify-content: center;
  border: 0;
  background: var(--extras-surface);
  padding: 0.8rem 1rem;
  color: var(--extras-muted);
  cursor: pointer;
  letter-spacing: 0.08em;
}

.adv-extras__tabs button[aria-selected='true'] {
  box-shadow: inset 0 -2px 0 var(--extras-accent);
  color: var(--extras-ink);
}

.adv-extras__tabs button:focus-visible {
  outline: 1px solid var(--extras-accent);
}

.adv-extras__note,
.adv-extras__empty {
  margin: 0 0 1rem;
  color: var(--extras-muted);
  font-size: 0.85rem;
}

.adv-extras__list {
  display: grid;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.adv-extras__entry {
  display: grid;
  gap: 1rem;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--extras-accent), transparent 78%);
  background: var(--extras-surface);
  padding: 0.9rem 1.1rem;
  grid-template-columns: 2.2rem minmax(0, 1fr) auto;
}

.adv-extras__entry h2 {
  margin: 0;
  font: 600 1.05rem/1.4 serif;
  letter-spacing: 0.04em;
}

.adv-extras__entry p {
  margin: 0.25rem 0 0;
  color: var(--extras-muted);
  font-size: 0.82rem;
  line-height: 1.6;
}

.adv-extras__mark {
  color: var(--extras-accent);
  font: 0.9rem/1 monospace;
  text-align: center;
}

.adv-extras__entry.is-locked h2 {
  color: var(--extras-muted);
}

.adv-extras__entry.is-locked .adv-extras__mark {
  opacity: 0.45;
}

.adv-extras__entry.is-playing {
  border-color: var(--extras-accent);
}

.adv-extras__entry button {
  border: 1px solid color-mix(in srgb, var(--extras-accent), transparent 55%);
  background: transparent;
  padding: 0.5rem 0.9rem;
  color: var(--extras-ink);
  cursor: pointer;
}

.adv-extras__entry button:hover,
.adv-extras__entry button:focus-visible {
  border-color: var(--extras-accent);
  color: var(--extras-accent);
  outline: none;
}

@media (max-width: 520px) {
  .adv-extras__links {
    width: 100%;
  }
  .adv-extras__links a {
    flex: 1;
    min-width: 0;
  }
  .adv-extras__entry {
    gap: 0.75rem;
    grid-template-columns: 1.6rem minmax(0, 1fr);
  }
  .adv-extras__entry button {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
