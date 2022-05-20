import { parse } from '@advjs/parser'
import type { AdvItem, AdvRoot, Dialog } from '@advjs/types'
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
    store.ast.value = await parse(text)
  }

  /**
   * 下一部分
   */
  function next(): void {
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
      case 'code':{
        let time = 0
        if (Array.isArray(curNode.value)) {
          curNode.value.forEach((value) => {
            time += handleOprate(value)
          })
        }
        else {
          // TODO 执行普通代码
        }
        if (time === 0)
          return next()

        break }
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

      default:
        return next()
    }
  }

  function updateTachie(curNode: Dialog) {
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

  /**
   * 执行预定义命令
   * @param node 执行的指令
   * @returns 需要执行的时间
   */
  function handleOprate(node: AdvItem): number {
    switch (node.type) {
      case 'tachie':{
        const tachies = store.cur.value.tachies
        if (node.enter) {
          node.enter.forEach((item) => {
            const character = getCharacter(store.gameConfig.characters, item.character)
            if (!character)
              return
            const tachie = character.tachies?.[item.status || '默认']
            if (!tachie) {
              consola.error(`找不到${item.character}的立绘${item.status}`)
              return
            }
            tachies.set(character.name, tachie)
          })
        }
        if (node.exit) {
          node.exit.forEach((item) => {
            tachies.delete(item)
          })
        }
        return 0
      }
      case 'camera':
        store.cur.value.dialog = {
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
        return 3
      case 'background':
        store.cur.value.background = node.url
        return 0
      default:
        return 0
    }
  }

  return {
    store,

    loadAst(ast: AdvRoot) {
      store.ast.value = ast
    },

    read,

    play,
    next,
  }
}

export type AdvInstance = ReturnType<typeof createAdv>
