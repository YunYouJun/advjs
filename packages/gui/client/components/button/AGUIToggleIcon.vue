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
  backgroundImage: `var(--b-icon-${props.icon})`,
}))

// Double click event handler
function handleDoubleClick() {
  // Your double click logic here
}
</script>

<template>
  <button
    class="toggle"
    :class="{ muted }"
    :style="backgroundImageStyle"
    :title="hint"
    @click.stop
    @dblclick.stop="handleDoubleClick"
  />
</template>

<style scoped>
.toggle {
  appearance: none;
  background: transparent no-repeat center center;
  border: none;
  width: 20px;
  height: 20px;
  opacity: 0.6;
  flex-shrink: 0;
  cursor: pointer;
}

.toggle:active,
.toggle:hover {
  opacity: 0.8;
}

.toggle.muted {
  opacity: 0.3;
}
</style>
