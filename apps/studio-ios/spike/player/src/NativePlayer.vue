<script setup lang="ts">
/**
 * SPIKE: the whole player page. Native sends a `load` message with a game
 * config compiled by the JavaScriptCore engine; this page only renders it.
 */
import type { AdvContext } from '@advjs/client/types'
import type { AdvConfig, AdvGameConfig, JsonObject, RuntimeChoice } from '@advjs/types'
import type { HostToPlayer } from './bridge'
import AdvGame from '@advjs/client/components/game/AdvGame.vue'
import { injectionAdvContext } from '@advjs/client/constants'
import { setupAdvContext } from '@advjs/client/setup/context'
import { civilization, starMap } from '@advjs/plugin-interactions'
import CivilizationActivity from '@advjs/plugin-interactions/client/CivilizationActivity.vue'
import StarMapActivity from '@advjs/plugin-interactions/client/StarMapActivity.vue'
import { computed, nextTick, onBeforeUnmount, provide, shallowRef, watch } from 'vue'
import { installHostReceiver, PLAYER_PROTOCOL_VERSION, postToHost } from './bridge'

const EMPTY_GAME: AdvGameConfig = {
  title: '',
  description: '',
  favicon: '',
  bgm: { autoplay: false },
  assets: { manifest: { bundles: [] } },
  chapters: [],
  characters: [],
  scenes: [],
} as unknown as AdvGameConfig

const gameConfigRef = shallowRef<AdvGameConfig>(EMPTY_GAME)
const ready = shallowRef(false)

function minimalConfig(gameConfig: AdvGameConfig): AdvConfig {
  // Same defaults as Studio's embedded player (`useStudioAdvConfig.buildMinimalConfig`).
  return {
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
    gameConfig,
    themeConfig: { ui: { colorScheme: 'dark' } },
    runtimeConfig: { canvasHeight: 1080 },
    plugins: [],
  } as unknown as AdvConfig
}

const config = computed(() => minimalConfig(gameConfigRef.value))
function memoryStorage() {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } as Storage
}

const $adv: AdvContext = setupAdvContext({
  config,
  gameConfig: gameConfigRef,
  themeConfig: computed(() => ({ ui: { colorScheme: 'dark' } })) as AdvContext['themeConfig'],
  runtimePlugins: [
    Object.assign(starMap(), { activityRenderers: { 'star-map/compare': StarMapActivity } }),
    Object.assign(civilization(), { activityRenderers: { 'civilization/initialize': CivilizationActivity } }),
  ],
  // Saves belong to the native host; the page keeps nothing between sessions.
  progressionStorage: memoryStorage(),
  galleryStorage: memoryStorage(),
})
provide(injectionAdvContext, $adv)

/** Mirrors `AdvChoice.vue`: options live on the current `choices` node. */
function currentChoices(): RuntimeChoice[] {
  const node = $adv.store.current
  const options = node?.kind === 'choices' ? node.data?.options : undefined
  return Array.isArray(options) ? options as unknown as RuntimeChoice[] : []
}

function reportState() {
  const state = $adv.store.state
  const node = $adv.store.current
  postToHost({
    type: 'state',
    status: state.status,
    chapterId: state.cursor.chapterId,
    nodeId: state.cursor.nodeId,
    kind: node?.kind,
    choices: currentChoices().map(choice => choice.label),
    activity: (state as { pendingActivity?: { type: string } }).pendingActivity?.type,
  })
}

watch(() => [$adv.store.state.cursor.chapterId, $adv.store.state.cursor.nodeId, $adv.store.state.status], () => {
  if (ready.value)
    reportState()
})

watch($adv.compileDiagnostics, (diagnostics) => {
  for (const item of diagnostics)
    postToHost({ type: 'diagnostic', code: item.code, severity: item.severity, message: item.message })
})

/** Collects observable evidence for the spike report without trusting the page's own claims. */
function probe(): Record<string, unknown> {
  const images = [...document.images].map(image => ({
    src: image.currentSrc || image.src,
    complete: image.complete,
    width: image.naturalWidth,
  }))
  const media = [...document.querySelectorAll('audio, video')].map((element) => {
    const item = element as HTMLMediaElement
    return { src: item.currentSrc, paused: item.paused, currentTime: item.currentTime, readyState: item.readyState, error: item.error?.code }
  })
  const backgrounds = [...document.querySelectorAll<HTMLElement>('[style*="background"]')]
    .map(element => getComputedStyle(element).backgroundImage)
    .filter(value => value && value !== 'none')
  return {
    location: location.href,
    secureContext: isSecureContext,
    hasSubtleCrypto: typeof crypto?.subtle?.digest === 'function',
    canvases: document.querySelectorAll('canvas').length,
    images,
    media,
    backgrounds,
    stage: JSON.parse(JSON.stringify($adv.store.state.stage)),
    variables: JSON.parse(JSON.stringify($adv.store.state.variables)) as JsonObject,
    audio: (() => {
      try {
        return JSON.parse(JSON.stringify($adv.$audio.inspect()))
      }
      catch (error) {
        return { error: String(error) }
      }
    })(),
    heapUsed: (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
  }
}

installHostReceiver(async (message: HostToPlayer) => {
  switch (message.type) {
    case 'load': {
      const started = performance.now()
      ready.value = false
      gameConfigRef.value = message.gameConfig
      await nextTick()
      await $adv.init({ persistence: false })
      // The native "Play" tap is the user gesture; WKWebView is configured to allow playback without another one.
      const audioUnlocked = await $adv.$audio.unlock().catch(() => false)
      postToHost({ type: 'diagnostic', code: 'SPIKE_AUDIO_UNLOCK', severity: 'info', message: String(audioUnlocked) })
      if (message.startChapterId)
        await $adv.runtime.go({ chapterId: message.startChapterId, nodeId: $adv.store.program!.chapters[message.startChapterId].entry })
      else
        await $adv.runtime.start()
      ready.value = true
      postToHost({ type: 'loaded', chapterId: $adv.store.state.cursor.chapterId, nodeId: $adv.store.state.cursor.nodeId, elapsedMs: Math.round(performance.now() - started) })
      reportState()
      break
    }
    case 'advance':
      await $adv.runtime.next()
      break
    case 'choose': {
      const choice = currentChoices()[message.index]
      if (!choice)
        throw new Error(`No choice at index ${message.index}`)
      await $adv.runtime.choose(choice.id)
      break
    }
    case 'activity.complete':
      await $adv.runtime.completeActivity(message.result as JsonObject)
      break
    case 'snapshot.request':
      postToHost({ type: 'snapshot', requestId: message.requestId, snapshot: $adv.runtime.snapshot() })
      break
    case 'restore': {
      $adv.runtime.restore(message.snapshot)
      await nextTick()
      postToHost({ type: 'restored', requestId: message.requestId, chapterId: $adv.store.state.cursor.chapterId, nodeId: $adv.store.state.cursor.nodeId, status: $adv.store.state.status })
      break
    }
    case 'probe':
      postToHost({ type: 'probe', requestId: message.requestId, report: probe() })
      break
    case 'pause':
      $adv.$auto.stop()
      $adv.$audio.pause()
      break
    case 'resume':
      await $adv.$audio.resume()
      break
  }
})

window.addEventListener('error', (event) => {
  postToHost({ type: 'error', message: `${event.message} @ ${event.filename}:${event.lineno}` })
})
window.addEventListener('unhandledrejection', (event) => {
  postToHost({ type: 'error', message: `unhandled rejection: ${String(event.reason?.message ?? event.reason)}` })
})

onBeforeUnmount(() => {
  $adv.$audio.dispose()
  $adv.runtime.dispose()
})

postToHost({
  type: 'ready',
  protocol: PLAYER_PROTOCOL_VERSION,
  secureContext: isSecureContext,
  hasSubtleCrypto: typeof crypto?.subtle?.digest === 'function',
  userAgent: navigator.userAgent,
})
</script>

<template>
  <AdvGame v-if="ready" class="native-player" />
</template>

<style>
.native-player {
  width: 100%;
  height: 100%;
}
</style>
