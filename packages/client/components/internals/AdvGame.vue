<script lang="ts" setup>
// Game Instance
import type { AdvAst, AdvConfig, Tachie } from '@advjs/types'

import { useBeforeUnload } from '@advjs/client/composables'
import { computed, ref } from 'vue'
import { getCharacter } from '@advjs/core'
import { useAppStore } from '~/stores/app'

import { useAdvCtx } from '~/setup/adv'
import { useAdvKeys } from '~/composables'

defineProps<{
  frontmatter?: AdvConfig
  ast: AdvAst.Root
}>()

const $adv = useAdvCtx()

const isDev = ref(__DEV__)
const curNode = computed(() => $adv.store.curNode)

// 添加提示，防止意外退出
if (!__DEV__)
  useBeforeUnload()

const app = useAppStore()

useAdvKeys()

// tachies map by cur characters
const tachies = computed(() => {
  const tachiesMap = new Map<string, Tachie>()

  if ($adv.store.cur.tachies.size) {
    $adv.store.cur.tachies.forEach((tachie, key) => {
      const character = getCharacter($adv.config.characters, key)
      if (character)
        tachiesMap.set(key, character.tachies[tachie.status || 'default'])
    })
  }

  return tachiesMap
})
</script>

<template>
  <AdvContainer text="white" class="w-screen h-screen">
    <div class="adv-game w-full h-full bg-black absolute">
      <AdvScene />
      <TachieBox :tachies="tachies" />

      <AdvBlack v-if="curNode && curNode.type === 'narration'" class="z-9" :content="curNode" />

      <slot />
    </div>

    <div class="adv-ui absolute" w="full" h="full">
      <BaseLayer v-if="!app.showUi" />

      <transition enter-active-class="animate__fadeInUp" leave-active-class="animate__fadeOutDown">
        <AdvDialogBox v-show="app.showUi" :node="curNode" class="adv-animated z-1" />
      </transition>

      <transition enter-active-class="animate__fadeInUp" leave-active-class="animate__fadeOutDown">
        <AdvChoice v-show="curNode?.type === 'choices'" :node="curNode" class="adv-animated z-2" />
      </transition>

      <transition enter-active-class="animate__fadeInUp" leave-active-class="animate__fadeOutDown">
        <DialogControls v-show="app.showUi" class="adv-animated absolute left-0 right-0 bottom-0 z-3" />
      </transition>
      <transition enter-active-class="animate__fadeInDown" leave-active-class="animate__fadeOutUp">
        <UserInterface v-show="app.showUi" class="adv-animated z-99" />
      </transition>

      <AdvHistory />
    </div>
  </AdvContainer>

  <AdvGameDebug v-if="isDev" />
</template>
