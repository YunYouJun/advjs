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
      class="fixed inset-0 z-9999 flex flex-col items-center justify-center"
      style="background: #1a1a2e;"
    >
      <!-- Logo area -->
      <div class="mb-10 flex flex-col items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          role="img"
          aria-label="ADV.JS"
          class="h-16 w-16"
          style="color: dodgerblue; filter: drop-shadow(0 0 20px rgba(30, 144, 255, 0.3));"
        >
          <path fill="currentColor" d="M14 10.25L17 8v6l-3-2.25V14H7V8h7v2.25zM5.763 17H20V5H4v13.385L5.763 17zm.692 2L2 22.5V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.455z" />
        </svg>
        <div class="flex items-center gap-2">
          <span
            class="text-3xl font-bold tracking-wide"
            style="color: #e0e0e0; letter-spacing: 0.05em;"
          >
            ADV.JS
          </span>
          <span
            class="text-lg font-light"
            style="color: rgba(255,255,255,0.5);"
          >
            Editor
          </span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="w-80 flex flex-col items-center gap-3">
        <div
          class="h-1 w-full overflow-hidden rounded-full"
          style="background: rgba(255,255,255,0.1);"
        >
          <div
            class="h-full rounded-full transition-none"
            style="background: dodgerblue;"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <div
          class="text-xs"
          style="color: rgba(255,255,255,0.45);"
        >
          {{ statusText }}
        </div>
      </div>

      <!-- Version -->
      <div
        class="absolute bottom-6 right-6 text-xs"
        style="color: rgba(255,255,255,0.2);"
      >
        v0.1.1
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ae-splash-fade-leave-active {
  transition: opacity 0.3s ease;
}

.ae-splash-fade-leave-to {
  opacity: 0;
}
</style>
