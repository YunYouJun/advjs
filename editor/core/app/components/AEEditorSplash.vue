<script setup lang="ts">
defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const progress = ref(0)
const statusText = ref('Initializing editor...')

const stages = [
  { target: 20, text: 'Initializing editor...' },
  { target: 50, text: 'Loading core modules...' },
  { target: 80, text: 'Preparing workspace...' },
  { target: 95, text: 'Almost ready...' },
]

let animationFrame: number | null = null

function animateProgress(from: number, to: number, text: string, duration: number): Promise<void> {
  return new Promise((resolve) => {
    statusText.value = text
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
  await animateProgress(current, 100, 'Ready', 100)
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
        <img
          src="/favicon.svg"
          alt="ADV.JS"
          class="h-16 w-16"
          style="filter: drop-shadow(0 0 20px rgba(30, 144, 255, 0.3));"
        >
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
