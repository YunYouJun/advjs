import type { ComputedRef, InjectionKey } from 'vue'
import type { TreeNode } from './types'

export const treeContextKey: InjectionKey<{
  tabStop: ComputedRef<TreeNode | undefined>
  focus: (node: TreeNode) => void
}> = Symbol('agui-tree')
