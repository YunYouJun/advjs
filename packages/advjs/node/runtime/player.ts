import type {
  AdvRuntime,
  AdvRuntimeOptions,
} from '@advjs/core'
import type {
  JsonValue,
  RuntimeAddress,
  RuntimeChoice,
  RuntimeNode,
  RuntimeSnapshot,
  RuntimeStageState,
  RuntimeState,
  RuntimeTraceEntry,
} from '@advjs/types'
import { createAdvRuntime } from '@advjs/core'

/** @deprecated Use RuntimeTraceEntry from @advjs/types. */
export type RuntimeCliTrace = RuntimeTraceEntry

export interface RuntimeCliOutput {
  type: string
  address: RuntimeAddress
  stage: RuntimeStageState
  text?: string
  character?: string
  status?: string
  place?: string
  time?: string
  options?: Array<{
    index: number
    id: string
    label: string
    target?: RuntimeAddress
  }>
}

export interface RuntimeCliPlayerOptions extends AdvRuntimeOptions {
  trace?: (trace: RuntimeCliTrace) => void
}

export interface RuntimeCliBackResult {
  poppedSteps: number
  current: RuntimeCliOutput
}

function dataString(node: RuntimeNode, key: string): string {
  const value = node.data?.[key]
  return typeof value === 'string' ? value : ''
}

function readChoices(node: RuntimeNode): RuntimeChoice[] {
  const options = node.data?.options
  return Array.isArray(options) ? options as unknown as RuntimeChoice[] : []
}

export function formatRuntimeCliOutput(
  node: RuntimeNode | undefined,
  state: Readonly<RuntimeState>,
): RuntimeCliOutput {
  const base = {
    address: structuredClone(state.cursor),
    stage: structuredClone(state.stage),
  }
  if (!node || state.status === 'ended')
    return { ...base, type: 'end', text: '— END —' }

  if (state.status === 'waiting-activity' && state.pendingActivity) {
    return {
      ...base,
      type: 'activity',
      text: `${state.pendingActivity.type} ${JSON.stringify(state.pendingActivity.input)}`,
    }
  }

  if (node.kind === 'dialog') {
    return {
      ...base,
      type: 'dialog',
      character: dataString(node, 'character'),
      status: dataString(node, 'status'),
      text: dataString(node, 'text'),
    }
  }
  if (node.kind === 'choices') {
    return {
      ...base,
      type: 'choices',
      options: readChoices(node).map((choice, index) => ({
        index: index + 1,
        id: choice.id,
        label: choice.label,
        target: choice.target ? structuredClone(choice.target) : undefined,
      })),
    }
  }
  if (node.kind === 'scene') {
    const place = dataString(node, 'place')
    const time = dataString(node, 'time')
    return {
      ...base,
      type: 'scene',
      place,
      time,
      text: [place, time, dataString(node, 'inOrOut')].filter(Boolean).join('，'),
    }
  }

  return {
    ...base,
    type: node.kind,
    text: dataString(node, 'text'),
  }
}

export class RuntimeCliPlayer {
  readonly runtime: AdvRuntime

  constructor(options: RuntimeCliPlayerOptions) {
    const { trace, ...runtimeOptions } = options
    this.runtime = createAdvRuntime(runtimeOptions)
    if (trace)
      this.runtime.subscribeTrace(trace)
  }

  current(): RuntimeCliOutput {
    return formatRuntimeCliOutput(this.runtime.current, this.runtime.state)
  }

  status(): Readonly<RuntimeState> {
    return this.runtime.state
  }

  snapshot(): RuntimeSnapshot {
    return this.runtime.snapshot()
  }

  async start(): Promise<RuntimeCliOutput> {
    await this.runtime.start()
    return this.current()
  }

  async next(): Promise<RuntimeCliOutput> {
    await this.runtime.next()
    return this.current()
  }

  async choose(choice: number | string): Promise<RuntimeCliOutput> {
    const current = this.runtime.current
    const options = current?.kind === 'choices' ? readChoices(current) : []
    const choiceId = typeof choice === 'number' ? options[choice - 1]?.id : choice
    if (!choiceId)
      throw new Error(`ADV_RUNTIME_UNKNOWN_CHOICE: ${String(choice)}`)
    await this.runtime.choose(choiceId)
    return this.current()
  }

  async go(target: RuntimeAddress | string): Promise<RuntimeCliOutput> {
    await this.runtime.go(target)
    return this.current()
  }

  async completeActivity(result: JsonValue): Promise<RuntimeCliOutput> {
    await this.runtime.completeActivity(result)
    return this.current()
  }

  back(steps = 1): RuntimeCliBackResult {
    let poppedSteps = 0
    for (let index = 0; index < Math.max(0, steps); index++) {
      try {
        this.runtime.back()
        poppedSteps++
      }
      catch (error) {
        if (error instanceof Error && error.message.includes('ADV_RUNTIME_NO_CHECKPOINT'))
          break
        throw error
      }
    }
    return { poppedSteps, current: this.current() }
  }

  restore(snapshot: RuntimeSnapshot): RuntimeCliOutput {
    this.runtime.restore(snapshot)
    return this.current()
  }
}
