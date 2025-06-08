<script lang="ts" setup>
import type { AdvConfigAdapterType } from '../types'
import { AdvGameLoadStatusEnum } from '@advjs/client'
import '../../../../themes/theme-default/styles'

const gameStore = useGameStore()
const projectStore = useProjectStore()
const show = computed(() => gameStore.client.loadStatus >= AdvGameLoadStatusEnum.CONFIG_LOADING)

const route = useRoute()

onMounted(() => {
  const { gameId, adapter } = route.query as {
    gameId?: string
    adapter?: AdvConfigAdapterType
  }

  if (gameId && adapter) {
    projectStore.online.openOnlineAdvProject({
      adapter,
      gameId,
      host: {
        platform: 'yunlefun',
      },
    })
  }
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center">
    <AdvGame v-if="show" class="h-full w-full" />
    <AEOpenAdvConfigFile v-else />

    <AdvGameLoading class="absolute inset-0 z-9999" />
  </div>

  <AELoadOnlineConfigFileDialog />
</template>
