import type {
  AgentError,
  AgentEvent,
  AgentEventEnvelope,
  AgentProposal,
  AgentRequest,
  AgentRun,
  AgentRuntime,
  AgentTaskSnapshot,
  AgentUsageSummary,
} from '../core/contracts'
import { AsyncQueue } from '../core/async-queue'
import { AGENT_PROTOCOL_VERSION } from '../core/contracts'
import { runtimeError } from '../core/errors'
import { createAgentRunSession } from '../core/run-session'

export interface ByokDevExecutionContext {
  signal: AbortSignal
  onTextDelta: (delta: string) => void
}

export interface ByokDevExecutionResult {
  proposal?: AgentProposal
  usage: AgentUsageSummary
}

export interface ByokDevExecutor {
  execute: (
    request: AgentRequest<unknown>,
    context: ByokDevExecutionContext,
  ) => Promise<ByokDevExecutionResult>
}

export interface ByokDevRuntimeOptions {
  enabled: true
  mode: 'development' | 'test'
  executor: ByokDevExecutor
  createTaskId?: () => string
  now?: () => number
}

interface ByokDevTask {
  controller: AbortController
  history: AgentEventEnvelope[]
  sequence: number
  snapshot: AgentTaskSnapshot
  subscribers: Set<AsyncQueue<AgentEventEnvelope>>
}

function failedError(error: unknown): AgentError {
  return {
    code: 'upstream_error',
    message: error instanceof Error ? error.message : 'The local development provider failed.',
    retryable: true,
  }
}

export class ByokDevAgentRuntime implements AgentRuntime {
  readonly #createTaskId: () => string
  readonly #executor: ByokDevExecutor
  readonly #now: () => number
  readonly #tasks = new Map<string, ByokDevTask>()

  constructor(options: ByokDevRuntimeOptions) {
    if (!options.enabled || !['development', 'test'].includes(options.mode))
      throw new TypeError('BYOK runtime is only available through an explicit local development switch')
    this.#executor = options.executor
    this.#createTaskId = options.createTaskId ?? (() => `byok-dev-${crypto.randomUUID()}`)
    this.#now = options.now ?? Date.now
  }

  async start<TInput>(request: AgentRequest<TInput>): Promise<AgentRun> {
    const taskId = this.#createTaskId()
    const now = this.#now()
    const task: ByokDevTask = {
      controller: new AbortController(),
      history: [],
      sequence: 0,
      snapshot: {
        protocolVersion: AGENT_PROTOCOL_VERSION,
        taskId,
        capability: request.capability,
        status: 'queued',
        billingStatus: 'none',
        projectId: request.project.id,
        projectRevision: request.project.revision,
        streamText: '',
        streamRevision: 0,
        reservedMicroPoints: 0,
        points: { reservedMicroPoints: 0, chargedMicroPoints: 0 },
        createdAt: now,
        updatedAt: now,
      },
      subscribers: new Set(),
    }
    this.#tasks.set(taskId, task)
    const events = this.#subscribe(task)
    queueMicrotask(() => void this.#execute(task, request))
    return createAgentRunSession(taskId, events, () => this.getTask(taskId))
  }

  async resume(taskId: string, cursor?: string): Promise<AgentRun> {
    const task = this.#task(taskId)
    return createAgentRunSession(taskId, this.#subscribe(task, cursor), () => this.getTask(taskId))
  }

  async getTask(taskId: string): Promise<AgentTaskSnapshot> {
    return this.#task(taskId).snapshot
  }

  async cancel(taskId: string): Promise<void> {
    const task = this.#task(taskId)
    if (this.#isTerminal(task.snapshot))
      return
    task.controller.abort()
    const error: AgentError = {
      code: 'cancelled',
      message: 'The local development generation was cancelled.',
      retryable: false,
    }
    this.#setSnapshot(task, { status: 'cancelled', error })
    this.#publish(task, { type: 'state.snapshot', task: task.snapshot })
    this.#publish(task, { type: 'run.failed', taskId, error })
    this.#close(task)
  }

  async #execute<TInput>(task: ByokDevTask, request: AgentRequest<TInput>): Promise<void> {
    if (this.#isTerminal(task.snapshot))
      return
    this.#setSnapshot(task, { status: 'running' })
    this.#publish(task, { type: 'run.started', taskId: task.snapshot.taskId })
    this.#publish(task, { type: 'state.snapshot', task: task.snapshot })
    try {
      const result = await this.#executor.execute(request, {
        signal: task.controller.signal,
        onTextDelta: (delta) => {
          if (!delta || this.#isTerminal(task.snapshot))
            return
          const offset = task.snapshot.streamText.length
          this.#setSnapshot(task, {
            streamText: `${task.snapshot.streamText}${delta}`,
            streamRevision: task.snapshot.streamRevision + 1,
          })
          this.#publish(task, { type: 'text.delta', taskId: task.snapshot.taskId, delta, offset })
        },
      })
      if (this.#isTerminal(task.snapshot))
        return
      const localUsage = { ...result.usage, chargedMicroPoints: 0 }
      this.#setSnapshot(task, {
        status: 'completed',
        ...(result.proposal ? { proposal: result.proposal } : {}),
        usage: localUsage,
        points: { reservedMicroPoints: 0, chargedMicroPoints: 0 },
      })
      this.#publish(task, { type: 'state.snapshot', task: task.snapshot })
      if (result.proposal)
        this.#publish(task, { type: 'proposal.ready', taskId: task.snapshot.taskId, proposal: result.proposal })
      this.#publish(task, { type: 'usage.settled', taskId: task.snapshot.taskId, usage: localUsage })
      this.#publish(task, { type: 'run.finished', taskId: task.snapshot.taskId })
      this.#close(task)
    }
    catch (error) {
      if (task.controller.signal.aborted || this.#isTerminal(task.snapshot))
        return
      const detail = failedError(error)
      this.#setSnapshot(task, { status: 'failed', error: detail })
      this.#publish(task, { type: 'state.snapshot', task: task.snapshot })
      this.#publish(task, { type: 'run.failed', taskId: task.snapshot.taskId, error: detail })
      this.#close(task)
    }
  }

  #task(taskId: string): ByokDevTask {
    const task = this.#tasks.get(taskId)
    if (!task)
      throw runtimeError('invalid_request', 'The local development task was not found.')
    return task
  }

  #setSnapshot(task: ByokDevTask, patch: Partial<AgentTaskSnapshot>): void {
    task.snapshot = { ...task.snapshot, ...patch, updatedAt: this.#now() }
  }

  #publish(task: ByokDevTask, event: AgentEvent): void {
    task.sequence += 1
    const cursor = `byok-dev:${task.sequence}`
    const envelope: AgentEventEnvelope = {
      protocolVersion: AGENT_PROTOCOL_VERSION,
      id: `${task.snapshot.taskId}:${cursor}`,
      cursor,
      event,
    }
    task.history.push(envelope)
    for (const subscriber of task.subscribers)
      subscriber.push(envelope)
  }

  #subscribe(task: ByokDevTask, cursor?: string): AsyncQueue<AgentEventEnvelope> {
    const queue = new AsyncQueue<AgentEventEnvelope>()
    const startIndex = cursor === undefined
      ? 0
      : task.history.findIndex(item => item.cursor === cursor) + 1
    if (cursor !== undefined && startIndex === 0)
      throw runtimeError('conflict', 'The local development event cursor is invalid.')
    for (const event of task.history.slice(startIndex))
      queue.push(event)
    if (this.#isTerminal(task.snapshot))
      queue.close()
    else
      task.subscribers.add(queue)
    return queue
  }

  #close(task: ByokDevTask): void {
    for (const subscriber of task.subscribers)
      subscriber.close()
    task.subscribers.clear()
  }

  #isTerminal(snapshot: AgentTaskSnapshot): boolean {
    return ['completed', 'cancelled', 'blocked', 'failed', 'reconcile_required'].includes(snapshot.status)
  }
}
