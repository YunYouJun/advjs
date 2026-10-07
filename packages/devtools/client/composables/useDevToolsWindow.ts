import type { Ref } from 'vue'
import { computed, ref } from 'vue'

export function useDevToolsWindow(session: Ref<string>, view: Ref<string>, dark: Ref<boolean>) {
  const independent = window.parent === window
  const blocked = ref(false)
  const windowUrl = computed(() => {
    const url = new URL('.', location.href)
    if (session.value)
      url.searchParams.set('session', session.value)
    url.searchParams.set('view', view.value)
    url.searchParams.set('theme', dark.value ? 'dark' : 'light')
    return url.href
  })
  function openWindow() {
    const popup = window.open(windowUrl.value, `advjs-devtools:${location.origin}${location.pathname}`, 'popup=yes,width=1000,height=760')
    blocked.value = !popup
    if (popup) {
      popup.focus()
      window.parent.postMessage('advjs-devtools:detach', location.origin)
    }
  }
  return { independent, blocked, windowUrl, openWindow }
}
