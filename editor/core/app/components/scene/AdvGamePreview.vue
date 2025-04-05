<script setup lang="ts">
import type { AdvConfig, AdvGameConfig, AdvThemeConfig } from '@advjs/types'
import type { AdvContext } from '../../../../../packages/client'
import { advConfigSymbol, defaultConfig, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
// import { useAdvConfig, useAdvContext } from '@advjs/client'
import { onMounted } from 'vue'
import { initPixi, useAdvLogic, useAdvNav, useAdvStore, useAdvTachies } from '../../../../../packages/client'
import { injectionAdvContext } from '../../../../../packages/client/constants'

// const { $adv } = useAdvContext()
// const advConfig = useAdvConfig()

// const isDev = import.meta.env.DEV

const show = ref(false)
onMounted(async () => {
  setTimeout(() => {
    show.value = true
  }, 10)
  // await $adv.init()
  // await $adv.$nav.start('background_01')
})

const config = computed<AdvConfig>(() => defaultConfig)
const gameConfig = computed<AdvGameConfig>(() => defaultConfig.gameConfig as AdvGameConfig)
const themeConfig = computed<AdvThemeConfig>(() => defaultConfig.themeConfig)

const store = useAdvStore()
const advContext: AdvContext = {
  config,
  gameConfig,
  themeConfig,
  store,
  functions: {},

  async init() {
    advContext.pixiGame = await initPixi(advContext)
  },

  $t: (key: string) => key,
  $nav: {} as ReturnType<typeof useAdvNav>,
  $logic: {} as ReturnType<typeof useAdvLogic>,
  $tachies: {} as ReturnType<typeof useAdvTachies>,
}
advContext.$nav = useAdvNav(advContext)
advContext.$logic = useAdvLogic(advContext)
advContext.$tachies = useAdvTachies(advContext)

provide(injectionAdvContext, advContext)
provide(advConfigSymbol, advContext.config)
provide(gameConfigSymbol, advContext.gameConfig)
provide(themeConfigSymbol, advContext.themeConfig)
</script>

<template>
  <AdvFlowGame v-if="show" class="h-full w-full" />
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
