import type { TreeNode, Trees } from '../../client/types'

export type AGUIPanelProps = CommonPanel | TreePanel

export interface Panel {
  type: 'common' | 'tree'
  title: string
}

export interface CommonPanel extends Panel {
  type: 'common'
  properties: PropertyOptions[]
}

export interface TreePanel extends Panel {
  type: 'tree'
  data: Trees
  onNodeActivate?: (node: TreeNode) => void
  onNodeCollapse?: (nodes: Trees) => void
  onNodeExpand?: (nodes: Trees) => void
  onNodeShow?: (nodes: Trees) => void
  onNodeHide?: (nodes: Trees) => void
  onNodeSelected?: (nodes: Trees) => void
  onNodeUnselected?: (nodes: Trees) => void
}

export interface PropertyOptions {
  object: Record<string, number>
  property: string
  label?: string
  type: string
  min?: number
  max?: number
  step?: number
  onChange?: (val: number) => void
}

export interface BUIProps extends Record<string, any> {
  title?: string
  panels: AGUIPanelProps[]
}
