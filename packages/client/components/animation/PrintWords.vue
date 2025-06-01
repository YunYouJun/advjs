<script setup lang="ts">
import type { DisplayMode } from '@advjs/client'
import { onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  speed?: 'normal' | 'fast' | 'slow'
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
}

const len = ref(0)
const intervalId = ref()

function playWordsAnimation() {
  intervalId.value = setInterval(() => {
    if (len.value === props.words.length) {
      clearInterval(intervalId.value)
      printed.value = true
      emit('end')
    }

    len.value++
  }, props.typeInterval || speedMap[props.speed])
}

onMounted(() => {
  playWordsAnimation()
})

watch(() => props.words, () => {
  if (intervalId.value)
    clearInterval(intervalId.value)

  printed.value = false
  len.value = 0
  playWordsAnimation()
})

/**
 * 当 printed 被修改为 true 时
 */
watch(() => printed.value, (newVal) => {
  if (newVal && intervalId.value) {
    clearInterval(intervalId.value)
    len.value = props.words.length
  }
})

function wordClasses(i: number) {
  const classes: string[] = []

  if (!props.animation)
    return []

  if (i > len.value) {
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
