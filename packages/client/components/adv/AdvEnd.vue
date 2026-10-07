<script setup lang="ts">
import type { VNodeChild } from 'vue'
import { computed } from 'vue'
import { useGameUiTheme } from '../../composables/useGameUiTheme'

const props = defineProps<{ text?: string }>()
defineSlots<{
  default?: (props: { text: string }) => VNodeChild
}>()

const { config } = useGameUiTheme()
const text = computed(() => {
  const value = props.text ?? config.value.ui?.end?.text
  return typeof value === 'string' ? value : '- END -'
})
</script>

<template>
  <div class="adv-end">
    <div class="adv-end__content">
      <slot :text="text">
        <p v-if="text" class="adv-end__text" role="status">
          {{ text }}
        </p>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.adv-end {
  position: absolute;
  z-index: 50;
  inset: 0;
  display: flex;
  box-sizing: border-box;
  overflow: auto;
  align-items: var(--adv-end-align-items, center);
  justify-content: var(--adv-end-justify-content, center);
  background: var(--adv-end-bg, rgb(0 0 0 / 60%));
  padding: var(--adv-end-padding, 1.5rem);
  color: var(--adv-end-color, #fff);
  font-family: var(--adv-end-font-family, var(--adv-font-family, inherit));
  font-size: var(--adv-end-font-size, clamp(2rem, 8cqw, 6rem));
  font-weight: var(--adv-end-font-weight, 700);
  line-height: 1.2;
  letter-spacing: var(--adv-end-letter-spacing, normal);
  text-align: center;
  text-shadow: var(--adv-end-text-shadow, none);
  animation-duration: 200ms;
}

.adv-end__content {
  min-width: 0;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
}

.adv-end__text {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
