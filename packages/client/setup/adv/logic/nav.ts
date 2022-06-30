import type { AdvAst } from '@advjs/types'
import consola from 'consola'

import { getCharacter } from '@advjs/core'
import { scriptSuffix } from '@advjs/parser'
import { useAdvStore } from '../store'
import { config } from '~/env'

export const useNav = ({ functions }: { functions: Record<string, () => void> }) => {
  const store = useAdvStore()

  /**
   * handle adv ast
   * @param node
   * @returns
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
    if (scriptSuffix.includes(lang)) {
      functions[`codeFunc${store.cur.order}`]()
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

  /**
   * run predefined
   * @param node Adv Node
   */
  async function handleCodeOperation(node: AdvAst.CodeOperation) {
    const store = useAdvStore()

    switch (node.type) {
      case 'tachie': {
        const tachies = store.cur.tachies
        if (node.enter) {
          node.enter.forEach((item) => {
            const character = getCharacter(config.characters, item.name)
            if (!character) {
              consola.warn(`Can not find ${item.name}`)
              return
            }

            const status = item.status || 'default'
            const tachie = character.tachies?.[status]
            if (!tachie) {
              consola.error(`Can not find ${item.name}'s tachie: ${status}`)
              return
            }

            tachies.set(character.name, { status })
          })
        }
        if (node.exit) {
          node.exit.forEach((item) => {
            tachies.delete(item)
          })
        }

        // toggle tachie & show next text
        return true
      }
      case 'camera':
        store.cur.dialog = {
          type: 'dialog',
          character: {
            type: 'character',
            name: '',
            status: '',
          },
          children: [
            {
              type: 'text',
              value: '（镜头动画）',
            },
          ],
        }
        break
      case 'go':
        go(node.target)
        break
      case 'background':
        store.cur.background = node.url
        break
      default:
        break
    }
  }

  /**
   * go to scene
   * @param target
   */
  function go(target: string) {
    const order = store.ast.scene[target]
    if (isNaN(order))
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

    handleAdvNode,
  }
}
