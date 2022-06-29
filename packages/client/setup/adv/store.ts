import type { AdvAst } from '@advjs/types'
import type { StorageMeta } from 'unstorage'
import { computed, ref, shallowRef, watch } from 'vue'

import { acceptHMRUpdate, defineStore } from 'pinia'

export interface CurStateType {
  /**
   * 顺序
   */
  order: number
  dialog: AdvAst.Dialog
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
      type: 'dialog',
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
    tachies: new Map(),
    background: '',
  })

  const curNode = computed(() => {
    if (ast.value && ast.value.children.length > 0)
      return ast.value.children[curState.value.order]
    else
      return null
  })

  // watch order, update dialog
  watch(() => curNode.value, () => {
    if (curNode.value?.type === 'dialog')
      curState.value.dialog = curNode.value
  })

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
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAdvStore, import.meta.hot))
