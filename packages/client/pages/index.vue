<script setup lang="ts">
import { useRouter } from 'vue-router'

import { assets as themeAssets } from '@advjs/theme-default'

withDefaults(defineProps<{ duration?: number }>(), {
  duration: 2000,
})

const assets = { ...themeAssets }

const router = useRouter()
function onLoaded() {
  router.push('/start')
}
</script>

<template>
  <main
    class="
      w-screen
      h-screen
      opacity-90
      flex flex-col
      justify-center
      items-center
      animate__animated animate__fadeIn
    "
  >
    <NewYunLogo class="w-40 h-40" />
    <div class="font-bold">
      @YunYouJun
    </div>

    <StartLoading :assets="assets" @loaded="onLoaded" />
  </main>
</template>

<route lang="yaml">
meta:
  layout: logo
</route>
