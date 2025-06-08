<script setup lang="ts">
import { AdvGameLoadStatusEnum } from '@advjs/client'

// import { useAdvConfig, useAdvContext } from '@advjs/client'
import { onMounted } from 'vue'
import '../../../../themes/theme-default/styles'
// const { $adv } = useAdvContext()
// const advConfig = useAdvConfig()

// const isDev = import.meta.env.DEV

const gameStore = useGameStore()
const show = computed(() => gameStore.client.loadStatus >= AdvGameLoadStatusEnum.CONFIG_LOADED)

proxyLog()

onMounted(async () => {
  // await sleep(10)
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center">
    <AdvGame v-if="show" class="h-full w-full" />
    <AEOpenProject v-else />
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
