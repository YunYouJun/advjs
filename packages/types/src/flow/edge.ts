import type { DefaultEdge } from '@vue-flow/core'

/**
 * Edge
 */
export interface AdvFlowEdge extends DefaultEdge {
  id: string
  source: string
  target: string
}
