<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { prefersReducedMotion } from '../../composables/home'

/**
 * Reveals text one character at a time with CSS only, so the text is
 * present in SSR output and readable without JavaScript.
 * Remount it with a new `key` to type a new line.
 */
const props = withDefaults(defineProps<{
  text: string
  as?: string
  /** ms per character */
  speed?: number
  /** ms before the first character */
  delay?: number
  /** show everything at once */
  instant?: boolean
}>(), {
  as: 'span',
  speed: 36,
  delay: 0,
  instant: false,
})

const emit = defineEmits<{ done: [] }>()

const chars = computed(() => Array.from(props.text))

function onEnd(index: number) {
  if (index === chars.value.length - 1 && !props.instant)
    emit('done')
}

onMounted(() => {
  if (props.instant || prefersReducedMotion())
    emit('done')
})

watch(() => props.instant, (instant) => {
  if (instant)
    emit('done')
})
</script>

<template>
  <component
    :is="as"
    class="h-type"
    :class="{ 'is-done': instant }"
    :style="{ '--h-type-speed': `${speed}ms`, '--h-type-delay': `${delay}ms` }"
  >
    <span class="h-sr">{{ text }}</span>
    <span aria-hidden="true"><span
      v-for="(char, i) in chars"
      :key="i"
      class="h-char"
      :style="{ '--i': i }"
      @animationend="onEnd(i)"
    >{{ char }}</span></span>
  </component>
</template>
