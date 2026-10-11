<script setup lang="ts">
import type { DisplayMode, DisplaySpeed } from '@advjs/client'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  speed?: DisplaySpeed
  words?: string
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
const emit = defineEmits(['end'])

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
    <span
      v-for="word, i in words" :key="i"
      :class="wordClasses(i)"
    >
      {{ word }}
    </span>
  </div>
</template>
