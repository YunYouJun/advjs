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

  if (adapter) {
    gameStore.curAdapter = adapter
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
  <div class="flex h-full w-full items-center justify-center">
    <AdvGame v-if="show" class="h-full w-full" />
    <AEOpenAdvConfigFile v-else />

    <AdvGameLoading class="inset-0 absolute z-9999" />
  </div>

  <AELoadOnlineConfigFileDialog />
</template>
