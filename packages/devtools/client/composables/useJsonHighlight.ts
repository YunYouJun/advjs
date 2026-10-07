import type { InjectionKey, Ref } from 'vue'
import type { JsonHighlightToken } from '../../../shared/json-highlight'
import { inject, shallowRef, watch } from 'vue'
import { canHighlightJson } from '../../../shared/json-highlight'

export interface JsonHighlightContext {
  ready: Readonly<Ref<boolean>>
  highlight: (code: string) => Promise<JsonHighlightToken[] | undefined>
}

export const jsonHighlightKey: InjectionKey<JsonHighlightContext> = Symbol('advjs-json-highlight')

export function useJsonHighlight(code: () => string, enabled: () => boolean) {
  const context = inject(jsonHighlightKey, undefined)
  const tokens = shallowRef<JsonHighlightToken[]>()
  watch([code, enabled, () => context?.ready.value], async ([value, active, ready], _, onCleanup) => {
    tokens.value = undefined
    if (!context || !active || !ready || !canHighlightJson(value))
      return
    let stale = false
    onCleanup(() => stale = true)
    try {
      const result = await context.highlight(value)
      if (!stale)
        tokens.value = result
    }
    catch {
      // Keep the original text available while the service is unavailable.
    }
  }, { immediate: true })
  return tokens
}
