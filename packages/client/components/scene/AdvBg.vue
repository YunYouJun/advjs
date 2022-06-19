<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useAdvCtx } from '~/setup/adv'
import { useAppStore } from '~/stores/app'

const $adv = useAdvCtx()
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
</script>

<template>
  <transition enter-active-class="animate__fadeIn" leave-active-class="animate__fadeOut">
    <div v-if="app.showBg" h="full" w="full" class="absolute animate__animated" bg="cover center no-repeat" :style="advGameStyle" />
  </transition>
</template>
