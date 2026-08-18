import type {
  AgentError,
  AgentEventEnvelope,
  AgentProposal,
  AgentRequest,
  AgentRun,
  AgentRuntime,
  AgentTaskSnapshot,
  AgentUsageSummary,
} from './contracts'
import { normalizeAgentRuntimeError } from './errors'

export interface AgentTaskState {
  taskId: string
  snapshot?: AgentTaskSnapshot
  streamText: string
  proposal?: AgentProposal
  usage?: AgentUsageSummary
  error?: AgentError
  cursor?: string
  connecting: boolean
  recovering: boolean
}

export type AgentTaskStateListener = (state: Readonly<AgentTaskState>) => void

function initialState(taskId: string): AgentTaskState {
  return {
    taskId,
    streamText: '',
    connecting: false,
    recovering: false,
  }
}

export class AgentTaskStore {
  readonly #listeners = new Map<string, Set<AgentTaskStateListener>>()
  readonly #runtime: AgentRuntime
  readonly #states = new Map<string, AgentTaskState>()
  readonly #subscriptions = new Map<string, number>()

  constructor(runtime: AgentRuntime) {
    this.#runtime = runtime
  }

  async start<TInput>(request: AgentRequest<TInput>): Promise<string> {
    const run = await this.#runtime.start(request)
    this.#states.set(run.taskId, initialState(run.taskId))
    this.#attach(run)
    return run.taskId
  }

  async resume(taskId: string, cursor?: string): Promise<void> {
    const run = await this.#runtime.resume(taskId, cursor)
    if (!this.#states.has(taskId))
      this.#states.set(taskId, initialState(taskId))
    this.#attach(run)
  }

  async recover(taskId: string): Promise<AgentTaskSnapshot> {
    const state = this.#state(taskId)
    state.recovering = true
    this.#notify(state)
    try {
      const snapshot = await this.#runtime.getTask(taskId)
      this.#replaceSnapshot(state, snapshot)
      return snapshot
    }
    catch (error) {
      state.error = normalizeAgentRuntimeError(error).detail
      throw error
    }
    finally {
      state.recovering = false
      this.#notify(state)
    }
  }

  async cancel(taskId: string): Promise<void> {
    try {
      await this.#runtime.cancel(taskId)
      await this.recover(taskId)
    }
    catch (error) {
      const state = this.#state(taskId)
      state.error = normalizeAgentRuntimeError(error).detail
      this.#notify(state)
      throw error
    }
  }

  read(taskId: string): Readonly<AgentTaskState> | undefined {
    return this.#states.get(taskId)
  }

  subscribe(taskId: string, listener: AgentTaskStateListener): () => void {
    const listeners = this.#listeners.get(taskId) ?? new Set<AgentTaskStateListener>()
    listeners.add(listener)
    this.#listeners.set(taskId, listeners)
    const state = this.#states.get(taskId)
    if (state)
      listener(state)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0)
        this.#listeners.delete(taskId)
    }
  }

  #attach(run: AgentRun): void {
    const state = this.#state(run.taskId)
    const subscription = (this.#subscriptions.get(run.taskId) ?? 0) + 1
    this.#subscriptions.set(run.taskId, subscription)
    state.connecting = true
    state.error = undefined
    this.#notify(state)
    void this.#consume(run, subscription)
  }

  async #consume(run: AgentRun, subscription: number): Promise<void> {
    const state = this.#state(run.taskId)
    try {
      for await (const envelope of run.events) {
        if (this.#subscriptions.get(run.taskId) !== subscription)
          return
        await this.#apply(state, envelope)
      }
      await run.result
      if (this.#subscriptions.get(run.taskId) === subscription)
        await this.recover(run.taskId)
    }
    catch (error) {
      if (this.#subscriptions.get(run.taskId) === subscription) {
        state.error = normalizeAgentRuntimeError(error).detail
        this.#notify(state)
      }
    }
    finally {
      if (this.#subscriptions.get(run.taskId) === subscription) {
        state.connecting = false
        this.#notify(state)
      }
    }
  }

  async #apply(state: AgentTaskState, envelope: AgentEventEnvelope): Promise<void> {
    state.cursor = envelope.cursor
    const event = envelope.event
    if (event.type === 'state.snapshot') {
      this.#replaceSnapshot(state, event.task)
      return
    }
    if (event.type === 'text.delta') {
      if (event.offset !== state.streamText.length) {
        await this.recover(state.taskId)
        return
      }
      state.streamText += event.delta
    }
    else if (event.type === 'proposal.ready') {
      state.proposal = event.proposal
    }
    else if (event.type === 'usage.settled') {
      state.usage = event.usage
    }
    else if (event.type === 'run.failed') {
      state.error = event.error
    }
    this.#notify(state)
  }

  #replaceSnapshot(state: AgentTaskState, snapshot: AgentTaskSnapshot): void {
    state.snapshot = snapshot
    state.streamText = snapshot.streamText
    state.proposal = snapshot.proposal
    state.usage = snapshot.usage
    state.error = snapshot.error
    this.#notify(state)
  }

  #state(taskId: string): AgentTaskState {
    const state = this.#states.get(taskId) ?? initialState(taskId)
    this.#states.set(taskId, state)
    return state
  }

  #notify(state: AgentTaskState): void {
    for (const listener of this.#listeners.get(state.taskId) ?? [])
      listener(state)
  }
}
