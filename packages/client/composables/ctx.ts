import { computed } from 'vue'
import { useAdvStore, useLogic } from '../setup'
import { useAdvConfig } from './config'

export function useAdvCtx() {
  // const ctx = inject(advContextSymbol)
  // if (!ctx)
  //   throw new Error('[ADV.JS] context not properly injected in app')
  // return ctx.value!

  const functions = {}
  const store = useAdvStore()

  const core = useLogic({ functions })
  const advConfig = useAdvConfig()

  return {
    onMounted() {},
    ...core,
    store,
    config: advConfig.value,
    themeConfig: computed(() => advConfig.value.themeConfig),
    functions,
  }
}
