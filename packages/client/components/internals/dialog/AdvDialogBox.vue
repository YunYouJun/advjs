<script setup lang="ts">
import type { AdvAst, AdvDialogNode, AdvDialoguesNode } from '@advjs/types'
import { speak, useAdvContext, useSettingsStore } from '@advjs/client'
import { computed, ref, unref, watch } from 'vue'

const props = defineProps<{
  node: AdvAst.Child
}>()

const { $adv } = useAdvContext()

const settings = useSettingsStore()
const store = $adv.store

/**
 * dialogues 包含多个对话子节点
 */
const dialogues = computed(() => $adv.store.cur.dialog)
// 局部 words order，与全局 order 相区别
const iOrder = ref(0)
const curDialog = computed(() => dialogues.value.children[iOrder.value] as AdvDialogNode)

// watch order, update dialog
watch(() => store.curFlowNode, () => {
  if (store.curFlowNode.type === 'dialogues') {
    store.cur.dialog = store.curFlowNode as AdvDialoguesNode
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
  //   return

  // if (!end.value && animation.value) {
  //   animation.value = false
  //   return
  // }
  // else {
  //   // reset
  //   animation.value = true
  //   end.value = false
  // }

  if (dialogues.value.children) {
    const length = dialogues.value.children.length

    if (iOrder.value + 1 > length - 1) {
      await $adv.$nav.next()
      iOrder.value = 0
    }
    else {
      iOrder.value++
    }
  }
}

const curCharacter = computed(() => {
  const characterID = curDialog.value?.speaker
  const character = $adv.gameConfig.value.characters?.find(item => item.id === characterID)
  return character
})

const characterAvatar = computed(() => {
  const advConfig = $adv.config.value
  const gameConfig = $adv.gameConfig.value
  const curName = curCharacter.value ? curCharacter.value.name : ''
  const avatar = gameConfig.characters.find(item => item.name === curName || item.alias === curName || (Array.isArray(item.alias) && item.alias.includes(curName)))?.avatar
  const prefix = advConfig.cdn.enable ? (advConfig.cdn.prefix || '') : ''
  return avatar ? prefix + avatar : ''
})

// 当前对话框中的台词
const curWords = computed(() => {
  if (props.node && props.node.type === 'text')
    return props.node.value

  return curDialog.value

  if (store.curFlowNode.type === 'dialogues') {
    // return store.curFlowNode.dialogues[iOrder.value]?.value
  }
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
  <div class="adv-dialog-box cursor-pointer select-none pt-12 shadow-xl" grid="~ cols-12" gap="12" @click="next">
    <div v-if="curCharacter" class="col-span-3 text-right">
      <template v-if="$adv.config.value.showCharacterAvatar && characterAvatar">
        <div flex="~ col" class="items-end justify-center">
          <img class="h-25 w-25 rounded shadow" object="cover top" :src="characterAvatar">
          <span class="w-25" m="t-2" text="center gray-400">{{ curCharacter.name }}</span>
        </div>
      </template>
      <template v-else>
        <Transition name="fade">
          <span v-if="transitionFlag" class="dialog-name text-4xl text-gray-200 font-medium" :class="fontSizeClass">{{ curCharacter.name }}</span>
        </Transition>
      </template>
    </div>
    <div class="dialog-content col-span-9 pr-24 text-left" :class="fontSizeClass">
      <PrintWords
        :animation="animation"
        :speed="settings.storage.text.curSpeed"
        :words="curWords" @end="end = true"
      />
      <span v-if="!$adv.store.status.isEnd" class="typed-cursor">
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
