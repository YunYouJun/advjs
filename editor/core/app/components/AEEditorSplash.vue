<script setup lang="ts">
defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const progress = ref(0)
const statusText = ref('initializing')

const stages = [
  { target: 20, text: 'initializing' },
  { target: 50, text: 'loading' },
  { target: 80, text: 'preparing' },
  { target: 95, text: 'almostReady' },
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
      class="flex flex-col items-center inset-0 justify-center fixed z-9999"
      style="background: #1a1a2e;"
    >
      <!-- Logo area -->
      <div class="mb-10 flex flex-col gap-3 items-center">
        <img
          src="/favicon.svg"
          alt="ADV.JS"
          class="h-16 w-16"
          style="filter: drop-shadow(0 0 20px rgba(30, 144, 255, 0.3));"
        >
        <div class="flex gap-2 items-center">
          <span
            class="text-3xl tracking-wide font-bold"
            style="color: #e0e0e0; letter-spacing: 0.05em;"
          >
            ADV.JS
          </span>
          <span
            class="text-lg font-light"
            style="color: rgba(255,255,255,0.5);"
          >
            {{ $t('splash.editor') }}
          </span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="flex flex-col gap-3 w-80 items-center">
        <div
          class="rounded-full h-1 w-full overflow-hidden"
          style="background: rgba(255,255,255,0.1);"
        >
          <div
            class="rounded-full h-full transition-none"
            style="background: dodgerblue;"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <div
          class="text-xs"
          style="color: rgba(255,255,255,0.45);"
        >
          {{ $t(`splash.${statusText}`) }}
        </div>
      </div>

      <!-- Version -->
      <div
        class="text-xs bottom-6 right-6 absolute"
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
