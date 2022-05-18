<script lang="ts" setup>
import type { AdvConfig, AdvRoot } from '@advjs/types'

import { isDev } from '@advjs/shared/utils'
import { useAppStore } from '~/stores/app'

import { useBeforeUnload } from '~/client/composables'
import { adv } from '~/setup/adv'
import { GameConfigKey } from '~/utils'
import { defaultGameConfig } from '~/config/game'
import { useAdvKeys } from '~/composables/key'

const props = defineProps<{
  frontmatter?: AdvConfig.GameConfig
  ast: AdvRoot
}>()

onBeforeMount(() => {
  adv.loadAst(props.ast)
})

const curNode = computed(() => {
  return adv.store.curNode.value
})

// 添加提示，防止意外退出
if (!isDev)
  useBeforeUnload()

const app = useAppStore()

useAdvKeys()

/**
 * provide game config
 */
provide(GameConfigKey, props.frontmatter || defaultGameConfig)
</script>

<template>
  <AdvContainer class="w-full h-full" text="white">
    <div class="adv-game w-full h-full bg-black absolute">
      <AdvScene />
      <TachieBox />

      <AdvBlack v-if="curNode && curNode.type === 'narration'" class="z-9" :content="curNode" />

      <slot />
    </div>

    <div class="adv-ui absolute" w="full" h="full">
      <BaseLayer v-if="!app.showUi" />

      <transition enter-active-class="animate-fadeInUp" leave-active-class="animate-fadeOutDown">
        <DialogBox v-show="app.showUi" class="animate-animated" />
      </transition>
      <transition enter-active-class="animate-fadeInUp" leave-active-class="animate-fadeOutDown">
        <DialogControls v-show="app.showUi" class="animate-animated absolute left-0 right-0 bottom-0" />
      </transition>
      <transition enter-active-class="animate-fadeInDown" leave-active-class="animate-fadeOutUp">
        <UserInterface v-show="app.showUi" class="animate-animated z-99" />
      </transition>

      <AdvHistory />
    </div>
  </AdvContainer>
  <AdvGameDebug v-if="isDev" />
</template>
