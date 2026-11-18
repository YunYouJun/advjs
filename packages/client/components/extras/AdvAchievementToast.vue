<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useAdvContext } from '../../composables/useAdvContext'
import { useExtrasI18n } from '../../composables/useExtrasI18n'

const { $adv } = useAdvContext()
const { t } = useExtrasI18n()
let timer: ReturnType<typeof setTimeout> | undefined

function dismiss() {
  $adv.extrasNotices.value = $adv.extrasNotices.value.slice(1)
}

// One toast at a time; each waits for the previous one to leave.
watch(() => $adv.extrasNotices.value[0], (notice) => {
  clearTimeout(timer)
  if (notice)
    timer = setTimeout(dismiss, 4200)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="adv-achievement-toast" aria-live="polite">
    <Transition name="adv-achievement-toast">
      <div v-if="$adv.extrasNotices.value[0]" :key="$adv.extrasNotices.value[0].id" class="adv-achievement-toast__card">
        <span class="adv-achievement-toast__mark" aria-hidden="true">◆</span>
        <div>
          <p>{{ t('toast.achievement') }}</p>
          <b>{{ $adv.extrasNotices.value[0].title }}</b>
          <small v-if="$adv.extrasNotices.value[0].description">{{ $adv.extrasNotices.value[0].description }}</small>
        </div>
        <button type="button" :aria-label="t('toast.dismiss')" @click.stop="dismiss">
          ×
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.adv-achievement-toast {
  position: absolute;
  z-index: 160;
  top: calc(max(10px, env(safe-area-inset-top, 0px)) + 52px);
  right: max(12px, env(safe-area-inset-right, 0px));
  pointer-events: none;
}

.adv-achievement-toast__card {
  display: grid;
  gap: 0.75rem;
  align-items: center;
  max-width: min(22rem, calc(100vw - 2rem));
  border: 1px solid rgb(246 201 107 / 60%);
  background: linear-gradient(100deg, rgb(246 201 107 / 16%), rgb(7 10 18 / 92%) 70%);
  padding: 0.7rem 0.8rem 0.7rem 1rem;
  color: #f3eee4;
  text-align: left;
  pointer-events: auto;
  grid-template-columns: auto minmax(0, 1fr) auto;
  backdrop-filter: blur(0.8rem);
}

.adv-achievement-toast__mark {
  color: #f6c96b;
  font-size: 1.1rem;
}

.adv-achievement-toast__card p {
  margin: 0;
  color: #f6c96b;
  font: 0.65rem/1.4 monospace;
  letter-spacing: 0.18em;
}

.adv-achievement-toast__card b {
  display: block;
  font: 600 0.95rem/1.4 serif;
}

.adv-achievement-toast__card small {
  display: block;
  color: #aeb8ce;
  font-size: 0.72rem;
}

.adv-achievement-toast__card button {
  border: 0;
  background: transparent;
  color: #aeb8ce;
  cursor: pointer;
  font-size: 1.1rem;
}

.adv-achievement-toast-enter-active,
.adv-achievement-toast-leave-active {
  transition:
    opacity 240ms ease,
    transform 240ms ease;
}

.adv-achievement-toast-enter-from,
.adv-achievement-toast-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}

@media (prefers-reduced-motion: reduce) {
  .adv-achievement-toast-enter-active,
  .adv-achievement-toast-leave-active {
    transition: none;
  }
}
</style>
