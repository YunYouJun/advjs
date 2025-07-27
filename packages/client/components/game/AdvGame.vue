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
if (!import.meta.env.DEV && typeof __DEV__ !== 'undefined' && !__DEV__)
  useBeforeUnload()

const app = useAppStore()
</script>

<template>
  <AdvContainer
    text="white"
    :config="$adv.config?.value"
  >
    <div class="adv-game absolute size-full bg-black">
      <AdvScene />
      <AdvPixiCanvas />
      <slot name="scene" />
      <AdvTachieBox class="z-1" :tachies-map="$adv.runtime.tachiesMapRef.value" />

      <AdvBlack v-if="curNode && curNode.type === 'narration'" class="z-9" :content="curNode" />

      <slot />
    </div>

    <div class="adv-ui absolute" w="full" h="full">
      <BaseLayer v-if="!app.showUi" />

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <AdvDialogBox v-if="curNode" v-show="app.showUi" :node="curNode" class="z-2 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <AdvChoice v-if="curNode" v-show="curNode?.type === 'choices'" :node="curNode" class="z-3 animate-duration-200" />
      </Transition>

      <Transition v-if="app.showDialogControls" enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <DialogControls v-show="app.showUi" class="absolute bottom-1 left-0 right-0 z-4 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in-down" leave-active-class="animate-fade-out-up">
        <AdvGameUI v-show="app.showUi" class="z-99 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in" leave-active-class="animate-fade-out">
        <AdvEnd v-if="curNode?.type === 'end'" />
      </Transition>

      <AdvGameModals />
    </div>
  </AdvContainer>
</template>
