import { speak, useAdvContext, useSettingsStore } from '@advjs/client'
import { computed, shallowRef, unref, watch } from 'vue'

export function useAdvDialogBox() {
  const { $adv } = useAdvContext()
  const settings = useSettingsStore()

  const curDialog = computed(() => {
    const node = $adv.store.current
    if (!node || (node.kind !== 'dialog' && node.kind !== 'text'))
      return null
    return {
      character: typeof node.data?.character === 'string' ? node.data.character : '',
      text: typeof node.data?.text === 'string' ? node.data.text : '',
    }
  })

  watch(curDialog, (dialog) => {
    if (!settings.storage.speech || !dialog?.text)
      return
    const lang = settings.storage.speechOptions.lang
    speechSynthesis.cancel()
    speak(dialog.text, unref((typeof lang === 'function' ? lang() : lang)) || 'zh-CN')
  })

  const printed = shallowRef(false)
  const animation = shallowRef(true)
  watch(() => $adv.store.current?.id, () => {
    printed.value = false
    animation.value = true
  })

  async function next() {
    if (!printed.value) {
      printed.value = true
      return
    }
    await $adv.runtime.next()
  }

  const curCharacter = computed(() => {
    const name = curDialog.value?.character ?? ''
    return $adv.gameConfig.value.characters.find(character => (
      character.id === name || character.name === name || character.aliases?.includes(name)
    )) ?? (name ? { id: name, name } : undefined)
  })

  const characterAvatar = computed(() => {
    const avatar = curCharacter.value && 'avatar' in curCharacter.value
      ? curCharacter.value.avatar
      : undefined
    if (avatar && $adv.config.value.cdn.enable && !avatar.startsWith('http'))
      return `${$adv.config.value.cdn.prefix || ''}${avatar}`
    return avatar
  })

  const transitionFlag = shallowRef(true)
  watch(() => curCharacter.value?.name, () => {
    transitionFlag.value = false
    setTimeout(() => {
      transitionFlag.value = true
    }, 1)
  })

  const fontSizeClass = computed(() => `text-${settings.storage.text.curFontSize}`)
  const showNextCursor = computed(() => {
    const kind = $adv.store.current?.kind
    return kind !== 'choices' && kind !== 'end'
  })

  return {
    animation,
    characterAvatar,
    curCharacter,
    curDialog,
    fontSizeClass,
    next,
    printed,
    showNextCursor,
    transitionFlag,
  }
}
