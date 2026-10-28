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
  font-family: var(--agui-font-family-ui);
  display: flex;
  align-items: center;
  gap: var(--agui-space-2);
  min-width: 0;
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-control-line-height);
  color: var(--agui-c-text-1);
}
.agui-switch {
  box-sizing: border-box;
  font-family: var(--agui-font-family-ui);
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  width: 36px;
  height: var(--agui-control-height);
  padding: 3px;
  background: var(--agui-c-field);
  border: 1px solid var(--agui-c-control-border);
  border-radius: var(--agui-radius-pill);
  cursor: pointer;
  transition:
    background-color var(--agui-motion-duration) var(--agui-motion-ease),
    border-color var(--agui-motion-duration) var(--agui-motion-ease);
}
.agui-switch:hover:not([data-disabled]) {
  border-color: var(--agui-c-border-hover);
}
.agui-switch[data-state='checked'] {
  background: var(--agui-c-primary);
  border-color: var(--agui-c-primary);
}
.agui-switch[data-state='checked']:hover:not([data-disabled]) {
  background: var(--agui-c-primary-hover);
  border-color: var(--agui-c-primary-hover);
}
.agui-switch[data-state='checked']:active:not([data-disabled]) {
  background: var(--agui-c-primary-pressed);
  border-color: var(--agui-c-primary-pressed);
}
.agui-switch:focus-visible {
  outline: var(--agui-focus-width) solid var(--agui-c-focus);
  outline-offset: var(--agui-focus-offset);
}
.agui-switch[data-state='checked']:focus-visible {
  outline-color: var(--agui-c-on-accent);
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
  transition: transform var(--agui-motion-duration) var(--agui-motion-ease);
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
