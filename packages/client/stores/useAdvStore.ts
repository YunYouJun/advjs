import type {
  RuntimeNode,
  RuntimeProgram,
  RuntimeSnapshot,
  RuntimeState,
} from '@advjs/types'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

export type AdvGameRecord = RuntimeSnapshot

export interface AdvGameRecordMeta {
  createdAt: number
  thumbnail?: string
  memo?: string
}

function createEmptyRuntimeState(): RuntimeState {
  return {
    status: 'idle',
    cursor: { chapterId: '', nodeId: '' },
    variables: {},
    stage: { background: '', bgm: '', cg: '', tachies: {} },
    choices: [],
    visited: [],
  }
}

export const useAdvStore = defineStore('@advjs/client/adv', () => {
  const state = shallowRef<RuntimeState>(createEmptyRuntimeState())
  const current = shallowRef<RuntimeNode>()
  const program = shallowRef<RuntimeProgram>()

  const status = computed(() => ({
    isEnd: state.value.status === 'ended',
  }))

  function $syncRuntime(
    nextState: Readonly<RuntimeState>,
    nextCurrent: RuntimeNode | undefined,
    nextProgram: RuntimeProgram,
  ): void {
    state.value = structuredClone(nextState)
    current.value = nextCurrent ? structuredClone(nextCurrent) : undefined
    program.value = structuredClone(nextProgram)
  }

  return {
    state,
    current,
    program,
    status,
    $syncRuntime,
  }
})

export type AdvStore = ReturnType<typeof useAdvStore>

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAdvStore, import.meta.hot))
