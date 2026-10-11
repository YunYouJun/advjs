<script setup lang="ts">
import { useAdvContext, useGameStore } from '@advjs/client'
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const { $adv } = useAdvContext()
const route = useRoute()
const game = useGameStore()
let mounted = true
onBeforeUnmount(() => {
  mounted = false
})

onMounted(async () => {
  await $adv.init()
  if (!mounted)
    return
  const snapshot = game.pendingRestore
  if (snapshot) {
    $adv.runtime.restore(snapshot)
    // Clear only after successful restoration, preserving a failed load for retry.
    if (game.pendingRestore === snapshot)
      game.pendingRestore = undefined
    return
  }
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
