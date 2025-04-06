<script setup lang="ts">
import consola, { LogLevels } from 'consola'
// import { useAdvConfig, useAdvContext } from '@advjs/client'
import { onMounted } from 'vue'
import '../../../../packages/theme-default/styles'
// const { $adv } = useAdvContext()
// const advConfig = useAdvConfig()

// const isDev = import.meta.env.DEV

const fileStore = useFileStore()
const show = computed(() => fileStore.openedFileHandle)

/**
 * debug
 */
consola.level = LogLevels.debug

onMounted(async () => {
  // await sleep(10)
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center">
    <AdvGame v-if="show" class="h-full w-full" />
    <div
      v-else
      class="inline-flex flex-col cursor-pointer items-center"
      @click="fileStore.openAdvConfigFile"
    >
      <div class="glow-icon text-8xl">
        <div
          class="i-vscode-icons:file-type-jsonld"
        />
      </div>
      <div class="text-base op-50">
        Open ADV Config File
      </div>
    </div>
  </div>
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
