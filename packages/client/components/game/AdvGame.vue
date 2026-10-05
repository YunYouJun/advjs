<script lang="ts" setup>
// Game Instance
import type { AdvConfig } from '@advjs/types'

import { useAppStore } from '@advjs/client'
import { computed, shallowRef } from 'vue'
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
const controlsHeight = shallowRef(0)
const toolbarHeight = shallowRef(0)
const showToolbar = computed(() => app.showUi && !app.menus.settings && !app.showHistory && !app.showSaveMenu && !app.showLoadMenu)
</script>

<template>
  <AdvContainer
    text="white"
    :config="$adv.config?.value"
    :landscape="($adv.config?.value?.aspectRatio ?? 16 / 9) > 1"
    :controls-inset="app.showUi ? toolbarHeight : 0"
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

    <div class="adv-ui absolute" w="full" h="full" :style="{ '--adv-dialog-controls-height': `${controlsHeight}px` }">
      <BaseLayer v-if="!app.showUi" />

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <AdvDialogBox v-if="curNode && showsDialog" v-show="app.showUi" :node="curNode" class="z-2 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <AdvChoice v-if="curNode" v-show="curNode.kind === 'choices'" :node="curNode" class="z-3 animate-duration-200" />
      </Transition>

      <Transition enter-active-class="animate-fade-in-up" leave-active-class="animate-fade-out-down">
        <DialogControls v-show="app.showUi" class="z-4 animate-duration-200" @resize="controlsHeight = $event" />
      </Transition>

      <Transition enter-active-class="animate-fade-in" leave-active-class="animate-fade-out">
        <AdvEnd v-if="$adv.store.state.status === 'ended'" />
      </Transition>

      <AdvActivity v-if="$adv.store.state.status === 'waiting-activity'" />
    </div>
    <template #controls>
      <AdvGameUI v-show="showToolbar" @resize="toolbarHeight = $event" />
      <AdvGameModals />
    </template>
  </AdvContainer>
</template>

<style scoped>
.adv-ui {
  --adv-control-target: calc(36px / var(--adv-screen-scale, 1));
  --adv-control-bottom: calc(max(8px, env(safe-area-inset-bottom, 0px)) / var(--adv-screen-scale, 1));
  --adv-control-left: calc(max(16px, env(safe-area-inset-left, 0px)) / var(--adv-screen-scale, 1));
  --adv-control-right: calc(max(16px, env(safe-area-inset-right, 0px)) / var(--adv-screen-scale, 1));
}

@container (max-width: 600px) {
  .adv-ui {
    --adv-control-target: calc(44px / var(--adv-screen-scale, 1));
  }
}

@media (any-pointer: coarse), (max-width: 1000px) and (max-height: 500px) {
  .adv-ui {
    --adv-control-target: calc(44px / var(--adv-screen-scale, 1));
  }
}

.is-landscape-phone .adv-ui {
  --adv-control-target: calc(44px / var(--adv-screen-scale, 1));
  --adv-control-left: calc(max(16px, env(safe-area-inset-top, 0px)) / var(--adv-screen-scale, 1));
  --adv-control-right: calc(max(16px, env(safe-area-inset-bottom, 0px)) / var(--adv-screen-scale, 1));
  --adv-control-bottom: calc(max(8px, env(safe-area-inset-right, 0px)) / var(--adv-screen-scale, 1));
}
</style>
