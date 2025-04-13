<script lang="ts" setup>
import type { AdvConfigAdapterType } from '../types'

const fileStore = useFileStore()
const gameStore = useGameStore()
const show = computed(() => gameStore.loadStatus === 'success')

const route = useRoute()

onMounted(() => {
  const onlineAdvConfigFileUrl = route.query.url as string
  const adapter = route.query.adapter as AdvConfigAdapterType

  if (onlineAdvConfigFileUrl && adapter) {
    fileStore.openOnlineAdvConfigFile({
      url: onlineAdvConfigFileUrl,
      adapter,
    })
  }
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center">
    <AdvGame v-if="show" class="h-full w-full" />
    <AEOpenAdvConfigFile v-else />
  </div>

  <AELoadOnlineConfigFileDialog />
</template>
