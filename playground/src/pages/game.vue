<script lang="ts" setup>
// import type { AdvConfigAdapterType } from '../types'
// import { AdvGameLoadStatusEnum } from '@advjs/client'
import '@advjs/theme-pominis/styles'

// const show = computed(() => gameStore.client.loadStatus >= AdvGameLoadStatusEnum.CONFIG_LOADING)
const show = computed(() => true)

const route = useRoute()
const router = useRouter()

const playStore = usePlayStore()
onMounted(async () => {
  const pominisId = route.query.pominisId
  if (pominisId && !playStore.gameConfig?.chapters?.length) {
    router.push({
      path: '/start',
      query: route.query,
    })

    return
  }

  await playStore.startGame()

  // const { gameId, adapter } = route.query as {
  // gameId?: string
  // adapter?: AdvConfigAdapterType
  // }

  // if (adapter) {
  // gameStore.curAdapter = adapter
  // }
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center">
    <AdvGame v-if="show" class="h-full w-full" />
    <AdvGameLoading class="absolute inset-0 z-9999" />
  </div>
</template>
