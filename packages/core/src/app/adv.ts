import { parseAst } from '@advjs/parser'
import type { AdvAst } from '@advjs/types'
import type { Code as MdCode } from 'mdast'
import consola from 'consola'
import { createAdvStore } from '../stores'
import { getCharacter } from '../utils'

export interface AdvOptions {
  /**
   * 文本
   */
  text: string

  /**
   * 调试模式
   */
  debug?: boolean
}

/**
 * 创建 ADV 实例
 * @param options
 * @returns
 */
export function createAdv(options?: Partial<AdvOptions>) {
  const defaultOptions = {
    debug: false,
  }

  options = {
    ...defaultOptions,
    ...options,
  }

  const store = createAdvStore()

  /**
   * 演出开始
   */
  function play() {}

  /**
   * 理解文本
   * @param text
   */
  async function read(text: string) {
    store.ast.value = await parseAst(text)
  }

  /**
   * handle code block
   * @param node
   */
  async function handleCode(node: AdvAst.Code | MdCode) {
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
   * run predefined
   * @param node Adv Node
   */
  async function handleAdvNode(node: AdvAst.Item) {
    switch (node.type) {
      case 'tachie': {
        const tachies = store.cur.value.tachies
        if (node.enter) {
          node.enter.forEach((item) => {
            const character = getCharacter(
              store.gameConfig.characters,
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
        store.cur.value.dialog = {
          character: {
            name: '',
            avatar: '',
            alias: '',
            tachies: {},
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
        store.cur.value.background = node.url
        break
      default:
        break
    }
  }

  /**
   * 下一部分
   */
  async function next(): Promise<void> {
    if (!store.ast.value)
      return

    const nodeLen = store.ast.value.children.length
    const curOrder = store.cur.value.order
    if (curOrder >= nodeLen)
      return

    store.cur.value.order++

    const curNode = store.curNode.value
    // 跳过无效节点（虽然应该不会有）
    if (!curNode)
      return next()

    if (options?.debug)
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
        store.cur.value.dialog = curNode
        if (curNode.character.status !== '') {
          // 需要切换立绘
          updateTachie(curNode)
        }
        break
      case 'text':
        store.cur.value.dialog = {
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

  function updateTachie(curNode: AdvAst.Dialog) {
    const character = getCharacter(
      store.gameConfig.characters,
      curNode.character.name,
    )
    if (!character)
      return
    const tachie = character.tachies?.[curNode.character.status]
    if (!tachie)
      return
    if (store.cur.value.tachies.has(character.name))
      store.cur.value.tachies.set(character.name, tachie)
  }

  return {
    store,

    loadAst(ast: AdvAst.Root) {
      store.ast.value = ast
    },

    read,

    play,
    next,
  }
}

export type AdvInstance = ReturnType<typeof createAdv>
