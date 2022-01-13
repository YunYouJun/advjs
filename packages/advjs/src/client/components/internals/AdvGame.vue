<template>
  <AdvContainer class="w-full h-full">
    <div class="adv-game w-full h-full bg-black relative" :style="advGameStyle">
      <TachieBox v-show="app.showTachie" :characters="characters" />

      <BaseLayer v-show="!app.showUi" />
      <DialogBox v-show="app.showUi" />
      <UserInterface v-show="app.showUi" />

      <AdvHistory />

      <AdvBlack v-if="curNode && curNode.type === 'narration'" :content="curNode" />

      <AdvCanvas />
      <slot />
    </div>
  </AdvContainer>
</template>

<script lang="ts" setup>
import type { AdvConfig, AdvRoot } from '@advjs/types'

import { isDev } from '@advjs/shared/utils'
import { characters } from '~/data/characters'
import { useAppStore } from '~/stores/app'

import { useBeforeUnload } from '~/client/composables'
import { adv } from '~/setup/adv'
import { GameConfigKey } from '~/utils'
import { defaultGameConfig } from '~/config/game'

const props = defineProps<{
  frontmatter?: AdvConfig.GameConfig
  ast: AdvRoot
}>()

adv.loadAst(props.ast)

const curNode = computed(() => {
  return adv.store.cur.node.value
})

// 添加提示，防止意外退出
if (!isDev) useBeforeUnload()

const app = useAppStore()

const advGameStyle = computed(() => {
  return {
    backgroundImage: 'url("/img/bg/night.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
})

/**
 * provide game config
 */
provide(GameConfigKey, props.frontmatter || defaultGameConfig)
</script>
