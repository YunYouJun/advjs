<script setup lang="ts">
import type { AdvContext } from '@advjs/client/types'
import type { AdvConfig, AdvGameConfig, RuntimeAddress, RuntimeProgram } from '@advjs/types'
import type { PlayerFold } from './bridge'
import { useAppStore } from '@advjs/client'
import AdvGame from '@advjs/client/components/game/AdvGame.vue'
import { injectionAdvContext } from '@advjs/client/constants'
import { setupAdvContext } from '@advjs/client/setup/context'
import { civilization, starMap } from '@advjs/plugin-interactions'
import CivilizationActivity from '@advjs/plugin-interactions/client/CivilizationActivity.vue'
import StarMapActivity from '@advjs/plugin-interactions/client/StarMapActivity.vue'
import { computed, nextTick, onBeforeUnmount, provide, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { installHostReceiver, postToHost, reportPlayerError } from './bridge'

const app = useAppStore()
const { locale } = useI18n({ useScope: 'global' })
const edges = ['top', 'right', 'bottom', 'left'] as const
const quarterTurns = computed(() => (app.rotation % 360) / 90)
const stageInsets = computed(() => {
  // The game can rotate its logical stage independently of the native window.
  return Object.fromEntries(edges.map((edge, index) => [
    `--player-safe-${edge}`,
    `env(safe-area-inset-${edges[(index + quarterTurns.value) % edges.length]}, 0px)`,
  ]))
})
const fold = shallowRef<PlayerFold | null>(null)
const foldLayout = computed(() => {
  const division = fold.value
  if (!division)
    return undefined

  const turns = quarterTurns.value
  const horizontal = division.axis === 'horizontal'
  const rows = horizontal !== (turns % 2 === 1)
  const reversed = horizontal ? turns >= 2 : turns === 1 || turns === 2
  const start = reversed ? 1 - division.end : division.start
  const end = reversed ? 1 - division.start : division.end
  return {
    direction: rows ? 'rows' : 'columns',
    style: {
      '--player-fold-start': `${start * 100}%`,
      '--player-fold-end': `${end * 100}%`,
      '--player-physical-fold-end': `${division.end * 100}%`,
    },
  }
})
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
const themeConfig = computed<AdvContext['themeConfig']['value']>(() => ({
  ui: {
    colorScheme: colorScheme.value,
    tokens: {
      '--adv-choice-bg': 'rgb(27 24 41 / 94%)',
      '--adv-choice-hover-bg': '#3a314f',
      '--adv-choice-color': '#f6f3ff',
      '--adv-choice-border': 'rgb(190 175 221 / 34%)',
      '--adv-choice-radius': '12px',
    },
  },
}))
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
      if (message.locale)
        locale.value = message.locale
      fold.value = message.fold ?? null
      ready.value = true
      await nextTick()
      await adv.init({ persistence: false, compiledProgram: message.program })
      // WebKit can defer AudioContext.resume while the scene is inactive.
      // Audio queues its effects until unlock completes.
      void adv.$audio.unlock().catch(() => false)
      await adv.runtime.go(start)
      await nextTick()
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      postToHost({ type: 'loaded', ...adv.store.state.cursor })
      break
    }
    case 'fold':
      fold.value = message.fold
      break
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
  <AdvGame
    v-if="ready"
    class="native-player size-full"
    :data-fold-layout="foldLayout?.direction"
    :data-fold-axis="fold?.axis"
    :style="[stageInsets, foldLayout?.style]"
  />
</template>

<style scoped>
.native-player {
  --player-ui-insets: var(--player-safe-top) var(--player-safe-right) var(--player-safe-bottom) var(--player-safe-left);
}

.native-player :deep(.adv-ui) {
  inset: var(--player-ui-insets);
  width: auto;
  height: auto;
}

/* Continue the dialogue shading past the safe-area edges while keeping text inside. */
.native-player :deep(.adv-dialog-box) {
  right: calc(-1px - var(--player-safe-right));
  bottom: calc(-5px - var(--player-safe-bottom));
  left: calc(-1px - var(--player-safe-left));
  min-height: calc(var(--adv-dialog-min-height) + var(--player-safe-bottom));
  padding-right: calc(var(--adv-dialog-padding-inline) + var(--player-safe-right));
  padding-bottom: calc(var(--adv-dialog-footer-space) + var(--player-safe-bottom));
  padding-left: calc(var(--adv-dialog-padding-inline) + var(--player-safe-left));
}

.native-player :deep(.modal-mask) {
  box-sizing: border-box;
  padding: var(--player-ui-insets);
}

.native-player :deep(.modal-container) {
  position: relative;
}

.native-player :deep(.adv-activity__panel) {
  box-sizing: border-box;
  max-width: calc(100% - 2rem);
  max-height: calc(100% - 2rem);
}

.native-player :deep(.adv-option) {
  min-height: 44px;
  font-size: clamp(1rem, 3.2cqi, 1.25rem);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.native-player[data-fold-layout='rows'] {
  --player-reading-top: max(var(--player-safe-top), var(--player-fold-end));
  --player-reading-left: var(--player-safe-left);
}

.native-player[data-fold-layout='columns'] {
  --player-reading-top: var(--player-safe-top);
  --player-reading-left: max(var(--player-safe-left), var(--player-fold-end));
}

.native-player[data-fold-layout] :deep(.adv-game) {
  inset: 0;
  width: auto;
  height: auto;
  overflow: hidden;
}

.native-player[data-fold-layout='rows'] :deep(.adv-game) {
  bottom: calc(100% - var(--player-fold-start));
}

.native-player[data-fold-layout='columns'] :deep(.adv-game) {
  right: calc(100% - var(--player-fold-start));
}

.native-player[data-fold-layout] :deep(.tachie-slot) {
  bottom: 0;
  width: min(68%, 34rem);
  height: 90%;
}

.native-player[data-fold-layout] :deep(.adv-ui) {
  top: var(--player-reading-top);
  left: var(--player-reading-left);
  background: linear-gradient(145deg, #242132, #100f17);
}

.native-player[data-fold-layout] :deep(.adv-dialog-box) {
  inset: 0 0 var(--adv-dialog-footer-space) 0;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr);
  align-content: safe center;
  overflow-y: auto;
  padding: clamp(16px, 4cqi, 32px);
  background: none;
}

.native-player[data-fold-layout] :deep(.adv-option) {
  width: min(calc(100% - 2rem), 27rem);
  margin: 0.4rem 1rem;
  padding: 0.65rem 1rem;
}

.native-player[data-fold-layout] :deep(.modal-mask) {
  padding-top: var(--player-reading-top);
  padding-left: var(--player-reading-left);
}

.native-player[data-fold-axis='vertical'] :deep(.game-toolbar) {
  left: var(--player-physical-fold-end);
}
</style>
