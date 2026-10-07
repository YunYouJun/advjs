<script setup lang="ts">
import { useAdvContext } from '@advjs/client'
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const { $adv } = useAdvContext()
const route = useRoute()

onMounted(async () => {
  await $adv.init()
  const chapterId = typeof route.query.chapter === 'string' ? route.query.chapter : ''
  const nodeId = typeof route.query.node === 'string' ? route.query.node : ''
  const chapter = chapterId ? $adv.store.program?.chapters[chapterId] : undefined
  if (chapter) {
    await $adv.runtime.go({
      chapterId,
      nodeId: nodeId || chapter.entry,
    })
  }
  else {
    await $adv.runtime.start()
  }
})
</script>

<template>
  <AdvGame />
</template>

<route lang="yaml">
meta:
  layout: adv
</route>
