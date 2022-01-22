import type { AdvRoot, Character, Text } from '@advjs/types'
import type { StorageMeta } from 'unstorage'

export interface CurStateType {
  /**
     * 顺序
     */
  order: number
  dialog: {
    character: Character
    children: Text[]
  }
}

/**
 * 游戏存档类型格式
 */
export type AdvGameRecord = CurStateType

export interface AdvGameRecordMeta extends StorageMeta {
  createdAt: number
  /**
   * 缩略图
   */
  thumbnail?: string
}

export const createAdvStore = () => {
  /**
   * 语法树
   */
  const ast = ref<AdvRoot>({
    type: 'adv-root',
    children: [{
      type: 'text',
      value: 'test',
    }],
  })

  const curState = ref<CurStateType>({
    order: 0,
    /**
     * 当前对话
     */
    dialog: {
      character: {
        type: 'character',
        name: '',
        status: '',
      },
      children: [{
        type: 'text',
        value: '',
      }],
    },
  })

  const curNode = computed(() => {
    if (ast.value && ast.value.children.length > 0)
      return ast.value.children[curState.value.order]
    else
      return null
  })
  // watch(() => curState.order, () => {
  //   curNode =
  // })

  return {
    ast,

    /**
     * 当前节点
     */
    curNode,

    /**
     * 当前
     */
    cur: curState,
  }
}
