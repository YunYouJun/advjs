<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { computed, useId } from 'vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ id?: string, label?: string, disabled?: boolean }>()
const generatedId = useId()
const id = computed(() => props.id ?? generatedId)
const switchState = defineModel({ type: Boolean, default: false })
</script>

<template>
  <div class="agui-switch-field">
    <label v-if="label || $slots.label" :id="`${id}-label`" :for="id">
      <slot name="label">{{ label }}</slot>
    </label>
    <SwitchRoot
      :id="id" v-model="switchState" v-bind="$attrs" :disabled="disabled"
      :aria-labelledby="label || $slots.label ? `${id}-label` : undefined"
      class="agui-switch"
    >
      <SwitchThumb class="agui-switch-thumb" />
    </SwitchRoot>
  </div>
</template>

<style scoped>
.agui-switch-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--agui-c-text-1);
}
.agui-switch {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 24px;
  padding: 3px;
  background: var(--agui-c-field);
  border: 1px solid var(--agui-c-control-border);
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 150ms ease;
}
.agui-switch[data-state='checked'] {
  background: var(--agui-c-primary);
}
.agui-switch:focus-visible {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: 2px;
}
.agui-switch[data-disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.agui-switch-thumb {
  display: block;
  width: 16px;
  height: 16px;
  background: var(--agui-c-text-2);
  border-radius: 50%;
  transition: transform 150ms ease;
}
.agui-switch-thumb[data-state='checked'] {
  transform: translateX(12px);
  background: var(--agui-c-on-accent);
}
@media (prefers-reduced-motion: reduce) {
  .agui-switch,
  .agui-switch-thumb {
    transition: none;
  }
}
</style>
