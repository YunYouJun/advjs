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

  len.value = 0
  playWordsAnimation()
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
      classes.push('animate__animated')
      classes.push('animate__fast')
      classes.push('animate__fadeIn')
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
