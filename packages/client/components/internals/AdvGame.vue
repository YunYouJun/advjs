<script lang="ts" setup>
import type { AdvAst, GameConfig } from '@advjs/types'

import { useBeforeUnload } from '@advjs/client/composables'
import { computed, onBeforeMount, ref } from 'vue'
import { useAppStore } from '~/stores/app'

import { adv } from '~/setup/adv'
import { useAdvKeys } from '~/composables'

const props = defineProps<{
  frontmatter?: GameConfig
  ast: AdvAst.Root
}>()

const isDev = ref(__DEV__)

onBeforeMount(() => {
  adv.loadAst(props.ast)
})

const curNode = computed(() => {
  return adv.store.curNode
})

// 添加提示，防止意外退出
if (!__DEV__)
  useBeforeUnload()

const app = useAppStore()

useAdvKeys()

if (props.frontmatter)
  adv.store.gameConfig = props.frontmatter
</script>

<template>
  <AdvContainer class="w-full h-full" text="white">
    <div class="adv-game w-full h-full bg-black absolute">
      <AdvScene />
      <TachieBox :tachies="adv.store.cur.tachies" />

      <AdvBlack v-if="curNode && curNode.type === 'narration'" class="z-9" :content="curNode" />

      <slot />
    </div>

    <div class="adv-ui absolute" w="full" h="full">
      <BaseLayer v-if="!app.showUi" />

      <transition enter-active-class="animate__fadeInUp" leave-active-class="animate__fadeOutDown">
        <DialogBox v-show="app.showUi" class="animate__animated" />
      </transition>
      <transition enter-active-class="animate__fadeInUp" leave-active-class="animate__fadeOutDown">
        <DialogControls v-show="app.showUi" class="animate__animated absolute left-0 right-0 bottom-0" />
      </transition>
      <transition enter-active-class="animate__fadeInDown" leave-active-class="animate__fadeOutUp">
        <UserInterface v-show="app.showUi" class="animate__animated z-99" />
      </transition>

      <AdvHistory />
    </div>
  </AdvContainer>
  <AdvGameDebug v-if="isDev" />
</template>
