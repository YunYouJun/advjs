import type { FlowExportObject } from '@vue-flow/core'

export interface AdvFlowItem {
  id?: string
  name: string

  zhName?: string
  desc?: string
  version?: string
  tags?: string[]
  data: FlowExportObject

  createdAt: number | string
  updatedAt: number | string
}
