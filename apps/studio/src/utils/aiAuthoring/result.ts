/**
 * Phase 16 polish — 共享错误类型 + 分类器。
 *
 * 所有 aiAuthoring/* generator 把 catch 的异常喂给 classifyError，
 * 输出统一的 AiAuthoringError 结构供 UI 渲染。
 */

import { AiApiError } from '../aiClient'

export type AiAuthoringErrorType
  = | 'auth'
    | 'rate_limit'
    | 'network'
    | 'timeout'
    | 'not_found'
    | 'aborted'
    | 'not_configured'
    | 'unknown'

export interface AiAuthoringError {
  type: AiAuthoringErrorType
  message: string
  retryable: boolean
}

export type AiAuthoringResult<T>
  = | { data: T, error?: undefined }
    | { data?: undefined, error: AiAuthoringError }

/**
 * Map any thrown value to a structured error.
 *
 * - AbortError → 'aborted' (not retryable; usually user-initiated)
 * - AiApiError → preserve its `type`
 * - everything else → 'unknown' (retryable, since transient noise is more
 *   common than a true bug at this layer)
 */
export function classifyError(err: unknown): AiAuthoringError {
  if (err instanceof AiApiError) {
    const retryable = err.type === 'rate_limit' || err.type === 'network' || err.type === 'timeout' || err.type === 'api_error'
    return {
      type: err.type === 'api_error' ? 'unknown' : err.type,
      message: err.message,
      retryable,
    }
  }
  const name = (err as { name?: string })?.name
  if (name === 'AbortError') {
    return {
      type: 'aborted',
      message: 'aborted',
      retryable: false,
    }
  }
  const message = (err as { message?: string })?.message || String(err)
  return {
    type: 'unknown',
    message,
    retryable: true,
  }
}

/** Error for the common "AI provider is not configured" path. */
export function notConfiguredError(): AiAuthoringError {
  return {
    type: 'not_configured',
    message: 'AI provider not configured',
    retryable: false,
  }
}

export function ok<T>(data: T): AiAuthoringResult<T> {
  return { data }
}

export function fail<T = never>(error: AiAuthoringError): AiAuthoringResult<T> {
  return { error }
}
