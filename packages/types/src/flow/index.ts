import type { AdvFlowEdge } from './edge'
import type { AdvFlowNode } from './node'

export * from './edge'
export * from './node'

/**
 * import type { FlowExportObject } from '@vue-flow/core'
 */
export interface AdvFlow {
  nodes: AdvFlowNode[]
  edges: AdvFlowEdge[]
}
