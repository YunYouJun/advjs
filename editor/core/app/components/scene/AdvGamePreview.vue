<script setup lang="ts">
import consola, { LogLevels } from 'consola'
// import { useAdvConfig, useAdvContext } from '@advjs/client'
import { onMounted } from 'vue'
import '../../../../packages/theme-default/styles'
// const { $adv } = useAdvContext()
// const advConfig = useAdvConfig()

// const isDev = import.meta.env.DEV

const show = ref(false)

/**
 * debug
 */
consola.level = LogLevels.debug

onMounted(async () => {
  // await sleep(10)
  show.value = true
})
</script>

<template>
  <AdvGame v-if="show" class="h-full w-full" />
  <!-- <AdvDevTools v-if="isDev" /> -->
  <!-- <div /> -->
  <!-- <iframe
    src="http://localhost:3333"
    style="width: 100%; height: 100%; border: none;"
    sandbox="allow-same-origin allow-scripts allow-modals allow-popups allow-forms"
    allow="autoplay; encrypted-media; picture-in-picture"
    allowfullscreen
    scrolling="no"
    frameborder="0"
  /> -->
</template>
