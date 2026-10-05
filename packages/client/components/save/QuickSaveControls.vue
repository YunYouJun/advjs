<script setup lang="ts">
import { QUICK_SAVE_SLOT, useAdvContext, useGameStore } from '@advjs/client'
import { onScopeDispose, shallowRef, watch } from 'vue'
import { useGameControlsI18n } from '../../composables/useGameControlsI18n'
import GameControlHint from '../ui/GameControlHint.vue'

defineProps<{ showLabels?: boolean, inline?: boolean, hintsDisabled?: boolean }>()
const emit = defineEmits<{ active: [value: boolean], hintOpen: [value: boolean] }>()

const { $adv } = useAdvContext()
const game = useGameStore()
const { t } = useGameControlsI18n()
const feedback = shallowRef('')
const busy = shallowRef(false)
watch([busy, feedback], () => emit('active', busy.value || !!feedback.value))
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
    showFeedback(t('controls.quickSaved'))
  }
  catch (error) {
    console.error('[advjs] Quick save failed', error)
    showFeedback(t('controls.quickSaveFailed'))
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
      showFeedback(t('controls.quickEmpty'))
      return
    }
    $adv.runtime.restore(record.snapshot)
    showFeedback(t('controls.quickLoaded'))
  }
  catch (error) {
    console.error('[advjs] Quick load failed', error)
    showFeedback(t('controls.quickLoadFailed'))
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
  <div class="quick-save-controls" :class="{ 'with-labels': showLabels, inline }">
    <GameControlHint :label="t('controls.quickSave')" :description="t('hints.quickSave')" :side="inline ? 'top' : 'bottom'" :disabled="hintsDisabled" @open="emit('hintOpen', $event)">
      <button type="button" :disabled="busy" :aria-label="t('controls.quickSave')" @click.stop="quickSave">
        <span v-if="showLabels">{{ t(inline ? 'controls.quickSaveShort' : 'controls.quickSave') }}</span>
        <span v-else i-ri-save-line aria-hidden="true" />
      </button>
    </GameControlHint>
    <GameControlHint :label="t('controls.quickLoad')" :description="t('hints.quickLoad')" :side="inline ? 'top' : 'bottom'" :disabled="hintsDisabled" @open="emit('hintOpen', $event)">
      <button type="button" :disabled="busy" :aria-label="t('controls.quickLoad')" @click.stop="quickLoad">
        <span v-if="showLabels">{{ t(inline ? 'controls.quickLoadShort' : 'controls.quickLoad') }}</span>
        <span v-else i-ri-restart-line aria-hidden="true" />
      </button>
    </GameControlHint>
    <span v-if="feedback" class="quick-save-feedback" role="status" aria-live="polite">
      {{ feedback }}
    </span>
  </div>
</template>

<style scoped>
.quick-save-controls {
  position: relative;
  display: inline-flex;
}

.with-labels {
  flex-direction: column;
}

.quick-save-controls button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--adv-control-target, 36px);
  min-height: var(--adv-control-target, 36px);
  padding: 0.25em 0.65em;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: center;
  touch-action: manipulation;
  white-space: nowrap;
  cursor: pointer;
}

.quick-save-controls button:hover,
.quick-save-controls button:focus-visible {
  background: rgb(255 255 255 / 12%);
  outline: 1px solid currentColor;
}

.quick-save-controls button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.inline {
  display: contents;
}

.inline .quick-save-feedback {
  position: absolute;
  right: 0;
  bottom: calc(100% + 4px / var(--adv-screen-scale, 1));
  max-width: 100%;
}

.quick-save-feedback {
  display: block;
  padding: 0.5rem 0.85rem;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 0.5rem;
  background: rgb(0 0 0 / 78%);
  color: white;
  font-size: inherit;
  white-space: normal;
  pointer-events: none;
}
</style>
