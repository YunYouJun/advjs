import type { AdvAst } from '@advjs/types'
import { computed, inject } from 'vue'
import type { InjectionKey } from 'vue'

import { parseAst } from '@advjs/parser'

import { getCharacter } from '@advjs/core'
import type { AdvContext } from './types'
import { useAdvStore } from './store'
import { handleAdvNode, useNav } from './logic/nav'
import { configs as config } from '~/env'

export const injectionAdvContext: InjectionKey<AdvContext> = Symbol('advjs-context')

export const useCore = (store: ReturnType<typeof useAdvStore>) => {
  /**
   * 理解文本
   * @param text
   */
  async function read(text: string) {
    store.ast = await parseAst(text)
  }

  return {
    read,

    loadAst(ast: AdvAst.Root) {
      store.ast = ast

      // handle ast first node
      if (store.cur.order === 0 && ast.children[0])
        handleAdvNode(ast.children[0])
    },

    updateTachie(curNode: AdvAst.Dialog) {
      const character = getCharacter(
        config.characters,
        curNode.character.name,
      )
      if (!character)
        return
      const tachie = character.tachies?.[curNode.character.status]
      if (!tachie)
        return
      if (store.cur.tachies.has(character.name))
        store.cur.tachies.set(character.name, tachie)
    },
  }
}

export const useContext = () => {
  const store = useAdvStore()
  const nav = useNav()

  const core = useCore(store)

  return {
    core,
    nav,
    store,
    config,
    themeConfig: computed(() => config.themeConfig),
  }
}

export function useAdvCtx() {
  const ctx = inject(injectionAdvContext)
  if (!ctx)
    throw new Error('[ADV.JS] context not properly injected in app')
  return ctx!
}
