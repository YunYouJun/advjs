import type { JsonObject, RuntimeAddress, RuntimeNode, RuntimeProgram, RuntimeState } from '@advjs/types'

export function runtimeAddressKey(address: RuntimeAddress): string {
  return `${address.chapterId}#${address.nodeId}`
}

export function getRuntimeNode(program: RuntimeProgram, address: RuntimeAddress): RuntimeNode | undefined {
  return program.chapters[address.chapterId]?.nodes[address.nodeId]
}

export function createInitialRuntimeState(program: RuntimeProgram, variables: JsonObject = {}): RuntimeState {
  return {
    status: 'idle',
    cursor: structuredClone(program.entry),
    variables: structuredClone(variables),
    stage: {
      background: '',
      bgm: '',
      tachies: {},
    },
    choices: [],
    visited: [],
  }
}
