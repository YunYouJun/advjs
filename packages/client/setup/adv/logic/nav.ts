import consola from 'consola'

import { getCharacter } from '@advjs/core'
import type { AdvAst } from '@advjs/types'
import { useAdvStore } from '../store'
import { advConfig } from '~/env'

export const useNav = () => {
  const store = useAdvStore()

  /**
   * run predefined
   * @param node Adv Node
   */
  async function handleAdvNode(node: AdvAst.Item) {
    switch (node.type) {
      case 'tachie': {
        const tachies = store.cur.tachies
        if (node.enter) {
          node.enter.forEach((item) => {
            const character = getCharacter(
              advConfig.game.characters,
              item.character,
            )
            if (!character)
              return 0
            const tachie = character.tachies?.[item.status || '默认']
            if (!tachie) {
              consola.error(`Can not find ${item.character}'s tachie: ${item.status}`)
              return 0
            }
            tachies.set(character.name, tachie)
          })
        }
        if (node.exit) {
          node.exit.forEach((item) => {
            tachies.delete(item)
          })
        }

        // toggle tachie & show next text
        next()
        break
      }
      case 'camera':
        store.cur.dialog = {
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

  function updateTachie(curNode: AdvAst.Dialog) {
    const character = getCharacter(
      advConfig.game.characters,
      curNode.character.name,
    )
    if (!character)
      return
    const tachie = character.tachies?.[curNode.character.status]
    if (!tachie)
      return
    if (store.cur.tachies.has(character.name))
      store.cur.tachies.set(character.name, tachie)
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
      for (const advNode of node.value)
        await handleAdvNode(advNode)
    }
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

    switch (curNode.type) {
      case 'code': {
        await handleCode(curNode)
        break
      }
      case 'dialog':
        store.cur.dialog = curNode
        if (curNode.character.status !== '') {
        // 需要切换立绘
          updateTachie(curNode)
        }
        break
      case 'text':
        store.cur.dialog = {
          character: {
            type: 'character',
            name: '',
            status: '',
          },
          children: [curNode],
        }
        break
      case 'narration':
        break
      default:
        return next()
    }
  }

  return {
    next,
  }
}