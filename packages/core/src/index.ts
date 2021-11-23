import { parse } from '@advjs/parser'
import type { AdvRoot, Dialog } from '@advjs/types'
import { createAdvStore } from './stores'
export * from './stores'

export interface AdvOptions {
  /**
   * 文本
   */
  text: string
}

/**
 * 创建 ADV 实例
 * @param options
 * @returns
 */
export function createAdv(options?: Partial<AdvOptions>) {
  if (options)
    options = { ...options }

  const advAst = ref<AdvRoot>()
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
  function read(text: string) {
    advAst.value = parse(text)

    if (advAst.value.children.length) {
      const firstChild = advAst.value.children[0]
      if (firstChild.type === 'paragraph') store.cur.dialog.value = firstChild.children[0] as Dialog
    }
  }

  /**
   * 下一部分
   */
  function next() {
    const result = nextParagraph()
    return result
  }

  /**
   * 下一段落，具体分句交给 DialogBox 组件
   * @returns
   */
  function nextParagraph() {
    if (!advAst.value) return false

    if (store.cur.order.value < advAst.value.children.length - 1) {
      store.cur.order.value++

      const item = advAst.value.children[store.cur.order.value]
      if (item.type === 'narration' && item.children.length && item.children[0].type === 'paragraph') {
        store.cur.dialog.value = item.children[0]
        return true
      }

      if (item.type === 'paragraph' && item.children[0].type === 'dialog') {
        store.cur.dialog.value = item.children[0]
        return true
      }

      nextParagraph()
    }
    else { return false }
  }

  return {
    /**
     * 语法树
     */
    ast: advAst,
    store,
    read,

    play,
    next,
  }
}

export type AdvInstance = ReturnType<typeof createAdv>
