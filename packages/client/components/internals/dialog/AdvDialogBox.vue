<script setup lang="ts">
import type { AdvAst, AdvDialogNode } from '@advjs/types'
import { useAdvContext, useSettingsStore } from '@advjs/client'
import { computed } from 'vue'
import { useAdvDialogBox } from '../../../composables/useAdvDialogBox'

const props = defineProps<{
  node: AdvDialogNode | AdvAst.Dialog | AdvAst.Text
}>()

const { $adv } = useAdvContext()

const settings = useSettingsStore()

const {
  next,
  curCharacter,
  characterAvatar,
  printed,
  animation,
  transitionFlag,
  fontSizeClass,
  showNextCursor,
  curDialog,
} = useAdvDialogBox()

// 当前对话框中的台词
const curWords = computed(() => {
  if (props.node) {
    if (props.node.type === 'dialog') {
      return (props.node as AdvAst.Dialog).children.map((child) => {
        if (child.type === 'text') {
          return child.value
        }
        return ''
      }).join('')
    }
    if (props.node.type === 'text') {
      return props.node.value
    }
  }

  return curDialog.value?.text
})
</script>

<template>
  <div
    class="adv-dialog-box pt-30 cursor-pointer select-none shadow-xl" grid="~ cols-12" gap="12"
    @click="next"
  >
    <div class="text-right col-span-3">
      <template v-if="$adv.config?.value?.showCharacterAvatar && characterAvatar">
        <div flex="~ col" class="items-end justify-center">
          <img class="rounded size-40 shadow" object="cover top" :src="characterAvatar">
          <span class="w-40" m="t-4" text="xl center white/80">{{ curCharacter?.name }}</span>
        </div>
      </template>
      <template v-else>
        <Transition name="fade">
          <span v-if="transitionFlag" class="dialog-name text-4xl text-gray-200 font-medium" :class="fontSizeClass">{{ curCharacter?.name }}</span>
        </Transition>
      </template>
    </div>
    <div
      class="dialog-content pr-24 text-left col-span-9"
      :class="fontSizeClass"
    >
      <PrintWords
        v-model:printed="printed"
        :animation="animation"
        :speed="settings.storage.text.curSpeed"
        :words="curWords"
      />
      <span
        v-if="showNextCursor"
        class="typed-cursor"
      >
        ▼
      </span>
    </div>
  </div>
</template>

<style lang="scss">
.adv-dialog-box {
  // use int to fix percent 1px issue
  height: 350px;

  position: absolute;
  left: -1px;
  right: -1px;
  bottom: -5px;

  // background-color: rgba(0, 0, 0, 0.7);
  background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.75) 35%, black) repeat bottom;
  // 硬件加速，修复 1px 空白问题
  transform: translateZ(0);

  text-shadow: 0 0 0.2rem black;

  .dialog-content {
    color: white;

    text-shadow: 0 0 0.2rem black;
  }
}
</style>
