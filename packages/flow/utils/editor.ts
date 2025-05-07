import mitt from 'mitt'

import { GLOBAL_FLOW_ID } from '../constants'

export class AdvFlowEditor {
  id = GLOBAL_FLOW_ID
  emitter = mitt()

  constructor(id = GLOBAL_FLOW_ID) {
    this.id = id
  }
}

export const ADV_FLOW_EDITOR_MAP = new Map<string | symbol, AdvFlowEditor>()

/**
 * create a new flow editor instance
 */
export function createFlowEditor(id = GLOBAL_FLOW_ID) {
  if (ADV_FLOW_EDITOR_MAP.has(id)) {
    return ADV_FLOW_EDITOR_MAP.get(id)
  }

  const flowEditor = new AdvFlowEditor(id)
  ADV_FLOW_EDITOR_MAP.set(id, flowEditor)
  return flowEditor
}
