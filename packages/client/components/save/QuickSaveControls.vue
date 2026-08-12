<script setup lang="ts">
import { QUICK_SAVE_SLOT, useAdvContext, useGameStore } from '@advjs/client'
import { onScopeDispose, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

const { $adv } = useAdvContext()
const game = useGameStore()
const { t } = useI18n()
const feedback = shallowRef('')
const busy = shallowRef(false)
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

function showFeedback(message: string) {
  feedback.value = message
  if (feedbackTimer)
    clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    feedback.value = ''
  }, 1800)
}

async function quickSave() {
  if (busy.value)
    return
  busy.value = true
  try {
    await game.save(QUICK_SAVE_SLOT, $adv.runtime.snapshot())
    showFeedback(t('save.quick_saved'))
  }
  catch (error) {
    console.error('[advjs] Quick save failed', error)
    showFeedback(t('save.quick_save_failed'))
  }
  finally {
    busy.value = false
  }
}

async function quickLoad() {
  if (busy.value)
    return
  busy.value = true
  try {
    const record = await game.read(QUICK_SAVE_SLOT)
    if (!record) {
      showFeedback(t('save.quick_empty'))
      return
    }
    $adv.runtime.restore(record.snapshot)
    showFeedback(t('save.quick_loaded'))
  }
  catch (error) {
    console.error('[advjs] Quick load failed', error)
    showFeedback(t('save.quick_load_failed'))
  }
  finally {
    busy.value = false
  }
}

onScopeDispose(() => {
  if (feedbackTimer)
    clearTimeout(feedbackTimer)
})
</script>

<template>
  <div class="quick-save-controls inline-flex" gap="4">
    <AdvIconButton :disabled="busy" :title="t('save.quick_save')" @click.stop="quickSave">
      <div i-ri-save-line />
    </AdvIconButton>
    <AdvIconButton :disabled="busy" :title="t('save.quick_load')" @click.stop="quickLoad">
      <div i-ri-restart-line />
    </AdvIconButton>
    <span v-if="feedback" class="quick-save-feedback" role="status" aria-live="polite">
      {{ feedback }}
    </span>
  </div>
</template>

<style scoped>
.quick-save-controls {
  position: relative;
}

.quick-save-feedback {
  position: fixed;
  z-index: 1200;
  top: 1rem;
  left: 50%;
  padding: 0.5rem 0.85rem;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 0.5rem;
  background: rgb(0 0 0 / 78%);
  color: white;
  font-size: 0.875rem;
  pointer-events: none;
  transform: translateX(-50%);
}
</style>
