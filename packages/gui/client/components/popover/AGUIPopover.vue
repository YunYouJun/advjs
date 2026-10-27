<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import AGUIButton from '../button/AGUIButton.vue'
import '../../styles/motion.scss'

defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  label: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  arrow?: boolean
}>(), { side: 'top', align: 'center', sideOffset: 8, arrow: false })
const emit = defineEmits<{ closeAutoFocus: [event: Event] }>()
const open = defineModel<boolean>('open', { default: false })
const reducedMotion = usePreferredReducedMotion()
</script>

<template>
  <PopoverRoot v-model:open="open" :modal="false">
    <PopoverTrigger as-child>
      <slot name="trigger">
        <AGUIButton>{{ label }}</AGUIButton>
      </slot>
    </PopoverTrigger>
    <PopoverPortal :key="Number(!open && reducedMotion === 'reduce')">
      <PopoverContent
        v-bind="$attrs" class="agui-popover-content agui-motion-popup" :aria-label="label"
        :side="side" :align="align" :side-offset="sideOffset" :collision-padding="8"
        @close-auto-focus="emit('closeAutoFocus', $event)"
      >
        <slot />
        <PopoverArrow v-if="arrow" class="agui-popover-arrow" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style>
/* Reka's Presence/non-modal Portal can omit the parent's Vue scope attribute.
   Keep these shared styles on the explicit AGUI classes, as with Select. */
.agui-popover-content {
  z-index: 100;
  box-sizing: border-box;
  max-width: calc(100vw - 16px);
  padding: var(--agui-space-2);
  border: 1px solid var(--agui-c-border);
  border-radius: var(--agui-radius-md);
  background: var(--agui-c-popup);
  box-shadow: var(--agui-shadow-popup);
  color: var(--agui-c-text-1);
  font-family: var(--agui-font-family-ui);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height);
  overflow: visible;
}
.agui-popover-arrow {
  fill: var(--agui-c-popup);
}
</style>
