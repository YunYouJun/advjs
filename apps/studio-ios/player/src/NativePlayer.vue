<script setup lang="ts">
import type { AdvContext } from '@advjs/client/types'
import type { AdvConfig, AdvGameConfig, RuntimeAddress, RuntimeProgram } from '@advjs/types'
import AdvGame from '@advjs/client/components/game/AdvGame.vue'
import { injectionAdvContext } from '@advjs/client/constants'
import { setupAdvContext } from '@advjs/client/setup/context'
import { civilization, starMap } from '@advjs/plugin-interactions'
import CivilizationActivity from '@advjs/plugin-interactions/client/CivilizationActivity.vue'
import StarMapActivity from '@advjs/plugin-interactions/client/StarMapActivity.vue'
import { computed, nextTick, onBeforeUnmount, provide, shallowRef, watch } from 'vue'
import { installHostReceiver, postToHost, reportPlayerError } from './bridge'

const gameConfig = shallowRef<AdvGameConfig>({
  title: '',
  description: '',
  favicon: '',
  bgm: { autoplay: false },
  assets: { manifest: { bundles: [] } },
  chapters: [],
  characters: [],
  scenes: [],
})
const ready = shallowRef(false)
const colorScheme = shallowRef<'dark' | 'light'>('dark')
const themeConfig = computed<AdvContext['themeConfig']['value']>(() => ({ ui: { colorScheme: colorScheme.value } }))
let start: RuntimeAddress | undefined
let program: RuntimeProgram | undefined

const config = computed(() => ({
  logLevel: 3,
  root: '/',
  format: 'flow',
  theme: 'default',
  features: { babylon: false },
  aspectRatio: 16 / 9,
  canvasWidth: 1920,
  viewportFit: 'responsive',
  selectable: true,
  pages: { start: { bg: '' } },
  showCharacterAvatar: true,
  cdn: { enable: false },
  gameConfig: gameConfig.value,
  themeConfig: themeConfig.value,
  runtimeConfig: { canvasHeight: 1080 },
  plugins: [],
}) as unknown as AdvConfig)

const adv = setupAdvContext({
  config,
  gameConfig,
  themeConfig,
  runtimePlugins: [
    Object.assign(starMap(), { activityRenderers: { 'star-map/compare': StarMapActivity } }),
    Object.assign(civilization(), { activityRenderers: { 'civilization/initialize': CivilizationActivity } }),
  ],
})
provide(injectionAdvContext, adv)

watch(adv.compileDiagnostics, (diagnostics, previous) => {
  for (const item of diagnostics.filter(item => !previous.includes(item))) {
    if (item.severity === 'error' || item.severity === 'warning')
      postToHost({ type: 'diagnostic', code: item.code, severity: item.severity, message: item.message })
  }
})

function dispose() {
  adv.$auto.stop()
  adv.$audio.dispose()
  adv.runtime.dispose()
}

installHostReceiver(async (message) => {
  switch (message.type) {
    case 'load': {
      start = message.address
      program = message.program
      gameConfig.value = message.gameConfig
      colorScheme.value = message.colorScheme
      ready.value = true
      await nextTick()
      await adv.init({ persistence: false, compiledProgram: message.program })
      await adv.$audio.unlock().catch(() => false)
      await adv.runtime.go(start)
      await nextTick()
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      postToHost({ type: 'loaded', ...adv.store.state.cursor })
      break
    }
    case 'restart':
      if (start && program) {
        await adv.$audio.reset()
        adv.runtime.install(program, { initialVariables: gameConfig.value.variables })
        await adv.runtime.go(start)
      }
      break
    case 'chapter': {
      const chapter = adv.store.program?.chapters[message.chapterId]
      if (chapter)
        await adv.runtime.go({ chapterId: message.chapterId, nodeId: chapter.entry })
      break
    }
    case 'back':
      if (adv.runtime.snapshot().checkpoints.length)
        adv.runtime.back()
      break
    case 'pause':
      adv.$auto.stop()
      adv.$audio.pause()
      document.querySelectorAll<HTMLMediaElement>('audio,video').forEach(media => media.pause())
      break
    case 'resume':
      await adv.$audio.resume()
      break
    case 'dispose':
      dispose()
      break
  }
})

window.addEventListener('error', event => reportPlayerError('PLAYER_SCRIPT', event.message))
window.addEventListener('unhandledrejection', event => reportPlayerError('PLAYER_REJECTION', event.reason))
onBeforeUnmount(dispose)
postToHost({ type: 'ready' })
</script>

<template>
  <AdvGame v-if="ready" class="size-full" />
</template>
