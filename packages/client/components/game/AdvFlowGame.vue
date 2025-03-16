<script lang="ts" setup>
// Game Instance
import type { Tachie } from '@advjs/types'

import { useAdvContext, useAppStore } from '@advjs/client'
import { getCharacter, useBeforeUnload } from '@advjs/core'
import consola from 'consola'
import { computed, onMounted } from 'vue'

const { $adv } = useAdvContext()
const curNode = computed(() => $adv.store.curNode)

onMounted(() => {
  consola.start('AdvFlowGame mounted')
})

// 添加提示，防止意外退出
if (!__DEV__)
  useBeforeUnload()

const app = useAppStore()

// tachies map by cur characters
const tachies = computed(() => {
  const tachiesMap = new Map<string, Tachie>()

  if ($adv.store.cur.tachies.size) {
    $adv.store.cur.tachies.forEach((tachie, key) => {
      const character = getCharacter($adv.gameConfig.value.characters, key)
      if (character && character.tachies)
        tachiesMap.set(key, character.tachies[tachie.status || 'default'])
    })
  }

  return tachiesMap
})
</script>

<template>
  <AdvContainer text="white" class="h-screen w-screen">
    <div class="adv-game absolute h-full w-full bg-black">
      <AdvScene />
      <AdvPixiCanvas />
      <slot name="scene" />
      <TachieBox :tachies="tachies" />

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
        <UserInterface v-show="app.showUi" class="adv-animated z-99" />
      </Transition>

      <AdvHistory />
    </div>
  </AdvContainer>
</template>
