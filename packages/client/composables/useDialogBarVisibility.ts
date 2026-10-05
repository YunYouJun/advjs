import type { Ref } from 'vue'
import type { DialogBarMode } from '../stores/settings/types'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'

/** Keep auto-hiding controls available while the player is using them. */
export function useDialogBarVisibility(mode: Ref<DialogBarMode>, holdOpen: Ref<boolean> = shallowRef(false)) {
  const expanded = shallowRef(mode.value !== 'collapsed')
  const hovered = shallowRef(false)
  const focused = shallowRef(false)
  const hintOpen = shallowRef(false)
  const visible = computed(() => mode.value === 'always' || expanded.value)
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  watch(mode, value => expanded.value = value !== 'collapsed')
  watch([mode, expanded, hovered, focused, hintOpen, holdOpen], () => {
    clearTimer()
    if (mode.value === 'auto' && expanded.value && !hovered.value && !focused.value && !hintOpen.value && !holdOpen.value)
      timer = setTimeout(() => expanded.value = false, 3000)
  }, { immediate: true })
  onScopeDispose(clearTimer)

  function expand() {
    expanded.value = true
  }

  function collapse() {
    if (mode.value === 'always')
      mode.value = 'collapsed'
    expanded.value = false
    focused.value = false
    hintOpen.value = false
    clearTimer()
  }

  function setHover(value: boolean, expandOnHover = true) {
    hovered.value = value
    if (value && expandOnHover && mode.value === 'auto')
      expand()
  }

  return { visible, expand, collapse, setHover, focused, hintOpen }
}
