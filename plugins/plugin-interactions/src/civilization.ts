import type { JsonObject, JsonValue } from '@advjs/types'
import { defineAdvPlugin } from '@advjs/core'

export interface CivilizationOptions {
  variable?: string
  defaultLevel?: number
}

function record(value: JsonValue): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? structuredClone(value)
    : {}
}

export function civilization(options: CivilizationOptions = {}) {
  const variable = options.variable ?? 'civilization'
  const defaultLevel = options.defaultLevel ?? 1

  return defineAdvPlugin({
    name: 'civilization',
    version: '1.0.0',
    nodes: {
      initialize({ activity, node }) {
        activity('initialize', {
          defaultLevel,
          ...node.data,
        })
      },
    },
    activities: {
      initialize({ state }, result) {
        const civilization = record(result)
        if (typeof civilization.level !== 'number')
          civilization.level = defaultLevel
        state.variables[variable] = civilization
        state.variables.civilizationLevel = civilization.level
      },
    },
  })
}
