/**
 * Wire contract between native hosts and the ADV.JS Studio engine.
 *
 * Every operation takes one JSON object and resolves to one JSON envelope.
 * Bump {@link ENGINE_API_VERSION} for any breaking change to an operation's
 * input or result; hosts refuse engines with an unexpected major version.
 */

export const ENGINE_API_VERSION = 1

/** Stable error codes. Hosts branch and localize on these, never on `message`. */
export type EngineErrorCode
  = | 'ENGINE_UNKNOWN_OPERATION'
    | 'ENGINE_INVALID_JSON'
    | 'ENGINE_INVALID_INPUT'
    | 'ENGINE_CONTENT_INVALID'
    | 'ENGINE_PROJECT_INVALID'
    | 'ENGINE_OPERATION_FAILED'

export interface EngineError {
  code: EngineErrorCode
  /** English, for logs. Not shown to authors and not stable across engines. */
  message: string
  /** Input field the error refers to, as a dotted path. */
  field?: string
}

export type EngineResponse<T = unknown>
  = | { ok: true, apiVersion: number, result: T }
    | { ok: false, apiVersion: number, error: EngineError }

/** One problem located in the project, normalized from every engine source. */
export interface EngineDiagnostic {
  code: string
  severity: 'error' | 'warning'
  message: string
  /** Project-relative path. */
  file?: string
  /** 1-based. */
  line?: number
  /** 1-based. */
  column?: number
  suggestion?: string
}

export type EngineContentType = 'audio' | 'chapter' | 'character' | 'location' | 'scene'

export class EngineFailure extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
    public readonly field?: string,
  ) {
    super(message)
  }
}
