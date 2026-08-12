<script setup lang="ts">
import type { JsonValue } from '@advjs/types'
import { computed, shallowRef, watch } from 'vue'
import { useAdvContext } from '../../composables'
import { isDev } from '../../env'
import GenericActivityDebug from './activity/GenericActivityDebug.vue'
import UnsupportedActivity from './activity/UnsupportedActivity.vue'

const { $adv } = useAdvContext()
const pending = computed(() => $adv.store.state.pendingActivity)
const error = shallowRef('')
const renderer = computed(() => {
  if (!pending.value)
    return undefined
  return $adv.activityRenderers.resolve(pending.value.type)
    ?? (isDev ? GenericActivityDebug : UnsupportedActivity)
})

watch(() => pending.value?.id, () => {
  error.value = ''
})

async function complete(result: JsonValue) {
  error.value = ''
  try {
    await $adv.runtime.completeActivity(result)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function back() {
  error.value = ''
  try {
    $adv.runtime.back()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}
</script>

<template>
  <section v-if="pending" class="adv-activity" aria-live="polite">
    <div class="adv-activity__panel">
      <component
        :is="renderer"
        :activity="pending"
        @complete="complete"
        @back="back"
      />

      <p v-if="error" class="adv-activity__error">
        {{ error }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.adv-activity {
  position: absolute;
  /* Activities own the interaction and cover the regular HUD. */
  z-index: 120;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(3 7 18 / 72%);
  backdrop-filter: blur(10px);
}

.adv-activity__panel {
  display: flex;
  width: min(780px, 92vw);
  max-height: 90vh;
  overflow: auto;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
  border: 1px solid rgb(148 163 184 / 35%);
  border-radius: 0.35rem;
  background: linear-gradient(120deg, rgb(7 10 18 / 98%), rgb(12 24 46 / 94%)), rgb(15 23 42 / 94%);
  box-shadow: 0 24px 80px rgb(0 0 0 / 45%);
  color: white;
}

.adv-activity__panel :deep(button) {
  padding: 0.65rem 1rem;
  border: 1px solid rgb(125 211 252 / 60%);
  border-radius: 0.5rem;
  background: rgb(14 116 144 / 70%);
}

.adv-activity__error {
  color: #fca5a5;
}

@media (max-width: 640px) {
  .adv-activity__panel {
    box-sizing: border-box;
    width: calc(100% - 2rem);
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem;
  }
}
</style>
