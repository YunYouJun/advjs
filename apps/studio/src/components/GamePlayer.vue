<script setup lang="ts">
import type { AdvAst } from '@advjs/types'
import { parseAst } from '@advjs/parser'
import { IonButton } from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  /** Raw .adv.md content to play */
  content?: string
  /** Chapter file name */
  chapterName?: string
}>()

const emit = defineEmits<{
  ended: []
}>()

const { t } = useI18n()

const ast = ref<AdvAst.Root>()
const currentIndex = ref(0)
const isLoading = ref(false)
const error = ref('')

// Touch swipe support
const touchStartX = ref(0)
const touchStartY = ref(0)
const SWIPE_THRESHOLD = 50

// Parse content into AST
watch(() => props.content, async (content) => {
  if (!content) {
    ast.value = undefined
    return
  }

  isLoading.value = true
  error.value = ''
  currentIndex.value = 0

  try {
    ast.value = await parseAst(content)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    ast.value = undefined
  }
  finally {
    isLoading.value = false
  }
}, { immediate: true })

const totalNodes = computed(() => ast.value?.children.length ?? 0)

const currentNode = computed(() => {
  if (!ast.value || currentIndex.value >= ast.value.children.length)
    return null
  return ast.value.children[currentIndex.value]
})

const isEnded = computed(() => {
  return ast.value && currentIndex.value >= ast.value.children.length
})

const progress = computed(() => {
  if (!totalNodes.value)
    return 0
  return Math.round((currentIndex.value / totalNodes.value) * 100)
})

/**
 * Extract text from phrasing content
 */
function phrasingToText(children: AdvAst.PhrasingContent[]): string {
  return children.map((c) => {
    if (c.type === 'text')
      return c.value
    if (c.type === 'link')
      return `[${phrasingToText((c as unknown as AdvAst.Link).children)}]`
    return ''
  }).join('')
}

/** Renderable nodes list with preview info for NodeSelector */
const renderableNodes = computed(() => {
  if (!ast.value)
    return []

  return ast.value.children.map((node, index) => {
    let type = node.type
    let preview = ''

    if (node.type === 'dialog') {
      const dialog = node as AdvAst.Dialog
      const text = phrasingToText(dialog.children)
      preview = `${dialog.character.name}: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`
    }
    else if (node.type === 'narration') {
      const narration = node as AdvAst.Narration
      const text = narration.children.join(' ')
      preview = text.slice(0, 30) + (text.length > 30 ? '...' : '')
    }
    else if (node.type === 'choices') {
      const choices = node as AdvAst.Choices
      const texts = choices.choices.map(c => c.text)
      preview = `${texts.join(' / ').slice(0, 40)}`
    }
    else if (node.type === 'paragraph') {
      const para = node as AdvAst.Paragraph
      const texts = para.children.map((c) => {
        if (c.type === 'dialog') {
          const d = c as AdvAst.Dialog
          return `${d.character.name}: ${phrasingToText(d.children)}`
        }
        if (c.type === 'text')
          return (c as AdvAst.Text).value
        return ''
      }).join(' ')
      preview = texts.slice(0, 30) + (texts.length > 30 ? '...' : '')
    }
    else if (node.type === 'text') {
      const text = (node as AdvAst.Text).value
      preview = text.slice(0, 30) + (text.length > 30 ? '...' : '')
    }
    else {
      type = node.type
      preview = `[${node.type}]`
    }

    return { index, type, preview }
  })
})

function next() {
  if (!ast.value)
    return

  currentIndex.value++

  // Skip non-renderable nodes (scene, code, unknown)
  while (currentIndex.value < ast.value.children.length) {
    const node = ast.value.children[currentIndex.value]
    if (node.type === 'scene' || node.type === 'code' || node.type === 'unknown') {
      currentIndex.value++
    }
    else {
      break
    }
  }

  if (currentIndex.value >= ast.value.children.length)
    emit('ended')
}

function goToNode(index: number) {
  currentIndex.value = Math.max(0, Math.min(index, totalNodes.value - 1))
}

function restart() {
  currentIndex.value = 0
}

function handleChoice(_choice: AdvAst.Choice) {
  // For now, just advance to next node
  next()
}

function prev() {
  if (!ast.value || currentIndex.value <= 0)
    return
  currentIndex.value--
  // Skip non-renderable nodes backwards
  while (currentIndex.value > 0) {
    const node = ast.value.children[currentIndex.value]
    if (node.type === 'scene' || node.type === 'code' || node.type === 'unknown')
      currentIndex.value--
    else
      break
  }
}

// Click anywhere on the game area to advance (except choices)
function handleAreaClick() {
  if (currentNode.value?.type !== 'choices' && !isEnded.value)
    next()
}

function handleTouchStart(e: TouchEvent) {
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}

function handleTouchEnd(e: TouchEvent) {
  const deltaX = e.changedTouches[0].clientX - touchStartX.value
  const deltaY = e.changedTouches[0].clientY - touchStartY.value

  // Only trigger swipe if horizontal movement dominates
  if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY))
    return

  if (deltaX < 0) {
    // Swipe left → next
    if (currentNode.value?.type !== 'choices' && !isEnded.value)
      next()
  }
  else {
    // Swipe right → prev
    prev()
  }
}

function handleProgressClick(e: MouseEvent) {
  if (!ast.value)
    return
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const targetIndex = Math.round(ratio * (totalNodes.value - 1))
  goToNode(targetIndex)
}

defineExpose({ goToNode, restart, next, prev, renderableNodes, currentIndex })
</script>

<template>
  <div
    class="game-player"
    @click="handleAreaClick"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
  >
    <!-- Loading -->
    <div v-if="isLoading" class="game-player__center">
      <div class="game-player__spinner" />
      <p>{{ t('preview.loadingGame') }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="game-player__center game-player__error">
      <p>{{ error }}</p>
    </div>

    <!-- No content -->
    <div v-else-if="!ast" class="game-player__center">
      <p>{{ t('preview.emptyDescription') }}</p>
    </div>

    <!-- Game ended -->
    <Transition name="gp-fade-up" appear>
      <div v-if="ast && isEnded" class="game-player__center">
        <p class="game-player__end-text">
          — END —
        </p>
        <IonButton size="small" fill="outline" @click.stop="restart">
          {{ t('preview.restart') }}
        </IonButton>
      </div>
    </Transition>

    <!-- Game view -->
    <template v-if="ast && !isEnded && currentNode">
      <!-- Background layer -->
      <div class="game-player__bg" />

      <!-- Dialog node -->
      <Transition name="gp-dialog" mode="out-in" appear>
        <div v-if="currentNode.type === 'dialog'" :key="`dialog-${currentIndex}`" class="game-player__dialog-box">
          <div class="game-player__character-name">
            {{ (currentNode as AdvAst.Dialog).character.name }}
          </div>
          <div class="game-player__name-divider" />
          <div class="game-player__dialog-text">
            {{ phrasingToText((currentNode as AdvAst.Dialog).children) }}
          </div>
        </div>

        <!-- Narration node -->
        <div v-else-if="currentNode.type === 'narration'" :key="`narration-${currentIndex}`" class="game-player__narration-box gp-narration-enter">
          <div class="game-player__narration-text">
            <p v-for="(line, i) in (currentNode as AdvAst.Narration).children" :key="i">
              {{ line }}
            </p>
          </div>
        </div>

        <!-- Paragraph node (may contain text or dialogs) -->
        <div v-else-if="currentNode.type === 'paragraph'" :key="`para-${currentIndex}`" class="game-player__dialog-box">
          <template v-for="(child, i) in (currentNode as AdvAst.Paragraph).children" :key="i">
            <div v-if="child.type === 'dialog'" class="game-player__dialog-inline">
              <div class="game-player__character-name">
                {{ (child as AdvAst.Dialog).character.name }}
              </div>
              <div class="game-player__name-divider" />
              <div class="game-player__dialog-text">
                {{ phrasingToText((child as AdvAst.Dialog).children) }}
              </div>
            </div>
            <div v-else-if="child.type === 'text'" class="game-player__dialog-text">
              {{ (child as AdvAst.Text).value }}
            </div>
          </template>
        </div>

        <!-- Choices node -->
        <div v-else-if="currentNode.type === 'choices'" :key="`choices-${currentIndex}`" class="game-player__choices-box" @click.stop>
          <IonButton
            v-for="(choice, i) in (currentNode as AdvAst.Choices).choices"
            :key="i"
            expand="block"
            fill="outline"
            class="game-player__choice-btn"
            @click="handleChoice(choice)"
          >
            {{ choice.text }}
          </IonButton>
        </div>

        <!-- Text node -->
        <div v-else-if="currentNode.type === 'text'" :key="`text-${currentIndex}`" class="game-player__dialog-box">
          <div class="game-player__dialog-text">
            {{ (currentNode as AdvAst.Text).value }}
          </div>
        </div>

        <!-- Fallback for other node types -->
        <div v-else :key="`other-${currentIndex}`" class="game-player__dialog-box">
          <div class="game-player__dialog-text game-player__dialog-text--muted">
            [{{ currentNode.type }}]
          </div>
        </div>
      </Transition>

      <!-- Footer: chapter name + progress -->
      <div class="game-player__footer">
        <Transition name="gp-fade" mode="out-in">
          <span v-if="chapterName" :key="chapterName" class="game-player__chapter-name">{{ chapterName }}</span>
        </Transition>
        <span class="game-player__progress">{{ currentIndex + 1 }}/{{ totalNodes }}</span>
      </div>
    </template>

    <!-- Progress bar (bottom, clickable) -->
    <div v-if="ast" class="game-player__progress-bar" @click.stop="handleProgressClick">
      <div class="game-player__progress-fill" :style="{ width: `${progress}%` }" />
    </div>
  </div>
</template>

<style scoped>
.game-player {
  width: 100%;
  height: 100%;
  position: relative;
  background: #1a1a2e;
  color: #eee;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
}

.game-player__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
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

.game-player__end-text {
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.5);
}

/* Background */
.game-player__bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
}

/* Dialog box */
.game-player__dialog-box {
  position: absolute;
  bottom: 48px;
  left: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 16px 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 100px;
}

.game-player__character-name {
  font-size: 14px;
  font-weight: 700;
  color: #60a5fa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.game-player__name-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 8px 0;
}

.game-player__dialog-text {
  font-size: 16px;
  line-height: 1.7;
  color: #f0f0f0;
}

.game-player__dialog-text--muted {
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

.game-player__dialog-inline {
  margin-bottom: 8px;
}

.game-player__dialog-inline:last-child {
  margin-bottom: 0;
}

/* Narration box */
.game-player__narration-box {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: rgba(0, 0, 0, 0.85);
}

.game-player__narration-text {
  text-align: center;
  font-size: 18px;
  line-height: 2;
  color: rgba(255, 255, 255, 0.9);
  max-width: 600px;
}

.game-player__narration-text p {
  margin: 0 0 8px;
}

/* Choices */
.game-player__choices-box {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(320px, calc(100% - 32px));
  cursor: default;
}

.game-player__choice-btn {
  --border-radius: 8px;
  --color: #f0f0f0;
  --border-color: rgba(255, 255, 255, 0.3);
  --background-hover: rgba(96, 165, 250, 0.2);
  transition: box-shadow 0.2s ease;
}

.game-player__choice-btn:hover {
  box-shadow: 0 0 12px rgba(96, 165, 250, 0.3);
}

/* Footer */
.game-player__footer {
  position: absolute;
  bottom: 16px;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
}

.game-player__chapter-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.game-player__progress {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  font-variant-numeric: tabular-nums;
}

/* Progress bar (bottom, clickable) */
.game-player__progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  z-index: 10;
}

.game-player__progress-fill {
  height: 100%;
  background: var(--ion-color-primary);
  transition: width 0.3s ease;
}

/* Transition: dialog slide up + fade */
.gp-dialog-enter-active,
.gp-dialog-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.gp-dialog-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.gp-dialog-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Transition: fade + float up (for END screen) */
.gp-fade-up-enter-active {
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;
}

.gp-fade-up-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

/* Transition: simple fade (for chapter name) */
.gp-fade-enter-active,
.gp-fade-leave-active {
  transition: opacity 0.3s ease;
}

.gp-fade-enter-from,
.gp-fade-leave-to {
  opacity: 0;
}

/* Mobile */
@media (max-width: 767px) {
  .game-player__dialog-box {
    bottom: 40px;
    left: 8px;
    right: 8px;
    padding: 12px 16px;
    min-height: 80px;
  }

  .game-player__narration-text {
    font-size: 16px;
    padding: 12px;
  }

  .game-player__dialog-text {
    font-size: 15px;
  }
}
</style>
