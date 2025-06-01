<script lang="ts" setup>
import { images } from '@advjs/theme-default'
import { onMounted, ref } from 'vue'

const rippleAnimation = ref(true)
onMounted(() => {
  rippleAnimation.value = false
})
</script>

<template>
  <img
    class="animate__animated animate__fadeInRight absolute top-10 z-2 h-350 drop-shadow-lg filter -left-10"
    :src="images.yunAlphaUrl"
  >
  <div class="animate__animated animate__fadeInRight animate-delay-200">
    <img
      class="absolute left-150 top-10 z-1 h-350 transform drop-shadow-lg filter -rotate-y-180"
      :src="images.yunAlphaUrl"
    >
  </div>

  <div class="adv-bubble-breath circle-pattern opacity-10 shadow-lg -right-15 -top-20" bg="blue-600 " />
  <div class="adv-bubble-breath circle-pattern absolute opacity-10 shadow-lg -bottom-25 -left-35" bg="blue-500" />
  <div class="adv-bubble-breath circle-pattern absolute bottom-15 right-50 opacity-5 shadow-lg" bg="red-500" />
  <div class="adv-bubble-breath circle-pattern absolute left-20 top-20 opacity-10 shadow-lg" bg="blue-500" style="--circle-size: 20rem;" />

  <Transition>
    <div v-if="rippleAnimation" bg="blue-400" class="adv-ripple absolute top-0" />
  </Transition>
  <Transition
    :duration="{ enter: 200, leave: 1200 }"
  >
    <div v-if="rippleAnimation" bg="orange-400" class="adv-ripple absolute right-0 top-0 animate-delay-200" />
  </Transition>
</template>
