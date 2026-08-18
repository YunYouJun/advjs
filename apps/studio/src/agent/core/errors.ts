import type { AgentError, AgentErrorCode } from './contracts'

export class AgentRuntimeError extends Error {
  readonly detail: AgentError
  readonly status?: number

  constructor(detail: AgentError, options: { cause?: unknown, status?: number } = {}) {
    super(detail.message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'AgentRuntimeError'
    this.detail = detail
    this.status = options.status
  }
}

export function runtimeError(
  code: AgentErrorCode,
  message: string,
  options: { cause?: unknown, requestId?: string, retryable?: boolean, status?: number } = {},
): AgentRuntimeError {
  return new AgentRuntimeError({
    code,
    message,
    retryable: options.retryable ?? false,
    ...(options.requestId ? { requestId: options.requestId } : {}),
  }, options)
}

export function normalizeAgentRuntimeError(error: unknown): AgentRuntimeError {
  if (error instanceof AgentRuntimeError)
    return error
  return runtimeError(
    'internal_error',
    error instanceof Error ? error.message : 'The agent runtime failed.',
    { cause: error, retryable: false },
  )
}
