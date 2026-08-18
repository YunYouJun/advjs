import type {
  AgentRequest,
  AgentRun,
  AgentRuntime,
  AgentTaskSnapshot,
  CreateTaskRequest,
} from '../core/contracts'
import type { ManagedAgentTransportOptions } from './transport'
import {
  AGENT_PROTOCOL_VERSION,
  parseAgentTaskSnapshot,
  parseCreateTaskResponse,
} from '../core/contracts'
import { createAgentRunSession } from '../core/run-session'
import { ManagedAgentTransport } from './transport'
import {
  createV2TaskRequest,
  projectV2CreateTaskResponse,
  projectV2EventEnvelope,
  projectV2TaskSnapshot,
} from './v2'

export type ManagedAgentProtocol = 'v1' | 'v2'

export interface ManagedAgentRuntimeOptions extends ManagedAgentTransportOptions {
  protocol?: ManagedAgentProtocol
  applicationId?: string
}

export class ManagedAgentRuntime implements AgentRuntime {
  readonly #transport: ManagedAgentTransport
  readonly #protocol: ManagedAgentProtocol
  readonly #applicationId?: string

  constructor(options: ManagedAgentRuntimeOptions) {
    this.#transport = new ManagedAgentTransport(options)
    this.#protocol = options.protocol ?? 'v1'
    if (this.#protocol === 'v2') {
      if (!options.applicationId || !/^[\w.:-]{1,128}$/.test(options.applicationId))
        throw new TypeError('Managed protocol v2 requires an exact application id')
      this.#applicationId = options.applicationId
    }
  }

  async start<TInput>(request: AgentRequest<TInput>): Promise<AgentRun> {
    const body: CreateTaskRequest<TInput> = {
      capability: request.capability,
      protocolVersion: AGENT_PROTOCOL_VERSION,
      input: request.input,
      locale: request.locale,
      project: request.project,
    }
    const requestOptions = {
      body: this.#protocol === 'v2' ? createV2TaskRequest(request) : body,
      headers: { 'idempotency-key': request.clientRequestId },
      method: 'POST' as const,
    }
    const created = this.#protocol === 'v2'
      ? await this.#transport.requestRaw(
          this.#tasksPath(),
          value => projectV2CreateTaskResponse(value, this.#applicationId!),
          requestOptions,
        )
      : await this.#transport.request('/v1/tasks', parseCreateTaskResponse, requestOptions)
    return createAgentRunSession(
      created.taskId,
      this.#events(created.eventsUrl),
      () => this.getTask(created.taskId),
    )
  }

  async resume(taskId: string, cursor?: string): Promise<AgentRun> {
    return createAgentRunSession(
      taskId,
      this.#events(`${this.#taskPath(taskId)}/events`, cursor),
      () => this.getTask(taskId),
    )
  }

  getTask(taskId: string): Promise<AgentTaskSnapshot> {
    const path = this.#taskPath(taskId)
    return this.#protocol === 'v2'
      ? this.#transport.requestRaw(path, value => projectV2TaskSnapshot(value, this.#applicationId!))
      : this.#transport.request(path, parseAgentTaskSnapshot)
  }

  async cancel(taskId: string): Promise<void> {
    const path = `${this.#taskPath(taskId)}/cancel`
    const options = {
      headers: { 'idempotency-key': `cancel:${taskId}` },
      method: 'POST' as const,
    }
    if (this.#protocol === 'v2')
      await this.#transport.requestRaw(path, value => projectV2TaskSnapshot(value, this.#applicationId!), options)
    else
      await this.#transport.request(path, parseAgentTaskSnapshot, options)
  }

  #tasksPath(): string {
    return this.#protocol === 'v2'
      ? `/ai/v2/apps/${encodeURIComponent(this.#applicationId!)}/tasks`
      : '/v1/tasks'
  }

  #taskPath(taskId: string): string {
    return `${this.#tasksPath()}/${encodeURIComponent(taskId)}`
  }

  #events(path: string, cursor?: string) {
    return this.#protocol === 'v2'
      ? this.#transport.events(path, cursor, value => projectV2EventEnvelope(value, this.#applicationId!))
      : this.#transport.events(path, cursor)
  }
}
