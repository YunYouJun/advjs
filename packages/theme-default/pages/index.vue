<script setup lang="ts">
import { useRouter } from 'vue-router'

import * as assets from '../assets'

withDefaults(defineProps<{ duration?: number }>(), {
  duration: 2000,
})

const router = useRouter()
function onLoaded() {
  router.push('/start')
}
</script>

<template>
  <main
    class="animate__animated animate__fadeIn h-screen w-screen flex flex-col items-center justify-center opacity-90"
  >
    <NewYunLogo class="h-40 w-40" />
    <div class="font-bold">
      Made with <a href="https://advjs.org/" target="_blank">ADV.JS</a>
    </div>

    <StartLoading :assets="assets" @loaded="onLoaded" />
  </main>
</template>

<route lang="yaml">
meta:
  layout: logo
</route>
