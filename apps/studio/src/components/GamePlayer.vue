<script setup lang="ts">
import type { AdvContext } from '@advjs/client'
import type { AdvConfig, AdvFountainNode, AdvGameConfig } from '@advjs/types'
import { injectionAdvContext } from '@advjs/client'
import AdvGame from '@advjs/client/components/game/AdvGame.vue'
import { setupAdvContext } from '@advjs/client/setup/context'
import { IonButton } from '@ionic/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStudioAdvConfig } from '../composables/useStudioAdvConfig'
import { buildRenderableNodes } from '../utils/advPreview'

const props = defineProps<{
  /** Raw .adv.md content (currently ignored — adapter reads from useProjectContent directly). Kept for API stability. */
  content?: string
  /** Chapter file name (e.g. "01"), used to navigate within the loaded gameConfig. */
  chapterName?: string
}>()

const emit = defineEmits<{
  ended: []
  /** Emitted when a choice targets a different chapter file. */
  loadChapter: [file: string]
}>()

const { t } = useI18n()

const { gameConfigRef, configRef, refresh, dispose } = useStudioAdvConfig()

const config = computed<AdvConfig>(() => configRef.value as AdvConfig)
const gameConfig = computed<AdvGameConfig>(() => gameConfigRef.value as AdvGameConfig)
const themeConfig = computed(() => ({} as Record<string, string | number>))

// Initialize context up-front; it stays valid for this component's lifetime.
const $adv: AdvContext = setupAdvContext({ config, gameConfig, themeConfig })
provide(injectionAdvContext, $adv)

const ready = ref(false)
const error = ref('')

const renderableNodes = computed(() => {
  const curChapter = $adv.store.curChapter
  if (!curChapter)
    return []
  const fountain = curChapter.nodes.find(n => n.type === 'fountain') as AdvFountainNode | undefined
  return buildRenderableNodes(fountain?.ast)
})

const currentIndex = computed(() => {
  const cur = $adv.store.curFlowNode
  return cur && cur.type === 'fountain' ? (cur.order ?? 0) : 0
})

async function startTargetChapter(chapterTitle: string | undefined) {
  const chapters = gameConfigRef.value.chapters
  if (!chapters?.length)
    return
  const target = (chapterTitle && chapters.find(c => c.title === chapterTitle)) || chapters[0]
  await $adv.$nav.start({ chapterId: target.id, nodeId: target.startNodeId! })
}

async function gotoTargetChapter(chapterTitle: string | undefined) {
  if (!ready.value)
    return
  const chapters = gameConfigRef.value.chapters
  if (!chapters?.length)
    return
  const target = chapterTitle ? chapters.find(c => c.title === chapterTitle) : null
  if (target)
    await $adv.$nav.go({ chapterId: target.id, nodeId: target.startNodeId! })
}

onMounted(async () => {
  try {
    await refresh()
    await nextTick() // Pixi needs the AdvGame canvas in the DOM
    await $adv.init()
    await startTargetChapter(props.chapterName)
    ready.value = true
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

watch(() => props.chapterName, async (name) => {
  if (ready.value)
    await gotoTargetChapter(name)
})

watch(() => $adv.store.status.isEnd, (ended) => {
  if (ended)
    emit('ended')
})

function next() {
  $adv.$nav.next()
}

function prev() {
  // AdvNav has no `prev` today; left as a noop so PlayPage button stays harmless.
}

async function restart() {
  await startTargetChapter(props.chapterName)
}

function goToNode(index: number) {
  const curChapter = $adv.store.curChapter
  if (!curChapter)
    return
  const fountain = curChapter.nodes.find(n => n.type === 'fountain') as AdvFountainNode | undefined
  if (!fountain)
    return
  $adv.$logic.goToFountainOrder(index)
}

onBeforeUnmount(() => dispose())

defineExpose({ goToNode, restart, next, prev, renderableNodes, currentIndex })
</script>

<template>
  <div class="game-player">
    <!-- Loading -->
    <div v-if="!ready && !error" class="game-player__center">
      <div class="game-player__spinner" />
      <p>{{ t('preview.loadingGame') }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="game-player__center game-player__error">
      <p>{{ error }}</p>
      <IonButton size="small" fill="outline" @click="restart">
        {{ t('preview.restart') }}
      </IonButton>
    </div>

    <!-- Game -->
    <AdvGame v-if="ready" class="game-player__game" />

    <!-- Footer chapter label (overlay) -->
    <div v-if="chapterName" class="game-player__footer">
      <span class="game-player__chapter-name">{{ chapterName }}</span>
    </div>
  </div>
</template>

<style scoped>
.game-player {
  width: 100%;
  height: 100%;
  position: relative;
  background: #000;
  color: #eee;
  overflow: hidden;
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
  align-items: center;
  justify-content: center;
  gap: var(--adv-space-md);
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  padding: var(--adv-space-lg);
}

.game-player__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.game-player__error {
  color: #f87171;
}

.game-player__footer {
  position: absolute;
  bottom: 12px;
  left: 16px;
  pointer-events: none;
  z-index: 1;
}

.game-player__chapter-name {
  font-size: var(--adv-font-caption);
  color: rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 10px;
  border-radius: var(--adv-radius-sm);
}
</style>
