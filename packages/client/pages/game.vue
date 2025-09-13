<script setup lang="ts">
import { useAdvContext } from '@advjs/client'
import { consola } from 'consola'

// we need .adv.md
// import { defineAsyncComponent } from 'vue'

// const Drama = defineAsyncComponent(() =>
//   advConfig.value.format === 'fountain'
//     ? import('/@advjs/drama.adv.md')
//     : import('../components/game/AdvGame.vue'))

import { onMounted } from 'vue'

const isDev = import.meta.env.DEV
const { $adv } = useAdvContext()

onMounted(async () => {
  await $adv.init()

  /**
   * 开始节点 默认为第一个章节的第一个节点
   */
  const startChapter = $adv.gameConfig.value?.chapters?.[0]
  const startChapterId = startChapter?.id
  const startNodeId = startChapter.startNodeId || startChapter?.nodes?.[0]?.id
  if (!startChapterId) {
    console.error('No start chapter found in game config')
    return
  }
  if (!startNodeId) {
    console.error('No start node found in game config')
    return
  }
  consola.info(`Starting game at chapter: ${startChapterId}, node: ${startNodeId}`)
  $adv.$nav.start({
    chapterId: startChapterId,
    nodeId: startNodeId,
  })
})
</script>

<template>
  <!-- <Drama /> -->
  <AdvGame />
  <AdvDevTools v-if="isDev" />
</template>

<route lang="yaml">
meta:
  layout: adv
</route>
