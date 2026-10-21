/**
 * Headless ADV.JS engine for the native Studio.
 *
 * Bundled into one classic script that JavaScriptCore evaluates; the native
 * host only ever calls `AdvEngine.call(operation, inputJson)`. Operations are
 * thin adapters over the same shared modules Web Studio, the desktop Editor
 * and the CLI use, so results are identical across hosts.
 */
import type { EngineError, EngineResponse } from './protocol'
import { operations } from './operations'
import { ENGINE_API_VERSION, EngineFailure } from './protocol'

export type { EngineContentType, EngineDiagnostic, EngineError, EngineErrorCode, EngineResponse } from './protocol'
export { ENGINE_API_VERSION } from './protocol'

function failure(error: unknown): EngineResponse {
  const engineError: EngineError = error instanceof EngineFailure
    ? { code: error.code, message: error.message, ...(error.field ? { field: error.field } : {}) }
    : { code: 'ENGINE_OPERATION_FAILED', message: error instanceof Error ? error.message : String(error) }
  return { ok: false, apiVersion: ENGINE_API_VERSION, error: engineError }
}

/** The only entry point a native host calls. Never rejects. */
export async function call(operation: string, inputJson: string): Promise<string> {
  let response: EngineResponse
  try {
    const handler = Object.hasOwn(operations, operation) ? operations[operation] : undefined
    if (!handler)
      throw new EngineFailure('ENGINE_UNKNOWN_OPERATION', `Unknown operation: ${operation}`)
    let input: unknown
    try {
      input = JSON.parse(inputJson)
    }
    catch {
      // Parser messages differ between V8 and JavaScriptCore.
      throw new EngineFailure('ENGINE_INVALID_JSON', `${operation} input is not valid JSON`)
    }
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new EngineFailure('ENGINE_INVALID_INPUT', `${operation} expects a JSON object`)
    const result = await handler(input as Record<string, unknown>)
    response = { ok: true, apiVersion: ENGINE_API_VERSION, result: result ?? null }
  }
  catch (error) {
    response = failure(error)
  }
  return JSON.stringify(response)
}
