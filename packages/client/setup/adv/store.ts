import type { AdvAst, GameConfig, Tachie } from '@advjs/types'
import type { StorageMeta } from 'unstorage'
import { defaultGameConfig } from 'advjs'
import { computed, ref, shallowRef } from 'vue'

import { acceptHMRUpdate, defineStore } from 'pinia'

export interface CurStateType {
  /**
   * 顺序
   */
  order: number
  dialog: {
    character: AdvAst.Character
    children: AdvAst.Text[]
  }
  // key为角色名
  tachies: Map<string, Tachie>
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

  const gameConfig: GameConfig = defaultGameConfig

  return {
    ast,

    gameConfig,

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
