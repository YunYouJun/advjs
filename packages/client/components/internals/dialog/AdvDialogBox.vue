<script setup lang="ts">
import type { AdvAst, AdvDialogNode, AdvDialoguesNode } from '@advjs/types'
import { speak, useAdvContext, useDialogStore, useSettingsStore } from '@advjs/client'
import { computed, ref, unref, watch } from 'vue'

const props = defineProps<{
  node: AdvAst.Child | AdvDialogNode
}>()

const { $adv } = useAdvContext()

const settings = useSettingsStore()
const store = $adv.store

const dialogStore = useDialogStore()

/**
 * dialogues 包含多个对话子节点
 */
const dialoguesNode = computed<AdvDialoguesNode>(() => $adv.store.cur.dialog as AdvDialoguesNode)
const curDialog = computed(() => dialoguesNode.value.dialogues[dialogStore.iOrder] as AdvDialogNode)

// watch order, update dialog
watch(() => store.curFlowNode, () => {
  if (store.curFlowNode.type === 'dialogues') {
    store.cur.dialog = store.curFlowNode as AdvDialoguesNode
    dialogStore.iOrder = 0
  }
  else if (store.curNode?.type === 'dialog') {
    store.cur.dialog = store.curNode
  }
})

watch(
  () => curDialog?.value,
  (val) => {
    const lang = settings.storage.speechOptions.lang
    // 若开启了语音合成
    if (settings.storage.speech) {
      speechSynthesis.cancel()
      speak(val.text, unref((typeof lang === 'function' ? lang() : lang)) || 'zh-CN')
    }
  },
)

const end = ref(false)
const animation = ref(true)

async function next() {
  /**
   * 如果当前节点非对话节点，则直接跳转到下一个节点
   */
  if (store.curFlowNode.type !== 'dialogues') {
    await $adv.$nav.next()
    return
  }

  // temp for flow node
  // if ($adv.store.status.isEnd)
  // return

  // if (!end.value && animation.value) {
  //   animation.value = false
  //   return
  // }
  // else {
  //   // reset
  //   animation.value = true
  //   end.value = false
  // }

  if (dialoguesNode.value.dialogues) {
    const length = dialoguesNode.value.dialogues.length

    if (dialogStore.iOrder + 1 >= length) {
      await $adv.$nav.next()
    }
    else {
      dialogStore.iOrder++
    }
  }
}

const curCharacter = computed(() => {
  const characterID = curDialog.value?.speaker
  const character = $adv.gameConfig?.value?.characters?.find(item => item.id === characterID)
  return character
})

const characterAvatar = computed(() => {
  const advConfig = $adv.config.value
  const gameConfig = $adv.gameConfig.value
  const curName = curCharacter.value ? curCharacter.value.name : ''
  const avatar = gameConfig.characters?.find(item => item.name === curName || item.alias === curName || (Array.isArray(item.alias) && item.alias.includes(curName)))?.avatar
  const prefix = advConfig.cdn.enable ? (advConfig.cdn.prefix || '') : ''
  return avatar ? prefix + avatar : ''
})

// 当前对话框中的台词
const curWords = computed(() => {
  if (props.node) {
    if (props.node.type === 'dialog') {
      return (props.node as AdvDialogNode).text
    }
    if (props.node.type === 'text') {
      return props.node.value
    }
  }

  return curDialog.value?.text
})

// trigger transition
const transitionFlag = ref(true)
watch(() => curCharacter.value?.name, () => {
  transitionFlag.value = false
  setTimeout(() => {
    transitionFlag.value = true
  }, 1)
})

const fontSizeClass = computed(() => {
  return `text-${settings.storage.text.curFontSize}`
})
</script>

<template>
  <div class="adv-dialog-box cursor-pointer select-none pt-20 shadow-xl" grid="~ cols-12" gap="12" @click="next">
    <div class="col-span-3 text-right">
      <template v-if="$adv.config?.value?.showCharacterAvatar && characterAvatar">
        <div flex="~ col" class="items-end justify-center">
          <img class="size-40 rounded shadow" object="cover top" :src="characterAvatar">
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
      class="dialog-content col-span-9 pr-24 text-left"
      :class="fontSizeClass"
    >
      <PrintWords
        :animation="animation"
        :speed="settings.storage.text.curSpeed"
        :words="curWords"
        @end="end = true"
      />
      <span
        v-if="dialogStore.iOrder < (dialoguesNode.dialogues.length - 1) && store.curFlowNode.type !== 'end'"
        class="typed-cursor"
      >
        ▼
      </span>
    </div>
  </div>
</template>

<style lang="scss">
.adv-dialog-box {
  height: 30%;

  position: absolute;
  left: -1px;
  right: -1px;
  bottom: -2px;

  // background-color: rgba(0, 0, 0, 0.7);
  background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.8) 20%, black) repeat bottom;
  // 硬件加速，修复 1px 空白问题
  transform: translateZ(0);

  text-shadow: 0 0 0.2rem black;

  .dialog-content {
    color: white;

    text-shadow: 0 0 0.2rem black;
  }
}
</style>
