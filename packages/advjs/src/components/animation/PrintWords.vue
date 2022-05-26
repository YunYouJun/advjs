<script setup lang="ts">
import type { DisplayMode } from '~/stores/settings'

const props = withDefaults(defineProps<{
  speed?: 'normal' | 'fast' | 'slow'
  words?: string
  /**
   * 打印间隔
   */
  typeInterval?: number
  mode?: DisplayMode
}>(), {
  words: '',
  mode: 'soft',
  speed: 'normal',
})
const emit = defineEmits(['end'])

const speedMap = {
  slow: 100,
  normal: 50,
  fast: 25,
}

const len = ref(0)
const intervalId = ref()

const playWordsAnimation = () => {
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

const wordClasses = (i: number) => {
  const classes: string[] = []

  if (i > len.value) {
    classes.push('invisible')
  }
  else {
    if (props.mode === 'soft') {
      classes.push('animate-fast')
      classes.push('animate-fadeIn')
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
    >{{ word }}</span>
  </div>
</template>
