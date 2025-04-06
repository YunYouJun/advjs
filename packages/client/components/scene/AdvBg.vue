<script lang="ts" setup>
import { useAdvContext, useAppStore } from '@advjs/client'
import { computed, onMounted, ref, watch } from 'vue'

const { $adv } = useAdvContext()
const app = useAppStore()

const bgImage = ref('')
const advGameStyle = computed(() => {
  return {
    backgroundImage: `url("${bgImage.value}")`,
  }
})

watch(() => $adv.store.cur.background, (val) => {
  if (app.showBg)
    app.toggleBg()

  setTimeout(() => {
    bgImage.value = val
    app.toggleBg()
  }, 1000)
})

onMounted(() => {
  const url = $adv.store.cur.background
  if (url)
    bgImage.value = url
})
</script>

<template>
  <Transition enter-active-class="animate-fade-in" leave-active-class="animate-fade-out">
    <div v-if="app.showBg" h="full" w="full" class="absolute animate-duration-200" bg="cover center no-repeat" :style="advGameStyle" />
  </Transition>
</template>
