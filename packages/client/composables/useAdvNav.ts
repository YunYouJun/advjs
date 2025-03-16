import type { AdvContext } from '../types'
import consola from 'consola'

export function useAdvNav($adv: AdvContext) {
  const { store } = $adv

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
