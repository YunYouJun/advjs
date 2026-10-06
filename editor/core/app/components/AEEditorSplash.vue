<script setup lang="ts">
defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const { t } = useI18n()
const progress = ref(0)
const status = shallowRef('initializing')
const statusText = computed(() => t(`splash.${status.value}`))

const stages = [
  { target: 20, text: 'initializing' },
  { target: 50, text: 'modules' },
  { target: 80, text: 'workspace' },
  { target: 95, text: 'almostReady' },
]

let animationFrame: number | null = null

function animateProgress(from: number, to: number, text: string, duration: number): Promise<void> {
  return new Promise((resolve) => {
    status.value = text
    const start = performance.now()
    function step(now: number) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - (1 - t) ** 3
      progress.value = from + (to - from) * eased
      if (t < 1) {
        animationFrame = requestAnimationFrame(step)
      }
      else {
        resolve()
      }
    }
    animationFrame = requestAnimationFrame(step)
  })
}

async function runProgress() {
  let current = 0
  for (const stage of stages) {
    await animateProgress(current, stage.target, stage.text, 120 + Math.random() * 80)
    current = stage.target
  }
  // Final push to 100
  await animateProgress(current, 100, 'ready', 100)
  // Small delay before fade out
  await new Promise(r => setTimeout(r, 100))
  emit('complete')
}

onMounted(() => {
  runProgress()
})

onUnmounted(() => {
  if (animationFrame)
    cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <Transition name="ae-splash-fade">
    <div
      v-if="show"
      class="ae-editor-splash fixed inset-0 z-9999 flex flex-col items-center justify-center"
    >
      <!-- Logo area -->
      <div class="mb-10 flex flex-col items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          role="img"
          aria-label="ADV.JS"
          class="ae-splash-logo h-16 w-16"
        >
          <path fill="currentColor" d="M14 10.25L17 8v6l-3-2.25V14H7V8h7v2.25zM5.763 17H20V5H4v13.385L5.763 17zm.692 2L2 22.5V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.455z" />
        </svg>
        <div class="flex items-center gap-2">
          <span
            class="text-3xl font-bold tracking-wide"
            style="letter-spacing: 0.05em;"
          >
            ADV.JS
          </span>
          <span
            class="ae-splash-secondary text-lg font-light"
          >
            Editor
          </span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="w-80 flex flex-col items-center gap-3">
        <div
          class="ae-splash-track h-1 w-full overflow-hidden rounded-full"
        >
          <div
            class="ae-splash-progress h-full rounded-full transition-none"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <div
          class="ae-splash-secondary text-xs"
        >
          {{ statusText }}
        </div>
      </div>

      <!-- Version -->
      <div
        class="ae-splash-secondary absolute bottom-6 right-6 text-xs"
      >
        v0.1.1
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ae-editor-splash {
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg);
}

.ae-splash-logo {
  color: var(--agui-c-blue);
}

.ae-splash-secondary {
  color: var(--agui-c-text-2);
}

.ae-splash-track {
  background: var(--agui-c-bg-mute);
}

.ae-splash-progress {
  background: var(--agui-c-primary);
}

.ae-splash-fade-leave-active {
  transition: opacity 0.15s ease;
}

.ae-splash-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ae-splash-fade-leave-active {
    transition: none;
  }
}
</style>
