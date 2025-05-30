import type { AdvAst, AdvChapter, AdvDialoguesNode, AdvNode } from '@advjs/types'
import type { StorageMeta } from 'unstorage'

import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

export interface CurStateType {
  /**
   * 顺序
   */
  order: number
  dialog: AdvAst.Dialog | AdvDialoguesNode
  // enter character name
  tachies: Map<string, { status: string }>
  background: string
}

/**
 * 游戏存档类型格式
 */
export type AdvGameRecord = CurStateType

export interface AdvGameRecordMeta extends StorageMeta {
  /**
   * 创建时间
   */
  createdAt: number
  /**
   * 缩略图
   */
  thumbnail?: string
  /**
   * 备注
   */
  memo?: string
}

export const useAdvStore = defineStore('adv', () => {
  /**
   * 语法树
   */
  const ast = shallowRef<AdvAst.Root>({
    type: 'adv-root',
    functions: {},
    scene: {},
    children: [
      {
        type: 'text',
        value: 'test',
      },
    ],
  })

  const curState = ref<CurStateType>({
    order: 0,
    /**
     * 当前对话
     */
    dialog: {
      // type: 'dialog',
      id: '',
      type: 'dialogues',
      dialogues: [],
      // character: {
      //   type: 'character',
      //   name: '',
      //   status: '',
      // },
      // children: [],
    },
    tachies: new Map(),
    background: '',
  })

  const curNode = computed((): AdvAst.Item | undefined => {
    if (ast.value && ast.value.children.length > 0 && curState.value.order < ast.value.children.length)
      return ast.value.children[curState.value.order]

    return undefined
  })

  const curFlowNode = ref<AdvNode>({
    id: '',
    type: '',
  })

  /**
   * 当前章节
   */
  const curChapter = ref<AdvChapter>()

  return {
    ast,

    /**
     * 当前节点
     */
    curNode,

    /**
     * 当前 Flow 节点
     *
     * 未来重构替换 curNode
     */
    curFlowNode,

    curChapter,

    /**
     * 当前
     */
    cur: curState,

    status: {
      isEnd: computed(() => curState.value.order >= ast.value.children.length - 1),
    },
  }
})

export type AdvStore = ReturnType<typeof useAdvStore>

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAdvStore, import.meta.hot))
