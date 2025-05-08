<script setup lang="ts">
import { consola, LogLevels } from 'consola'
// import { useAdvConfig, useAdvContext } from '@advjs/client'
import { onMounted } from 'vue'

import '../../../../themes/theme-default/styles'
// const { $adv } = useAdvContext()
// const advConfig = useAdvConfig()

// const isDev = import.meta.env.DEV

const consoleStore = useConsoleStore()
const gameStore = useGameStore()
const show = computed(() => gameStore.loadStatus === 'success')

/**
 * debug
 */
consola.level = LogLevels.debug

const oldConsolaInfo = consola.info
const oldConsolaDebug = consola.debug
// @ts-expect-error override old consola
consola.info = (...args: any[]) => {
  // @ts-expect-error override old consola
  oldConsolaInfo(...args)
  consoleStore.info(args[0], ...args.slice(1))
}
// @ts-expect-error override old consola
consola.debug = (...args: any[]) => {
  // @ts-expect-error override old consola
  oldConsolaDebug(...args)
  consoleStore.debug(args[0], ...args.slice(1))
}

onMounted(async () => {
  // await sleep(10)
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center">
    <AdvGame v-if="show" class="h-full w-full" />
    <AEOpenAdvConfigFile v-else />
  </div>

  <AELoadOnlineConfigFileDialog />

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
