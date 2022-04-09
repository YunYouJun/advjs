<script setup lang="ts">
export type DisplayMode = 'type' | 'soft'

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

const speedMap = {
  slow: 100,
  normal: 50,
  fast: 25,
}

const displayWords = ref('')

const len = ref(0)

const intervalId = ref()

const emit = defineEmits(['end'])

const playWordsAnimation = () => {
  intervalId.value = setInterval(() => {
    displayWords.value = props.words.slice(0, len.value)
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
</script>

<template>
  <div class="print-words">
    <span v-for="word, i in displayWords" :key="i" :class="mode === 'soft' && ['animate-fast', 'animate-fadeIn']">{{ word }}</span>
  </div>
</template>
