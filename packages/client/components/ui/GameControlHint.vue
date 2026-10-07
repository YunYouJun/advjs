<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useAdvMotionPreference } from '../../composables/useAdvMotionPreference'

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
const motion = useAdvMotionPreference()

function setOpen(value: boolean) {
  open.value = value
  emit('open', value)
}
</script>

<template>
  <span ref="anchor" class="game-control-hint" :data-motion="motion">
    <TooltipProvider :delay-duration="0" :skip-delay-duration="0" ignore-non-keyboard-focus>
      <TooltipRoot :open="!disabled && open" :disabled="disabled" @update:open="setOpen">
        <TooltipTrigger as-child><slot /></TooltipTrigger>
        <!-- Keep hints inside the fullscreen game and outside the scaled canvas. -->
        <TooltipPortal v-if="screen" :to="screen">
          <TooltipContent
            class="game-control-tooltip" :side="side" :side-offset="8"
            :data-motion="motion"
            :collision-boundary="screen" :collision-padding="12" position-strategy="absolute"
            @click.stop @pointerdown.stop
          >
            <strong class="game-control-tooltip-title">{{ label }}</strong>
            <span v-if="description" class="game-control-tooltip-description">{{ description }}</span>
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

/* Portals stay in the owning game, including fullscreen and local themes. */
:global([data-adv-ui='game'] .game-control-tooltip) {
  z-index: 1100;
  box-sizing: border-box;
  max-width: min(240px, var(--reka-tooltip-content-available-width));
  padding: 10px 12px;
  border: 1px solid var(--adv-tooltip-border, color-mix(in srgb, var(--adv-c-text, white) 16%, transparent));
  border-radius: 4px;
  background: var(--adv-tooltip-bg, var(--adv-c-bg-alt, #161618));
  box-shadow:
    0 6px 18px rgb(0 0 0 / 18%),
    inset 0 1px rgb(255 255 255 / 4%);
  color: var(--adv-c-text, #f4efe6);
  font:
    12px / 1.5 var(--adv-font-family, system-ui),
    sans-serif;
  text-align: left;
  text-shadow: none;
  overflow-wrap: anywhere;
  pointer-events: auto;
}

:global([data-adv-ui='game'] .game-control-tooltip-title),
:global([data-adv-ui='game'] .game-control-tooltip-description) {
  display: block;
}

:global([data-adv-ui='game'] .game-control-tooltip-title) {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

:global([data-adv-ui='game'] .game-control-tooltip-description) {
  margin-top: 4px;
  color: var(--adv-c-text-2, #d6cbb9);
}

:global([data-adv-ui='game'] .game-control-tooltip[data-state='delayed-open']),
:global([data-adv-ui='game'] .game-control-tooltip[data-state='instant-open']) {
  animation: adv-control-hint-in 100ms ease-out;
}

:global([data-adv-ui='game'] .game-control-tooltip[data-motion='reduced']) {
  animation-duration: 80ms;
}

:global([data-adv-ui='game'] .game-control-tooltip[data-motion='none']) {
  animation: none;
}

@keyframes adv-control-hint-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  :global([data-adv-ui='game'] .game-control-tooltip) {
    animation: none;
  }
}
</style>
