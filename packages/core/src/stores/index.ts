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
  const ast = ref<AdvRoot>()

  const curState = reactive<CurStateType>({

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

  const curNode = computed(() => ast.value && ast.value.children[curState.order])

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
