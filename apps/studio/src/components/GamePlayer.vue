<script setup lang="ts">
import type { AdvContext } from '@advjs/client'
import type { AdvConfig, AdvFountainNode, AdvGameConfig, JsonObject, JsonValue, RuntimeAddress, RuntimeChoice, RuntimeNode, RuntimeSnapshot, RuntimeStatus } from '@advjs/types'
import { injectionAdvContext } from '@advjs/client'
import AdvGame from '@advjs/client/components/game/AdvGame.vue'
import { setupAdvContext } from '@advjs/client/setup/context'
import { derivePresentationState, runtimeConditionMatches } from '@advjs/core'
import { onIonViewDidEnter } from '@ionic/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayProgress } from '../composables/usePlayProgress'
import { useRuntimeInspector } from '../composables/useRuntimeInspector'
import { useStudioAdvConfig } from '../composables/useStudioAdvConfig'
import { useStudioStore } from '../stores/useStudioStore'
import { createStudioRuntimePlugins } from '../utils/studioRuntimePlugins'
import RuntimeDiagnosticsOverlay from './RuntimeDiagnosticsOverlay.vue'
import RuntimeInspectorDrawer from './RuntimeInspectorDrawer.vue'

const props = defineProps<{
  chapterName?: string
  chapterFile?: string
}>()

const emit = defineEmits<{
  ended: []
  chapterChange: [chapterId: string]
}>()

const { t } = useI18n()
const studioStore = useStudioStore()
const progress = usePlayProgress(() => studioStore.currentProject?.projectId)

function createSessionStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

const galleryStorage = createSessionStorage()
const {
  gameConfigRef,
  configRef,
  refresh,
  fetchChapter,
  chapterIdForFile,
  chapterFileForId,
  dispose,
} = useStudioAdvConfig()

const config = computed<AdvConfig>(() => configRef.value as AdvConfig)
const gameConfig = computed<AdvGameConfig>(() => gameConfigRef.value as AdvGameConfig)
const themeConfig = computed(() => ({} as Record<string, string | number>))
const runtimePlugins = createStudioRuntimePlugins()
const $adv: AdvContext = setupAdvContext({
  config,
  gameConfig,
  themeConfig,
  fetcher: fetchChapter,
  runtimePlugins,
  progressionStorage: false,
  galleryStorage,
})
provide(injectionAdvContext, $adv)

const ready = shallowRef(false)
const error = shallowRef('')
const runtimeInspectorOpen = shallowRef(false)
const runtimeRevision = shallowRef(0)
const previewVariables = shallowRef<JsonObject>({})
const authoringSeekActive = shallowRef(false)
let authoringSeekOrigin: RuntimeSnapshot | undefined
let authoringSeekTarget: RuntimeAddress | undefined
const stopRuntimeTrace = $adv.runtime.subscribeTrace(() => {
  runtimeRevision.value += 1
})
const currentChapterId = computed(() => $adv.store.state.cursor.chapterId)
const currentChapter = computed(() => $adv.store.program?.chapters[currentChapterId.value])

function nodePreview(node: RuntimeNode): string {
  const text = typeof node.data?.text === 'string' ? node.data.text : ''
  const character = typeof node.data?.character === 'string' ? node.data.character : ''
  if (text)
    return `${character ? `${character}: ` : ''}${text.slice(0, 40)}`
  const options = node.data?.options
  if (Array.isArray(options)) {
    return (options as unknown as RuntimeChoice[])
      .map(choice => choice.label)
      .join(' / ')
      .slice(0, 40)
  }
  return `[${node.kind}]`
}

const renderableNodes = computed(() => {
  const chapter = currentChapter.value
  if (!chapter)
    return []
  return chapter.order.flatMap((id, index) => {
    const node = chapter.nodes[id]
    if (!node || node.kind === 'end')
      return []
    return [{ index, type: node.kind, preview: nodePreview(node) }]
  })
})

const currentIndex = computed(() => {
  return currentChapter.value?.order.indexOf($adv.store.state.cursor.nodeId) ?? -1
})
const totalNodes = computed(() => currentChapter.value?.order.length ?? 0)
const currentChapterAst = computed(() => {
  const chapter = gameConfigRef.value.chapters?.find(item => item.id === currentChapterId.value)
  const fountain = chapter?.nodes.find(node => node.type === 'fountain') as AdvFountainNode | undefined
  return fountain?.ast
})
const visitedOrders = computed(() => {
  const chapter = currentChapter.value
  if (!chapter)
    return []
  return $adv.store.state.visited.flatMap((address) => {
    const prefix = `${chapter.id}#`
    if (!address.startsWith(prefix))
      return []
    const index = chapter.order.indexOf(address.slice(prefix.length))
    return index >= 0 ? [index] : []
  })
})
const historyStack = computed(() => {
  const chapter = currentChapter.value
  const currentNodeId = $adv.store.state.cursor.nodeId
  if (!chapter || !currentNodeId)
    return []
  return $adv.runtime.snapshot().checkpoints.flatMap((checkpoint) => {
    if (checkpoint.state.cursor.chapterId !== chapter.id)
      return []
    const index = chapter.order.indexOf(checkpoint.state.cursor.nodeId)
    return index >= 0 ? [index] : []
  })
})
const unlockedCGs = computed<string[]>(() => [...($adv.gallery?.unlocked.value ?? [])])
const galleryItems = computed(() => gameConfig.value.gallery?.items ?? [])
const runtimeSnapshot = computed(() => {
  void runtimeRevision.value
  return $adv.runtime.snapshot()
})
const runtimeTrace = computed(() => {
  void runtimeRevision.value
  return $adv.runtime.trace()
})
const currentRuntimeNode = computed(() => $adv.store.current)
const compileDiagnostics = $adv.compileDiagnostics
const reportDiagnostics = computed<JsonValue[]>(() => compileDiagnostics.value.map(diagnostic => ({
  code: diagnostic.code,
  severity: diagnostic.severity,
  message: diagnostic.message,
  ...(diagnostic.source ? { source: { ...diagnostic.source } } : {}),
})))
const inspector = useRuntimeInspector(
  () => runtimeSnapshot.value,
  () => currentRuntimeNode.value,
  () => runtimeTrace.value,
)

watch(currentIndex, (order) => {
  if (!ready.value || authoringSeekActive.value || !props.chapterFile || order < 0)
    return
  const wasVisited = progress.isVisited(props.chapterFile, order)
  progress.markVisit(props.chapterFile, order)
  if (!wasVisited && $adv.$auto.skipEnabled.value)
    $adv.$auto.skipEnabled.value = false
})

watch(currentChapterId, (chapterId) => {
  const file = chapterFileForId(chapterId)
  if (ready.value && file)
    emit('chapterChange', file)
})

watch(() => $adv.store.status.isEnd, (ended) => {
  if (ended && !authoringSeekActive.value)
    emit('ended')
})

async function goToChapter(chapterFile?: string) {
  if (authoringSeekOrigin)
    $adv.runtime.restore(authoringSeekOrigin)
  authoringSeekActive.value = false
  authoringSeekOrigin = undefined
  authoringSeekTarget = undefined
  const program = $adv.store.program
  if (!program)
    return
  const chapterId = chapterFile ? chapterIdForFile(chapterFile) : undefined
  const chapter = chapterId ? program.chapters[chapterId] : undefined
  if (chapter) {
    await $adv.runtime.go({ chapterId: chapter.id, nodeId: chapter.entry })
    return
  }
  await $adv.runtime.start()
}

let initStarted = false
async function initGame() {
  if (initStarted)
    return
  initStarted = true
  try {
    await refresh()
    previewVariables.value = structuredClone(gameConfigRef.value.variables ?? {})
    await nextTick()
    await $adv.init()
    await goToChapter(props.chapterFile)
    ready.value = true
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

async function retryInit() {
  initStarted = false
  ready.value = false
  error.value = ''
  compileDiagnostics.value = []
  await initGame()
}

onIonViewDidEnter(initGame)
onMounted(() => {
  setTimeout(() => {
    if (!initStarted)
      initGame()
  }, 700)
})
onBeforeUnmount(() => {
  stopRuntimeTrace()
  $adv.$bgm.dispose()
  $adv.runtime.dispose()
  dispose()
})

watch(() => props.chapterFile, async (chapterId) => {
  if (ready.value && chapterId && chapterId !== currentChapterId.value)
    await goToChapter(chapterId)
})

function getCurrentSnapshot() {
  const runtime = authoringSeekOrigin ?? $adv.runtime.snapshot()
  const chapter = $adv.store.program?.chapters[runtime.state.cursor.chapterId]
  const node = chapter?.nodes[runtime.state.cursor.nodeId]
  const order = chapter?.order.indexOf(runtime.state.cursor.nodeId) ?? -1
  return {
    runtime,
    chapterFile: chapterFileForId(runtime.state.cursor.chapterId) ?? runtime.state.cursor.chapterId,
    order,
    totalNodes: chapter?.order.length ?? 0,
    chapterTitle: chapter?.title ?? props.chapterName,
    previewText: typeof node?.data?.text === 'string' ? node.data.text.slice(0, 80) : undefined,
    background: runtime.state.stage.background,
    tachies: new Map(Object.entries(runtime.state.stage.tachies)),
  }
}

function rollback(steps = 1): number | null {
  if (authoringSeekActive.value)
    return null
  try {
    for (let index = 0; index < steps; index++)
      $adv.runtime.back()
    return currentIndex.value
  }
  catch {
    return null
  }
}

function next() {
  return $adv.runtime.next()
}

function prev() {
  return rollback()
}

async function restart() {
  error.value = ''
  await goToChapter(props.chapterFile)
}

const silentPreviewKinds = new Set(['anchor', 'scene', 'effects', 'actions'])
const previewDiagnosticCodes = new Set([
  'ADV_RUNTIME_PREVIEW_SCENE_BASELINE_MISSING',
  'ADV_RUNTIME_PREVIEW_BACKGROUND_MISSING',
  'ADV_RUNTIME_PREVIEW_DERIVATION_FAILED',
])

function previewCursor(chapter: NonNullable<typeof currentChapter.value>, startIndex: number): RuntimeAddress {
  for (let index = startIndex; index < chapter.order.length; index++) {
    const nodeId = chapter.order[index]
    const node = chapter.nodes[nodeId]
    if (!node || !runtimeConditionMatches(node.when, previewVariables.value))
      continue
    if (!silentPreviewKinds.has(node.kind))
      return { chapterId: chapter.id, nodeId }
  }
  return { chapterId: chapter.id, nodeId: chapter.order.at(-1) ?? chapter.entry }
}

function previewStatus(node: RuntimeNode | undefined): RuntimeStatus {
  if (node?.kind === 'choices')
    return 'waiting-choice'
  if (node?.kind === 'end')
    return 'ended'
  return 'playing'
}

function clearPreviewDiagnostics() {
  $adv.compileDiagnostics.value = $adv.compileDiagnostics.value.filter(item => (
    !previewDiagnosticCodes.has(item.code)
  ))
}

function seekToAddress(target: RuntimeAddress) {
  const program = $adv.store.program
  const chapter = program?.chapters[target.chapterId]
  const index = chapter?.order.indexOf(target.nodeId) ?? -1
  if (!program || !chapter || index < 0)
    return

  const origin = authoringSeekOrigin ?? $adv.runtime.snapshot()
  let cursor: RuntimeAddress
  let derived: ReturnType<typeof derivePresentationState>
  try {
    cursor = previewCursor(chapter, index)
    derived = derivePresentationState(program, cursor, previewVariables.value)
  }
  catch (cause) {
    clearPreviewDiagnostics()
    $adv.compileDiagnostics.value = [
      ...$adv.compileDiagnostics.value,
      {
        code: 'ADV_RUNTIME_PREVIEW_DERIVATION_FAILED',
        severity: 'error',
        message: cause instanceof Error ? cause.message : String(cause),
      },
    ]
    return
  }
  authoringSeekOrigin ??= origin
  const snapshot: RuntimeSnapshot = {
    ...structuredClone(origin),
    state: {
      status: previewStatus(chapter.nodes[cursor.nodeId]),
      cursor,
      variables: structuredClone(previewVariables.value),
      stage: structuredClone(derived.stage),
      choices: [],
      visited: [`${cursor.chapterId}#${cursor.nodeId}`],
    },
    checkpoints: [],
    createdAt: Date.now(),
  }
  authoringSeekTarget = structuredClone(target)
  authoringSeekActive.value = true
  clearPreviewDiagnostics()
  $adv.compileDiagnostics.value = [
    ...$adv.compileDiagnostics.value,
    ...derived.diagnostics.map(item => ({
      code: item.code,
      severity: item.severity,
      message: item.message,
    })),
  ]
  return $adv.runtime.restore(snapshot)
}

function goToNode(index: number) {
  const chapter = currentChapter.value
  const nodeId = chapter?.order[index]
  if (chapter && nodeId)
    return seekToAddress({ chapterId: chapter.id, nodeId })
}

function exitAuthoringSeek() {
  if (!authoringSeekOrigin)
    return
  const snapshot = authoringSeekOrigin
  authoringSeekOrigin = undefined
  authoringSeekTarget = undefined
  authoringSeekActive.value = false
  clearPreviewDiagnostics()
  $adv.runtime.restore(snapshot)
}

function updatePreviewVariables(value: JsonObject) {
  previewVariables.value = structuredClone(value)
  if (authoringSeekActive.value && authoringSeekTarget)
    seekToAddress(authoringSeekTarget)
}

function restore(snapshot: RuntimeSnapshot) {
  return $adv.runtime.restore(snapshot)
}

function hydrateProgress(
  chapterFile: string,
  snapshot: { visitedOrders: number[], history: number[], unlockedCGs: string[] },
) {
  progress.hydrate(chapterFile, snapshot)
  for (const id of snapshot.unlockedCGs)
    $adv.gallery?.unlock(id)
}

defineExpose({
  goToNode,
  restart,
  next,
  prev,
  restore,
  renderableNodes,
  currentIndex,
  totalNodes,
  currentChapterAst,
  visitedOrders,
  historyStack,
  unlockedCGs,
  galleryItems,
  inspector,
  getCurrentSnapshot,
  rollback,
  hydrateProgress,
  authoringSeekActive,
  exitAuthoringSeek,
})
</script>

<template>
  <div class="game-player">
    <div v-if="!ready && !error" class="game-player__center">
      <div class="game-player__spinner" />
      <p>{{ t('preview.loadingGame') }}</p>
    </div>

    <RuntimeDiagnosticsOverlay
      v-else-if="error"
      :diagnostics="compileDiagnostics"
      :error="error"
      @retry="retryInit"
    />

    <AdvGame
      v-if="ready"
      class="game-player__game"
      :class="{ 'game-player__game--seek-preview': authoringSeekActive }"
    />

    <div v-if="ready && authoringSeekActive" class="authoring-seek-banner" role="status">
      <span>{{ t('runtimeInspector.seekPreview') }}</span>
      <button type="button" @click="exitAuthoringSeek">
        {{ t('runtimeInspector.returnToPlay') }}
      </button>
    </div>

    <button
      v-if="ready"
      type="button"
      class="runtime-inspector-button"
      @click="runtimeInspectorOpen = true"
    >
      {{ t('runtimeInspector.open') }}
      <span v-if="compileDiagnostics.length"> · {{ compileDiagnostics.length }}</span>
    </button>

    <RuntimeInspectorDrawer
      v-if="ready"
      :open="runtimeInspectorOpen"
      :snapshot="runtimeSnapshot"
      :current="currentRuntimeNode"
      :trace="runtimeTrace"
      :diagnostics="reportDiagnostics"
      :preview-variables="previewVariables"
      @close="runtimeInspectorOpen = false"
      @update-preview-variables="updatePreviewVariables"
    />

    <div v-if="chapterName" class="game-player__footer">
      {{ chapterName }}
    </div>
  </div>
</template>

<style scoped>
.game-player {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  color: #eee;
}

.game-player__game {
  width: 100%;
  height: 100%;
}

.game-player__game--seek-preview {
  pointer-events: none;
}

.authoring-seek-banner {
  position: absolute;
  z-index: 13;
  top: 12px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgb(125 211 252 / 45%);
  border-radius: 999px;
  background: rgb(2 6 23 / 88%);
  color: #bae6fd;
  font-size: 0.75rem;
  transform: translateX(-50%);
}

.authoring-seek-banner button {
  padding: 0.2rem 0.5rem;
  border: 0;
  border-radius: 999px;
  background: #0ea5e9;
  color: white;
  cursor: pointer;
}

.game-player__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
  align-items: center;
  justify-content: center;
  padding: var(--adv-space-lg);
  color: rgb(255 255 255 / 60%);
  text-align: center;
}

.game-player__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgb(255 255 255 / 20%);
  border-top-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.game-player__footer {
  position: absolute;
  bottom: 12px;
  left: 16px;
  color: rgb(255 255 255 / 40%);
  pointer-events: none;
}

.runtime-inspector-button {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 12;
  padding: 6px 10px;
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 999px;
  background: rgb(0 0 0 / 75%);
  color: #e2e8f0;
  cursor: pointer;
  font-size: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
