import type { RuntimeNode, RuntimeSnapshot } from '@advjs/types'
import { computed } from 'vue'

export interface RuntimeInspectorModel {
  address: { chapterId: string, nodeId: string }
  status: RuntimeSnapshot['state']['status']
  current?: RuntimeNode
  variables: RuntimeSnapshot['state']['variables']
  stage: RuntimeSnapshot['state']['stage']
  choices: RuntimeSnapshot['state']['choices']
  visited: RuntimeSnapshot['state']['visited']
  checkpointCount: number
  pendingActivity?: unknown
}

export function projectRuntimeInspector(
  snapshot: RuntimeSnapshot,
  current?: RuntimeNode,
): RuntimeInspectorModel {
  const stateWithActivity = snapshot.state as RuntimeSnapshot['state'] & {
    pendingActivity?: unknown
  }
  return {
    address: structuredClone(snapshot.state.cursor),
    status: snapshot.state.status,
    current: current ? structuredClone(current) : undefined,
    variables: structuredClone(snapshot.state.variables),
    stage: structuredClone(snapshot.state.stage),
    choices: structuredClone(snapshot.state.choices),
    visited: structuredClone(snapshot.state.visited),
    checkpointCount: snapshot.checkpoints.length,
    pendingActivity: structuredClone(stateWithActivity.pendingActivity),
  }
}

export function useRuntimeInspector(
  getSnapshot: () => RuntimeSnapshot,
  getCurrent: () => RuntimeNode | undefined,
) {
  return computed(() => projectRuntimeInspector(getSnapshot(), getCurrent()))
}
