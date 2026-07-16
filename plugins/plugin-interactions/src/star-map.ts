import type { JsonObject, JsonValue } from '@advjs/types'
import { defineAdvPlugin } from '@advjs/core'

export interface StarMapOptions {
  tolerance?: number
  matchedVariable?: string
  scoreVariable?: string
}

function record(value: JsonValue): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

export function starMap(options: StarMapOptions = {}) {
  const tolerance = options.tolerance ?? 0.8
  const matchedVariable = options.matchedVariable ?? 'starMatched'
  const scoreVariable = options.scoreVariable ?? 'starMatchScore'

  return defineAdvPlugin({
    name: 'star-map',
    version: '1.0.0',
    nodes: {
      compare({ activity, node }) {
        activity('compare', {
          tolerance,
          ...node.data,
        })
      },
    },
    activities: {
      compare({ state }, result) {
        const data = record(result)
        state.variables[matchedVariable] = data?.matched === true
        state.variables[scoreVariable] = typeof data?.score === 'number' ? data.score : 0
      },
    },
  })
}
