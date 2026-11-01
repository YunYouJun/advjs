import type { AuthoringConditionAdapter, AuthoringDiagnostic } from './types'

export function createJsonConditionAdapter(options: Pick<AuthoringConditionAdapter, 'validate' | 'references' | 'examples'> = {}): AuthoringConditionAdapter {
  return { format: value => value === undefined ? '' : JSON.stringify(value, null, 2), parse: text => JSON.parse(text), ...options }
}

/** No eval, runtime dependency or source mutation; the host supplies its language and semantics. */
export function inspectConditionText(adapter: AuthoringConditionAdapter, text: string, optional = false) {
  let value: unknown
  try {
    value = optional && !text.trim() ? undefined : adapter.parse(text)
  }
  catch {
    return { parsed: false as const, value: undefined, diagnostics: [{ code: 'ADV_AUTHORING_CONDITION_PARSE', severity: 'error', message: 'Invalid condition syntax' }] as AuthoringDiagnostic[] }
  }
  try {
    return { parsed: true as const, value, diagnostics: [...adapter.validate?.(value) ?? []] }
  }
  catch (error) {
    return { parsed: true as const, value, diagnostics: [{ code: 'ADV_AUTHORING_CONDITION_CHECK', severity: 'error', message: error instanceof Error ? error.message : String(error) }] as AuthoringDiagnostic[] }
  }
}
