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
const curNode = computed(() => $adv.store.curNode)

// 添加提示，防止意外退出
if (!__DEV__)
  useBeforeUnload()

const app = useAppStore()
</script>

<template>
  <AdvContainer
    text="white"
    :config="$adv.config?.value"
  >
    <div class="adv-game absolute h-full w-full bg-black">
      <AdvScene />
      <AdvPixiCanvas />
      <slot name="scene" />
      <AdvTachieBox :tachies="$adv.$tachies.runtime.value" />

      <AdvBlack v-if="curNode && curNode.type === 'narration'" class="z-9" :content="curNode" />

      <slot />
    </div>

    <div class="adv-ui absolute" w="full" h="full">
      <BaseLayer v-if="!app.showUi" />

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <AdvDialogBox v-if="curNode" v-show="app.showUi" :node="curNode" class="z-1 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <!-- todo: fix types -->
        <AdvChoice v-if="curNode" v-show="curNode?.type === 'choices'" :node="curNode as any" class="z-2 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <DialogControls v-show="app.showUi" class="absolute bottom-1 left-0 right-0 z-3 animate-duration-200" />
      </Transition>
      <Transition enter-active-class="animate-fade-in-down" leave-active-class="animate-fade-out-up">
        <AdvGameUI v-show="app.showUi" class="z-99 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in" leave-active-class="animate-fade-out">
        <div v-if="curNode?.type === 'end'" class="absolute bottom-0 left-0 right-0 top-0 z-50 animate-duration-200">
          <div class="h-full w-full flex items-center justify-center bg-black/60 text-8xl font-bold">
            - END -
          </div>
        </div>
      </Transition>

      <AdvHistory />
    </div>
  </AdvContainer>
</template>
