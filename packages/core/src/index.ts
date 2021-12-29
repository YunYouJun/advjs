import { parse } from '@advjs/parser'
import type { AdvRoot } from '@advjs/types'
import consola from 'consola'
import { createAdvStore } from './stores'

export * from './stores'

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
    const curOrder = store.cur.order.value
    if (curOrder >= nodeLen) return

    store.cur.order.value++

    if (options?.debug) consola.info(store.cur.node.value)

    const skippedTypes = ['scene']
    if (skippedTypes.includes(store.cur.node.value?.type || '')) {
      next()
      return
    }

    const result = nextParagraph()
    return result
  }

  /**
   * 下一段落，具体分句交给 DialogBox 组件
   * @returns
   */
  function nextParagraph() {
    // if (store.cur.order.value < store.ast.value.children.length - 1) {
    // store.cur.order.value++

    const item = store.cur.node.value
    if (!item) return

    // if (item.type === 'narration' && item.children.length && item.children[0].type === 'paragraph') {
    //   store.cur.dialog.value = item.children[0]
    //   return true
    // }

    const childType = item.type
    if (childType === 'dialog') {
      store.cur.dialog.value = item
      return true
    }
    else if (childType === 'text') {
      store.cur.dialog.value = {
        character: {
          name: '',
          status: '',
        },
        children: [item],
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
