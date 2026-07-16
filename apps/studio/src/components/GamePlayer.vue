<script setup lang="ts">
import type { AdvContext } from '@advjs/client'
import type { AdvConfig, AdvFountainNode, AdvGameConfig, RuntimeChoice, RuntimeNode, RuntimeSnapshot } from '@advjs/types'
import { injectionAdvContext } from '@advjs/client'
import AdvGame from '@advjs/client/components/game/AdvGame.vue'
import { setupAdvContext } from '@advjs/client/setup/context'
import { IonButton, onIonViewDidEnter } from '@ionic/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayProgress } from '../composables/usePlayProgress'
import { useRuntimeInspector } from '../composables/useRuntimeInspector'
import { useStudioAdvConfig } from '../composables/useStudioAdvConfig'
import { useStudioStore } from '../stores/useStudioStore'

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
const $adv: AdvContext = setupAdvContext({
  config,
  gameConfig,
  themeConfig,
  fetcher: fetchChapter,
})
provide(injectionAdvContext, $adv)

const ready = shallowRef(false)
const error = shallowRef('')
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
const unlockedCGs = progress.unlockedCGs
const inspector = useRuntimeInspector(
  () => $adv.runtime.snapshot(),
  () => $adv.store.current,
)

watch(currentIndex, (order) => {
  if (!ready.value || !props.chapterFile || order < 0)
    return
  const wasVisited = progress.isVisited(props.chapterFile, order)
  progress.markVisit(props.chapterFile, order)
  if (!wasVisited && $adv.$auto.skipEnabled.value)
    $adv.$auto.skipEnabled.value = false
})

watch(() => $adv.store.state.stage.background, (background) => {
  if (ready.value && background)
    progress.unlockCG(background)
})

watch(currentChapterId, (chapterId) => {
  const file = chapterFileForId(chapterId)
  if (ready.value && file)
    emit('chapterChange', file)
})

watch(() => $adv.store.status.isEnd, (ended) => {
  if (ended)
    emit('ended')
})

async function goToChapter(chapterFile?: string) {
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
    await nextTick()
    await $adv.init()
    await goToChapter(props.chapterFile)
    ready.value = true
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

onIonViewDidEnter(initGame)
onMounted(() => {
  setTimeout(() => {
    if (!initStarted)
      initGame()
  }, 700)
})
onBeforeUnmount(() => {
  $adv.runtime.dispose()
  dispose()
})

watch(() => props.chapterFile, async (chapterId) => {
  if (ready.value && chapterId && chapterId !== currentChapterId.value)
    await goToChapter(chapterId)
})

function getCurrentSnapshot() {
  const runtime = $adv.runtime.snapshot()
  const node = $adv.store.current
  return {
    runtime,
    chapterFile: chapterFileForId(runtime.state.cursor.chapterId) ?? runtime.state.cursor.chapterId,
    order: currentIndex.value,
    totalNodes: totalNodes.value,
    chapterTitle: currentChapter.value?.title ?? props.chapterName,
    previewText: typeof node?.data?.text === 'string' ? node.data.text.slice(0, 80) : undefined,
    background: runtime.state.stage.background,
    tachies: new Map(Object.entries(runtime.state.stage.tachies)),
  }
}

function rollback(steps = 1): number | null {
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

function goToNode(index: number) {
  const chapter = currentChapter.value
  const nodeId = chapter?.order[index]
  if (chapter && nodeId)
    return $adv.runtime.go({ chapterId: chapter.id, nodeId })
}

function restore(snapshot: RuntimeSnapshot) {
  return $adv.runtime.restore(snapshot)
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
  inspector,
  getCurrentSnapshot,
  rollback,
  hydrateProgress: progress.hydrate,
})
</script>

<template>
  <div class="game-player">
    <div v-if="!ready && !error" class="game-player__center">
      <div class="game-player__spinner" />
      <p>{{ t('preview.loadingGame') }}</p>
    </div>

    <div v-else-if="error" class="game-player__center game-player__error">
      <p>{{ error }}</p>
      <IonButton size="small" fill="outline" @click="restart">
        {{ t('preview.restart') }}
      </IonButton>
    </div>

    <AdvGame v-if="ready" class="game-player__game" />

    <details v-if="ready" class="runtime-inspector">
      <summary>Runtime</summary>
      <pre>{{ inspector }}</pre>
    </details>

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

.game-player__error {
  color: #f87171;
}

.game-player__footer {
  position: absolute;
  bottom: 12px;
  left: 16px;
  color: rgb(255 255 255 / 40%);
  pointer-events: none;
}

.runtime-inspector {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 12;
  max-width: min(420px, 70vw);
  max-height: 50%;
  padding: 6px 10px;
  overflow: auto;
  border-radius: 8px;
  background: rgb(0 0 0 / 75%);
  color: #d1d5db;
  font-size: 11px;
}

.runtime-inspector pre {
  white-space: pre-wrap;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
