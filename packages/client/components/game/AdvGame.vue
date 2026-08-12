<script lang="ts" setup>
// Game Instance
import type { AdvConfig } from '@advjs/types'

import { useAppStore } from '@advjs/client'
import { computed } from 'vue'
import { useBeforeUnload } from '../../composables'
import { useAdvContext } from '../../composables/useAdvContext'

defineProps<{
  frontmatter?: AdvConfig
}>()

const { $adv } = useAdvContext()

const curNode = computed(() => $adv.store.current)
const showsDialog = computed(() => (
  curNode.value?.kind === 'dialog' || curNode.value?.kind === 'text'
))

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
    <div class="adv-game bg-black size-full absolute">
      <AdvScene />
      <AdvPixiCanvas />
      <slot name="scene" />
      <AdvCg />
      <AdvTachieBox v-show="!$adv.store.state.stage.cg" class="z-1" :tachies-map="$adv.resources.tachiesMapRef.value" />

      <AdvBlack v-if="curNode?.kind === 'narration'" class="z-9" :node="curNode" />

      <slot />
    </div>

    <div class="adv-ui absolute" w="full" h="full">
      <BaseLayer v-if="!app.showUi" />

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <AdvDialogBox v-if="curNode && showsDialog" v-show="app.showUi" :node="curNode" class="z-2 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <AdvChoice v-if="curNode" v-show="curNode.kind === 'choices'" :node="curNode" class="z-3 animate-duration-200" />
      </Transition>

      <Transition v-if="app.showDialogControls" enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <DialogControls v-show="app.showUi" class="bottom-1 left-0 right-0 absolute z-4 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in-down" leave-active-class="animate-fade-out-up">
        <AdvGameUI v-show="app.showUi" class="z-99 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in" leave-active-class="animate-fade-out">
        <AdvEnd v-if="$adv.store.state.status === 'ended'" />
      </Transition>

      <AdvActivity v-if="$adv.store.state.status === 'waiting-activity'" />

      <AdvGameModals />
    </div>
  </AdvContainer>
</template>
