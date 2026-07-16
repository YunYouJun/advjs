import type {
  AdvRuntime,
  AdvRuntimeOptions,
} from '@advjs/core'
import type {
  JsonObject,
  JsonValue,
  RuntimeAddress,
  RuntimeChoice,
  RuntimeEffect,
  RuntimeNode,
  RuntimeSnapshot,
  RuntimeStageState,
  RuntimeState,
} from '@advjs/types'
import { createAdvRuntime } from '@advjs/core'

export interface RuntimeCliTrace {
  command: 'start' | 'next' | 'choose' | 'go' | 'back' | 'restore' | 'activity'
  address: RuntimeAddress
  status: RuntimeState['status']
  effects: RuntimeEffect[]
  variables: JsonObject
}

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
  private readonly trace?: (trace: RuntimeCliTrace) => void

  constructor(options: RuntimeCliPlayerOptions) {
    this.runtime = createAdvRuntime(options)
    this.trace = options.trace
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
    const update = await this.runtime.start()
    this.emitTrace('start', update.effects)
    return this.current()
  }

  async next(): Promise<RuntimeCliOutput> {
    const update = await this.runtime.next()
    this.emitTrace('next', update.effects)
    return this.current()
  }

  async choose(choice: number | string): Promise<RuntimeCliOutput> {
    const current = this.runtime.current
    const options = current?.kind === 'choices' ? readChoices(current) : []
    const choiceId = typeof choice === 'number' ? options[choice - 1]?.id : choice
    if (!choiceId)
      throw new Error(`ADV_RUNTIME_UNKNOWN_CHOICE: ${String(choice)}`)
    const update = await this.runtime.choose(choiceId)
    this.emitTrace('choose', update.effects)
    return this.current()
  }

  async go(target: RuntimeAddress | string): Promise<RuntimeCliOutput> {
    const update = await this.runtime.go(target)
    this.emitTrace('go', update.effects)
    return this.current()
  }

  async completeActivity(result: JsonValue): Promise<RuntimeCliOutput> {
    const update = await this.runtime.completeActivity(result)
    this.emitTrace('activity', update.effects)
    return this.current()
  }

  back(steps = 1): RuntimeCliBackResult {
    let poppedSteps = 0
    for (let index = 0; index < Math.max(0, steps); index++) {
      try {
        const update = this.runtime.back()
        poppedSteps++
        this.emitTrace('back', update.effects)
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
    const update = this.runtime.restore(snapshot)
    this.emitTrace('restore', update.effects)
    return this.current()
  }

  private emitTrace(command: RuntimeCliTrace['command'], effects: RuntimeEffect[]): void {
    if (!this.trace)
      return
    const state = this.runtime.state
    this.trace({
      command,
      address: structuredClone(state.cursor),
      status: state.status,
      effects: structuredClone(effects),
      variables: structuredClone(state.variables),
    })
  }
}
