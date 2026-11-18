<script setup lang="ts">
import { isReplayAvailable, isReplayFinished, replayStartAddress } from '@advjs/core'
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdvContext } from '../composables/useAdvContext'
import { useExtrasI18n } from '../composables/useExtrasI18n'
import { useGameStore } from '../stores'

const { $adv } = useAdvContext()
const route = useRoute()
const router = useRouter()
const game = useGameStore()
const { t } = useExtrasI18n()

const replay = computed(() => $adv.gameConfig.value.replays?.find(item => item.id === route.query.id))
const status = shallowRef<'loading' | 'playing' | 'finished' | 'unavailable'>('loading')
const back = useTemplateRef<HTMLButtonElement>('back')
let mounted = true
let initialized = false

onBeforeUnmount(() => {
  mounted = false
  // Saves menus outside the replay read real slots again.
  if (initialized)
    game.setPreviewMode(false)
})

onMounted(async () => {
  try {
    const config = replay.value
    const program = await $adv.loadProgram()
    if (!mounted)
      return
    const start = config && program ? replayStartAddress(config, program) : undefined
    if (!config || !start || !isReplayAvailable(config, $adv.extras?.visited.value ?? [], program)) {
      status.value = 'unavailable'
      return
    }
    // A fresh runtime from the anchor with memory saves and replay-local variables.
    initialized = true
    await $adv.init({ isolated: true, variables: config.variables, isCurrent: () => mounted })
    if (!mounted)
      return
    await $adv.runtime.go(start)
    if (mounted)
      status.value = 'playing'
  }
  catch {
    if (mounted)
      status.value = 'unavailable'
  }
})

watch([status, $adv.runtime.state], ([phase, state]) => {
  if (phase === 'playing' && replay.value && isReplayFinished(replay.value, state)) {
    status.value = 'finished'
    $adv.$auto.stop()
  }
})
watch(back, button => button?.focus(), { flush: 'post' })

function exit() {
  void router.push('/extras')
}
</script>

<template>
  <AdvThemeScope class="adv-replay" :theme="$adv.themeConfig.value" :color-mode-storage-key="false">
    <AdvGame v-if="status === 'playing'" />

    <button v-if="status === 'playing'" class="adv-replay__exit" type="button" @click="exit">
      <span>{{ t('replay.label') }} · {{ replay?.title }}</span>
      <b>{{ t('replay.exit') }}</b>
    </button>

    <p v-if="status === 'loading'" class="adv-replay__loading" role="status">
      {{ t('replay.loading') }}
    </p>

    <div v-else-if="status === 'finished' || status === 'unavailable'" class="adv-replay__card" role="dialog" aria-modal="true" aria-labelledby="adv-replay-title">
      <div>
        <p>{{ t('replay.label') }}</p>
        <h2 id="adv-replay-title">
          {{ status === 'finished' ? t('replay.finished') : t('replay.unavailable') }}
        </h2>
        <small v-if="status === 'finished'">{{ replay?.title }}</small>
        <button ref="back" type="button" @click="exit">
          {{ t('replay.back') }}
        </button>
      </div>
    </div>
  </AdvThemeScope>
</template>

<route lang="yaml">
meta:
  layout: adv
</route>

<style scoped>
.adv-replay {
  position: relative;
  width: 100%;
  height: 100%;
}

.adv-replay__loading {
  margin: 0;
  padding: 1rem;
  text-align: center;
}

.adv-replay__exit {
  position: fixed;
  z-index: 150;
  top: max(10px, env(safe-area-inset-top, 0px));
  left: max(12px, env(safe-area-inset-left, 0px));
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  border: 1px solid rgb(117 221 235 / 45%);
  background: rgb(7 10 18 / 78%);
  padding: 0.5rem 0.85rem;
  color: #aeb8ce;
  cursor: pointer;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  backdrop-filter: blur(0.6rem);
}

.adv-replay__exit b {
  color: #75ddeb;
  font-weight: 500;
}

.adv-replay__card {
  position: fixed;
  z-index: 200;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(4 7 14 / 86%);
  color: #f3eee4;
  text-align: center;
  backdrop-filter: blur(0.4rem);
}

.adv-replay__card > div {
  display: grid;
  gap: 0.6rem;
  justify-items: center;
  border: 1px solid rgb(117 221 235 / 30%);
  background: rgb(8 13 26 / 92%);
  padding: 2rem 2.5rem;
}

.adv-replay__card p {
  margin: 0;
  color: #75ddeb;
  font: 0.72rem/1.4 monospace;
  letter-spacing: 0.2em;
}

.adv-replay__card h2 {
  margin: 0;
  font: 600 1.6rem/1.3 serif;
}

.adv-replay__card small {
  color: #99a7bf;
}

.adv-replay__card button {
  margin-top: 0.8rem;
  border: 1px solid rgb(117 221 235 / 55%);
  background: transparent;
  padding: 0.6rem 1.2rem;
  color: #f3eee4;
  cursor: pointer;
}
</style>
