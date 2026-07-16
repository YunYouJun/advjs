import type { AdvRuntimePlugin } from '@advjs/core'
import type { JsonValue, RuntimePendingActivity } from '@advjs/types'
import type { Component } from 'vue'

export interface AdvActivityRendererProps {
  activity: RuntimePendingActivity
}

export interface AdvActivityRendererEmits {
  complete: [result: JsonValue]
  back: []
}

export interface AdvClientRuntimePlugin extends AdvRuntimePlugin {
  activityRenderers?: Record<string, Component>
}

export interface ActivityRendererRegistry {
  resolve: (type: string) => Component | undefined
  list: () => string[]
}
