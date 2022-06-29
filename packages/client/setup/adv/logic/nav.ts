import consola from 'consola'

import { getCharacter } from '@advjs/core'
import type { AdvAst } from '@advjs/types'
import { useAdvStore } from '../store'
import { initConfig } from '~/env'

/**
 * handle adv ast
 * @param node
 * @returns
 */
export async function handleAdvNode(node: AdvAst.Child) {
  const store = useAdvStore()

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
  if (node.lang === 'ts') {
    // await node.do()
  }
  else if (node.lang === 'advnode') {
    // node.value is an array
    for (const advNode of node.value) {
      if (await handleCodeAdvNode(advNode))
        return true
    }
  }
}

/**
   * run predefined
   * @param node Adv Node
   */
async function handleCodeAdvNode(node: AdvAst.Item) {
  const store = useAdvStore()
  const config = initConfig()

  switch (node.type) {
    case 'tachie': {
      const tachies = store.cur.tachies
      if (node.enter) {
        node.enter.forEach((item) => {
          const character = getCharacter(
            config.value.characters,
            item.name,
          )
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
    case 'background':
      store.cur.background = node.url
      break
    default:
      break
  }
}

export const useNav = () => {
  const store = useAdvStore()

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
  }
}
