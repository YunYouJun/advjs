<template>
  <div class="typed-words" />
</template>

<script setup lang="ts">
import Typed from 'typed.js'

const props = withDefaults(defineProps<{
  words?: string
  typeSpeed?: number
}>(), {
  words: '',
  typeSpeed: 20,
})

const typedObj = ref()

watch(() => props.words, () => {
  if (typedObj.value)
    typedObj.value.destroy()

  initTypedJs()
})

function initTypedJs() {
  typedObj.value = new Typed('.typed-words', {
    strings: [props.words],
    typeSpeed: props.typeSpeed,
    cursorChar: '▼',
  })
}
</script>

<style>
.typed-cursor {
  position: absolute;
  right: 3rem;
  bottom: 1.5rem;
}
</style>
