<script setup lang="ts">
import { consola, LogLevels } from 'consola'
// import { useAdvConfig, useAdvContext } from '@advjs/client'
import { onMounted } from 'vue'

import '../../../../packages/theme-default/styles'
// const { $adv } = useAdvContext()
// const advConfig = useAdvConfig()

// const isDev = import.meta.env.DEV

const consoleStore = useConsoleStore()
const fileStore = useFileStore()
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
    <div v-else class="w-full flex items-center justify-evenly">
      <div
        class="inline-flex flex-col cursor-pointer items-center gap-2"
        @click="fileStore.openAdvConfigFile"
      >
        <div class="glow-icon text-8xl">
          <div
            class="i-vscode-icons:file-type-jsonld"
          />
        </div>
        <div class="text-sm op-50">
          Open Local ADV Config File
        </div>
      </div>

      <div
        class="inline-flex flex-col cursor-pointer items-center gap-2"
        @click="fileStore.onlineAdvConfigFileDialogOpen = true"
      >
        <div class="glow-icon text-8xl">
          <div
            class="i-vscode-icons:file-type-aspx"
          />
        </div>
        <div class="text-sm op-50">
          Open Online ADV Config File
        </div>
      </div>
    </div>
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

<style scoped>
.glow-icon {
  will-change: filter;
  transition: filter 300ms;

  &:hover {
    filter: drop-shadow(0 0 1rem rgba(252, 171, 49, 0.9));
  }
}
</style>
