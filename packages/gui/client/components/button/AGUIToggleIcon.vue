<script lang="ts" setup>
import { computed } from 'vue'

// Props
const props = withDefaults(defineProps<{
  icon: string
  muted?: boolean
  hint?: string
}>(), {
  muted: false,
  hint: '',
})

// Computed style for background image
const backgroundImageStyle = computed(() => ({
  '--agui-toggle-mask': `var(--b-icon-${props.icon})`,
}))
</script>

<template>
  <button
    type="button"
    class="agui-toggle-icon"
    :aria-label="hint || icon"
    :class="{ muted }"
    :style="backgroundImageStyle"
    :title="hint"
    @click.stop
    @dblclick.stop
  />
</template>

<style scoped>
.agui-toggle-icon {
  appearance: none;
  position: relative;
  background: transparent;
  color: inherit;
  border: none;
  width: 24px;
  height: 24px;
  opacity: 0.85;
  flex-shrink: 0;
  cursor: pointer;
}

.agui-toggle-icon::before {
  content: '';
  position: absolute;
  inset: 4px;
  mask: var(--agui-toggle-mask) center / contain no-repeat;
  background: currentColor;
}
.agui-toggle-icon:active,
.agui-toggle-icon:hover {
  opacity: 0.8;
}

.agui-toggle-icon.muted {
  opacity: 0.3;
}
.agui-toggle-icon:focus-visible {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: -2px;
}
</style>
