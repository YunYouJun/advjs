import type { AdvDialoguesNode } from '@advjs/types'
import { speak, useAdvContext, useDialogStore, useSettingsStore } from '@advjs/client'
import { computed, ref, unref, watch } from 'vue'

export function useAdvDialogBox() {
  const { $adv } = useAdvContext()

  const settings = useSettingsStore()
  const store = $adv.store

  const dialogStore = useDialogStore()

  /**
   * dialogues 包含多个对话子节点
   */
  const dialoguesNode = computed(() => $adv.store.cur.dialog)
  const curDialog = computed(() => {
    if (store.cur.dialog) {
    // 如果当前对话是单个对话节点
      if (store.cur.dialog.type === 'dialog') {
        return store.cur.dialog as any
      }
      // 如果当前对话是对话组
      if (store.cur.dialog.type === 'dialogues') {
        return (store.cur.dialog as AdvDialoguesNode).dialogues[dialogStore.iOrder]
      }
    }
    return null
  })

  // watch order, update dialog
  watch(() => store.curNode, () => {
    if (store.curNode?.type === 'dialogues') {
      store.cur.dialog = store.curNode as AdvDialoguesNode
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
        speak(val?.text, unref((typeof lang === 'function' ? lang() : lang)) || 'zh-CN')
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

    if (dialoguesNode.value.type === 'dialogues') {
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

  /**
   * 是否显示下一页光标
   */
  const showNextCursor = computed(() => {
    if (dialoguesNode.value.type === 'dialogues') {
      return dialogStore.iOrder < (dialoguesNode.value.dialogues.length - 1) && store.curFlowNode.type !== 'end'
    }
    return true
  })

  return {
    curDialog,
    curCharacter,
    characterAvatar,
    dialoguesNode,
    end,
    animation,
    showNextCursor,
    next,
    transitionFlag,
    fontSizeClass,
  }
}
