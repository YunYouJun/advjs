import type { RuntimeNode, RuntimeSnapshot, RuntimeTraceEntry } from '@advjs/types'
import { projectRuntimeInspector } from '@advjs/client/runtime'
import { computed } from 'vue'

export { projectRuntimeInspector }
export type { RuntimeInspectorModel } from '@advjs/client/runtime'

export function useRuntimeInspector(
  getSnapshot: () => RuntimeSnapshot,
  getCurrent: () => RuntimeNode | undefined,
  getTrace: () => RuntimeTraceEntry[] = () => [],
) {
  return computed(() => projectRuntimeInspector(getSnapshot(), getCurrent(), getTrace()))
}
