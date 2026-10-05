<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { computed, shallowRef, useTemplateRef } from 'vue'

withDefaults(defineProps<{
  label: string
  description?: string
  side?: 'top' | 'bottom'
  disabled?: boolean
}>(), { side: 'bottom' })
const emit = defineEmits<{ open: [value: boolean] }>()
const anchor = useTemplateRef<HTMLElement>('anchor')
const screen = computed(() => anchor.value?.closest<HTMLElement>('.adv-screen'))
const open = shallowRef(false)

function setOpen(value: boolean) {
  open.value = value
  emit('open', value)
}
</script>

<template>
  <span ref="anchor" class="game-control-hint">
    <TooltipProvider :delay-duration="450" :skip-delay-duration="100" ignore-non-keyboard-focus>
      <TooltipRoot :open="!disabled && open" :disabled="disabled" @update:open="setOpen">
        <TooltipTrigger as-child><slot /></TooltipTrigger>
        <!-- Keep hints inside the fullscreen game and outside the scaled canvas. -->
        <TooltipPortal v-if="screen" :to="screen">
          <TooltipContent
            class="game-control-tooltip" :side="side" :side-offset="8"
            :collision-boundary="screen" :collision-padding="12" position-strategy="absolute"
            @click.stop @pointerdown.stop
          >
            <strong>{{ label }}</strong>
            <span v-if="description">{{ description }}</span>
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  </span>
</template>

<style scoped>
.game-control-hint {
  display: inline-flex;
  flex: none;
}

/* Reka's portalled content does not inherit this component's scope attribute. */
:global(.game-control-tooltip) {
  z-index: 1100;
  box-sizing: border-box;
  max-width: min(260px, var(--reka-tooltip-content-available-width));
  padding: 10px 14px;
  border: 1px solid rgb(217 189 131 / 28%);
  border-radius: 8px;
  background: rgb(24 23 21 / 97%);
  box-shadow: 0 4px 20px rgb(0 0 0 / 24%);
  color: #f4efe6;
  font:
    13px / 1.6 system-ui,
    sans-serif;
  text-align: left;
  pointer-events: auto;
}

:global(.game-control-tooltip strong),
:global(.game-control-tooltip span) {
  display: block;
}

:global(.game-control-tooltip span) {
  margin-top: 3px;
  color: #d6cbb9;
}
</style>
