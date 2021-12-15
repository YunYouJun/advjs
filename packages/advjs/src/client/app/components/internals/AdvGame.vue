<template>
  <AdvContainer class="w-full h-full">
    <div class="adv-game w-full h-full bg-black" :style="advGameStyle">
      <BaseLayer v-show="!app.showUi" />
      <TachieBox :characters="characters" />
      <DialogBox v-show="app.showUi" />
      <UserInterface v-show="app.showUi" />
      <AdvHistory />
      <slot />
    </div>
  </AdvContainer>
</template>

<script lang="ts" setup>
import type { AdvRoot } from '@advjs/types'

import { characters } from '~/data/characters'
import { useAppStore } from '~/stores/app'

import { useBeforeUnload } from '~/client/app/composables'
import { adv } from '~/setup/adv'

const props = defineProps<{
  frontmatter?: any
  ast: AdvRoot
}>()

adv.loadAst(props.ast)

// 添加提示，防止意外退出
if (import.meta.env.PROD) useBeforeUnload()

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
 * 展示下个对话
 */
// function nextDialog() {
//   if (dialogIndex.value === curDialogs.value.length) {
//     dialogIndex.value = 0
//     curDialogs.value = []
//     nextParagraph()
//   }
//   else if (dialogIndex.value < curDialogs.value.length) {
//     const line = curDialogs.value[dialogIndex.value] as Line
//     dialog.name = line.character.name
//     dialog.words = line.words.text
//     updateTachieStatus(line.character)
//     dialogIndex.value++
//   }
// }
</script>
