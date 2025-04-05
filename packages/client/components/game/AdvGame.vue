<script lang="ts" setup>
// Game Instance
import type { AdvAst, AdvConfig } from '@advjs/types'

import { useAppStore } from '@advjs/client'
import { useBeforeUnload } from '@advjs/core'
import { computed } from 'vue'
import { useAdvContext } from '../../composables/useAdvContext'

defineProps<{
  frontmatter?: AdvConfig
  ast?: AdvAst.Root
}>()

const { $adv } = useAdvContext()

// const curNode = computed(() => $adv.store.curNode)
const curNode = computed(() => $adv.store.curFlowNode)

// 添加提示，防止意外退出
if (!__DEV__)
  useBeforeUnload()

const app = useAppStore()
const tachies = computed(() => $adv.tachies.value)
</script>

<template>
  <AdvContainer
    text="white" class="h-screen w-screen"
    :config="$adv.config.value"
  >
    <div class="adv-game absolute h-full w-full bg-black">
      <AdvScene />
      <AdvPixiCanvas />
      <slot name="scene" />
      <AdvTachieBox :tachies="tachies" />

      <AdvBlack v-if="curNode && curNode.type === 'narration'" class="z-9" :content="curNode" />

      <slot />
    </div>

    <div class="adv-ui absolute" w="full" h="full">
      <BaseLayer v-if="!app.showUi" />

      <Transition enter-active-class="animate__fadeInUp" leave-active-class="animate__fadeOutDown">
        <AdvDialogBox v-if="curNode" v-show="app.showUi" :node="curNode" class="adv-animated z-1" />
      </Transition>

      <Transition enter-active-class="animate__fadeInUp" leave-active-class="animate__fadeOutDown">
        <!-- todo: fix types -->
        <AdvChoice v-if="curNode" v-show="curNode?.type === 'choices'" :node="curNode as any" class="adv-animated z-2" />
      </Transition>

      <Transition enter-active-class="animate__fadeInUp" leave-active-class="animate__fadeOutDown">
        <DialogControls v-show="app.showUi" class="adv-animated absolute bottom-1 left-0 right-0 z-3" />
      </Transition>
      <Transition enter-active-class="animate__fadeInDown" leave-active-class="animate__fadeOutUp">
        <AdvGameUI v-show="app.showUi" class="adv-animated z-99" />
      </Transition>

      <AdvHistory />
    </div>
  </AdvContainer>
</template>
