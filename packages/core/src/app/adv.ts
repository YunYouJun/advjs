import { parse } from '@advjs/parser'
import type { AdvRoot } from '@advjs/types'
import consola from 'consola'
import { createAdvStore } from '../stores'

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
  function play() {

  }

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
  function next() {
    if (!store.ast.value) return false

    const nodeLen = store.ast.value.children.length
    const curOrder = store.cur.value.order
    if (curOrder >= nodeLen) return

    store.cur.value.order++

    const curNode = store.curNode.value
    if (options?.debug) consola.info(curNode)

    const skippedTypes = ['scene']
    if (skippedTypes.includes(curNode?.type || '')) {
      next()
      return
    }

    if (curNode?.type === 'camera') {
      store.cur.value.dialog = {
        character: {
          type: 'character',
          name: '',
          status: '',
        },
        children: [{
          type: 'text',
          value: '（镜头动画）',
        }],
      }
    }

    const result = nextParagraph()
    return result
  }

  /**
   * 下一段落，具体分句交给 DialogBox 组件
   * @returns
   */
  function nextParagraph() {
    const curNode = store.curNode.value
    if (!curNode) return

    // if (item.type === 'narration' && item.children.length && item.children[0].type === 'paragraph') {
    //   store.cur.value.dialog.value = item.children[0]
    //   return true
    // }

    const childType = curNode.type
    if (childType === 'dialog') {
      store.cur.value.dialog = curNode
      return true
    }
    else if (childType === 'text') {
      store.cur.value.dialog = {
        character: {
          type: 'character',
          name: '',
          status: '',
        },
        children: [curNode],
      }
    }

    // nextParagraph()
    // }
    // else { return false }
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
