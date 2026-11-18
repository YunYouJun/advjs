<script setup lang="ts">
import type { PreviewDialogue } from './preview-types'

const props = defineProps<{
  dialogue: PreviewDialogue | null
  disabled?: boolean
  labels?: { title?: string, waiting?: string, locate?: string, next?: string, close?: string, hidden?: (count: number) => string }
}>()
const emit = defineEmits<{ choose: [id: string], next: [], close: [], locate: [node: string] }>()
defineSlots<{
  button?: (props: { action: string, label: string, disabled: boolean, activate: () => void, choiceId?: string }) => any
  empty?: () => any
  footer?: () => any
}>()
function activate(action: string, id?: string) {
  if (props.disabled || !props.dialogue)
    return
  if (action === 'choose' && props.dialogue.choices.some(choice => choice.id === id))
    emit('choose', id!)
  else if (action === 'next' && props.dialogue.canContinue)
    emit('next')
  else if (action === 'close' && props.dialogue.canClose)
    emit('close')
  else if (action === 'locate')
    emit('locate', props.dialogue.node)
}
</script>

<template>
  <section class="adv-preview-player">
    <div class="player-heading">
      <span>{{ dialogue ? `${labels?.title ?? 'Dialogue'} · ${dialogue.node}` : labels?.waiting ?? 'Waiting for dialogue' }}</span>
      <slot v-if="dialogue" name="button" action="locate" :label="labels?.locate ?? 'Locate dialogue node'" :disabled="!!disabled" :activate="() => activate('locate')">
        <button type="button" :disabled="disabled" @click="activate('locate')">
          {{ labels?.locate ?? 'Locate dialogue node' }}
        </button>
      </slot>
    </div>
    <template v-if="dialogue">
      <h3>{{ dialogue.speaker }}</h3>
      <p class="dialogue-text">
        {{ dialogue.text }}
      </p>
      <div class="choice-list">
        <template v-for="choice in dialogue.choices" :key="choice.id">
          <slot name="button" action="choose" :label="choice.label" :choice-id="choice.id" :disabled="!!disabled" :activate="() => activate('choose', choice.id)">
            <button type="button" :disabled="disabled" :data-preview-choice="choice.id" @click="activate('choose', choice.id)">
              {{ choice.label }}
            </button>
          </slot>
        </template>
      </div>
      <p v-if="dialogue.hiddenChoices" class="muted">
        {{ labels?.hidden?.(dialogue.hiddenChoices) ?? `${dialogue.hiddenChoices} branches hidden by conditions` }}
      </p>
      <div class="player-actions">
        <slot v-if="dialogue.canContinue" name="button" action="next" :label="labels?.next ?? 'Continue'" :disabled="!!disabled" :activate="() => activate('next')">
          <button type="button" :disabled="disabled" @click="activate('next')">
            {{ labels?.next ?? 'Continue' }}
          </button>
        </slot>
        <slot v-if="dialogue.canClose" name="button" action="close" :label="labels?.close ?? 'Close dialogue'" :disabled="!!disabled" :activate="() => activate('close')">
          <button type="button" :disabled="disabled" @click="activate('close')">
            {{ labels?.close ?? 'Close dialogue' }}
          </button>
        </slot>
      </div>
    </template>
    <slot v-else name="empty" />
    <slot name="footer" />
  </section>
</template>

<style scoped>
.adv-preview-player {
  min-width: 0;
}
.player-heading,
.player-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.choice-list {
  display: flex;
  flex-direction: column;
}
.dialogue-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
