<script setup lang="ts">
import type { DisplayMode, DisplaySpeed } from '@advjs/client'
import type { GlossaryReference } from '../../utils/glossary'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { glossaryReferences } from '../../utils/glossary'

const props = withDefaults(defineProps<{
  speed?: DisplaySpeed
  words?: string
  glossary?: unknown
  /**
   * 打印间隔
   */
  typeInterval?: number
  mode?: DisplayMode
  /**
   * show animation
   */
  animation?: boolean
}>(), {
  words: '',
  mode: 'soft',
  speed: 'normal',
  animation: true,
})
const emit = defineEmits<{ end: [], glossary: [reference: GlossaryReference] }>()

const parts = computed(() => {
  const references = glossaryReferences(props.glossary, props.words)
  const result: Array<{ text: string, start: number, end: number, reference?: GlossaryReference }> = []
  let offset = 0
  for (const reference of references) {
    for (const text of props.words.slice(offset, reference.start)) {
      result.push({ text, start: offset, end: offset + text.length })
      offset += text.length
    }
    result.push({ text: reference.label, start: reference.start, end: reference.end, reference })
    offset = reference.end
  }
  for (const text of props.words.slice(offset)) {
    result.push({ text, start: offset, end: offset + text.length })
    offset += text.length
  }
  return result
})

/**
 * 文字是否全部打印完毕
 */
const printed = defineModel('printed', {
  type: Boolean,
  default: false,
})

const speedMap = {
  slow: 100,
  normal: 50,
  fast: 25,
  very_fast: 10,
}

const len = ref(0)
let intervalId: ReturnType<typeof setInterval> | undefined
let completed = false

function clearTimer() {
  if (intervalId !== undefined) {
    clearInterval(intervalId)
    intervalId = undefined
  }
}

function finish() {
  clearTimer()
  len.value = props.words.length
  if (completed)
    return
  completed = true
  printed.value = true
  emit('end')
}

function playWordsAnimation() {
  clearTimer()
  completed = false
  len.value = 0
  if (printed.value || !props.animation || !props.words.length) {
    finish()
    return
  }
  intervalId = setInterval(() => {
    len.value++
    if (len.value >= props.words.length)
      finish()
  }, props.typeInterval ?? speedMap[props.speed])
}

onMounted(playWordsAnimation)
onBeforeUnmount(clearTimer)

watch(() => props.words, () => {
  printed.value = false
  playWordsAnimation()
})

// Revealing the rest of a line is a completion too, exactly once per run.
watch(printed, (value) => {
  if (value)
    finish()
})
watch(() => props.animation, (value) => {
  if (!value)
    finish()
})

function wordClasses(i: number) {
  const classes: string[] = []

  if (!props.animation)
    return []

  if (i >= len.value) {
    classes.push('invisible')
  }
  else {
    if (props.mode === 'soft') {
      classes.push('animate-fade-in animate-duration-100')
    }
  }

  return classes
}
</script>

<template>
  <div class="print-words">
    <template v-for="part in parts" :key="part.start">
      <button
        v-if="part.reference"
        type="button"
        class="adv-glossary-reference"
        :class="wordClasses(part.end - 1)"
        :tabindex="animation && len < part.end ? -1 : 0"
        :aria-hidden="animation && len < part.end || undefined"
        aria-haspopup="dialog"
        @click.stop="emit('glossary', part.reference)"
      >
        {{ part.text }}
      </button>
      <span v-else :class="wordClasses(part.start)">{{ part.text }}</span>
    </template>
  </div>
</template>

<style scoped>
.adv-glossary-reference {
  font: inherit;
  color: inherit;
  background: transparent;
  border: 0;
  padding: 0.1em 0.15em;
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 0.2em;
}
.adv-glossary-reference:focus-visible {
  outline: 2px solid var(--adv-c-focus, currentColor);
  outline-offset: 2px;
}
</style>
