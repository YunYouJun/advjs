<template>
  <div class="print-words">
    <span v-for="word, i in displayWords" :key="i" class="animate-animated animate-fadeIn">{{ word }}</span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  words?: string
  /**
   * 打印间隔
   */
  typeInterval?: number
}>(), {
  words: '',
  typeInterval: 100,
})

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
  }, props.typeInterval)
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

<style>
.typed-cursor {
  position: absolute;
  right: 3rem;
  bottom: 1.5rem;
}
</style>
