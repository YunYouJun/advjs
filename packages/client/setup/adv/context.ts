import type { AdvAst } from '@advjs/types'
import { computed, inject } from 'vue'
import type { InjectionKey } from 'vue'

import { parseAst } from '@advjs/parser'

import type { AdvContext } from './types'
import { useAdvStore } from './store'
import { useNav } from './logic/nav'
import { configs } from '~/env'

export const injectionAdvContext: InjectionKey<AdvContext> = Symbol('advjs-context')

export const useContext = () => {
  const store = useAdvStore()
  const nav = useNav()

  /**
   * 理解文本
   * @param text
   */
  async function read(text: string) {
    const data = await parseAst(text)
    store.ast=data.ast
  }

  return {
    core: {
      read,

      loadAst(ast: AdvAst.Root) {
        store.ast = ast
      },
    },

    nav,
    store,
    config: configs,
    themeConfig: computed(() => configs.themeConfig),
  }
}

export function useAdvCtx() {
  const ctx = inject(injectionAdvContext)
  if (!ctx)
    throw new Error('[ADV.JS] context not properly injected in app')
  return ctx!
}
