import type { NodeTypesObject } from '@vue-flow/core'
import { defaultNodeTypes } from '@vue-flow/core'
// import { markRaw } from 'vue'

export const nodeTypes: NodeTypesObject = {
  ...defaultNodeTypes,
  // ...convertNodesToNodeTypes(flatNodes),
  // default: markRaw(FlowWrapperNode) as any,
}
