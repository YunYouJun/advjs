<script lang="ts" setup>
import type { AdvStartMenuItem } from '@advjs/client'

import { usePominisStore } from '../stores/pominis'

const route = useRoute()
const router = useRouter()

const pominisStore = usePominisStore()
const playStore = usePlayStore()

const menuItems = ref<AdvStartMenuItem[]>([
  {
    id: 'start',
    title: 'Start Game',
    do: async () => {
      // Logic to start the game
      // console.log('Starting game...')
      router.push({
        path: '/game',
        query: route.query,
      })
    },
  },
  // {
  //   id: 'settings',
  //   title: 'Settings',
  //   do: () => {
  //     // Logic to open settings
  //     console.log('Opening settings...')
  //   },
  // },
  // {
  //   id: 'help',
  //   icon: 'icon-help',
  //   title: 'Help',
  //   do: () => {
  //     // Logic to show help
  //     console.log('Showing help...')
  //   },
  // },
])

onMounted(async () => {
  playStore.loading = true
  // pominisStore

  const query = route.query
  const pominisId = query.pominisId as string | undefined

  if (pominisId) {
    playStore.curAdapter = 'pominis'

    const token = query.token as string | undefined
    const data = await pominisStore.fetchPominisStory({
      id: pominisId,
      token,
    })
    await playStore.loadGameFromConfig(data)
    playStore.loading = false

    route.meta.title = data.title || '游戏标题'
  }
})
</script>

<template>
  <div
    class="animate__animated animate__fadeIn adv-start-game-logo inline-flex flex-col animate-delay-600 items-center mix-blend-hard-light"
    absolute right-5rem min-w-25rem
  >
    <slot name="logo">
      <!-- custom logo -->
      <PominisLogo class="absolute right-5 top-20" />
    </slot>
  </div>

  <PominisCover />
  <PominisStartMenu :menu-items="menuItems" />

  <AdvGameModals />
</template>

<route lang="yaml">
meta:
  layout: start
</route>

<style lang="scss">
.adv-game-title {
  --text-shadow-color: #{rgba(#0078e7, 0.4)};
  text-shadow: 0 0 20px var(--text-shadow-color);
}

.circle-pattern {
  --circle-size: 15rem;
  width: var(--circle-size);
  height: var(--circle-size);

  mix-blend-mode: hard-light;
  border-radius: 50%;

  position: absolute;
}
</style>
