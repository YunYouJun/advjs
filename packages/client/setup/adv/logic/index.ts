import type { AdvAst } from '@advjs/types'
import { isScript, parseAst } from '@advjs/parser'
import consola from 'consola'

import { BackgroundSystem } from '~/pixi/system/background'
import { useAdvStore } from '../store'
// import { useAdvConfig } from '../../../composables'
import { useCamera } from './operation'
import { useTachies } from './tachies'

/**
 * Game Logic Helper
 */
export function useLogic(ctx: {
  functions: Record<string, () => void>
}) {
  // const advConfig = useAdvConfig()
  const store = useAdvStore()

  const useNav = () => {
    /**
     * go to scene
     * @param target
     */
    function go(target: string) {
      const order = store.ast.scene[target]
      if (Number.isNaN(order))
        consola.error(`Can not find screen ${target}`)
      else store.cur.order = order

      next()
    }

    /**
     * 下一部分
     */
    async function next(): Promise<void> {
      if (!store.ast)
        return

      const nodeLen = store.ast.children.length
      const curOrder = store.cur.order
      if (curOrder >= nodeLen)
        return

      store.cur.order++

      const curNode = store.curNode
      // 跳过无效节点（虽然应该不会有）
      if (!curNode)
        return next()

      if (__DEV__)
        consola.info(curNode)

      const skippedTypes = ['scene']
      if (skippedTypes.includes(curNode.type || ''))
        return next()

      if (await handleAdvNode(curNode))
        next()
    }

    return {
      next,
      go,
    }
  }

  const nav = useNav()

  const tachies = useTachies()

  /**
   * 理解文本
   * @param text
   */
  async function read(text: string) {
    store.ast = await parseAst(text)
  }

  /**
   * handle adv ast
   * @param node
   */
  async function handleAdvNode(node: AdvAst.Item) {
    switch (node.type) {
      case 'code': {
        if (await handleCode(node))
          return true
        break
      }
      case 'dialog':
      // watch dialog in AdvDialogBox
      // watch dialog in TachieBox to update Tachie
        break
      case 'text':
        store.cur.dialog = {
          type: 'dialog',
          character: {
            type: 'character',
            name: '',
            status: '',
          },
          children: [node],
        }
        break
      case 'narration':
      case 'choices':
        break
      default:
        return true
    }
  }

  /**
   * handle code block
   * @param node
   */
  async function handleCode(node: AdvAst.Code) {
    const lang = node.lang?.toLowerCase() || ''
    if (isScript(node)) {
      try {
        ctx.functions[node.value]()
      }
      catch (e) {
        console.error(e)
        nav.next()
      }
    }
    else if (lang === 'advnode') {
      // node.value is an array
      if (!node.value)
        return

      if (Array.isArray(node.value)) {
        for (const advNode of node.value) {
          if (await handleCodeOperation(advNode))
            return true
        }
      }
    }
  }

  const camera = useCamera()

  /**
   * run predefined
   * @param node Adv Node
   */
  async function handleCodeOperation(node: AdvAst.CodeOperation): Promise<boolean | void> {
    switch (node.type) {
      case 'tachie': {
        return tachies.handle(node)
      }
      case 'camera':
        camera.handle()
        break
      case 'go':
        nav.go(node.target)
        break
      case 'background':
        if (node.name) {
          const bg = BackgroundSystem.instance?.load(node.name)
          if (bg)
            store.cur.background = bg[node.name]
        }
        else if (node.url) {
          store.cur.background = node.url
        }
        else { consola.warn('[adv] Can not find background') }
        return true
      default:
        break
    }
  }

  return {
    core: {
      read,

      loadAst(ast: AdvAst.Root) {
        store.ast = ast

        // handle ast first node
        if (store.cur.order === 0 && ast.children[0])
          handleAdvNode(ast.children[0])
      },

      handleAdvNode,
      handleCode,
    },
    tachies,
    nav,
  }
}

export type AdvLogic = ReturnType<typeof useLogic>
