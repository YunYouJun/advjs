export interface EditorErrorReport {
  source: string
  error?: unknown
  details?: unknown
  logs?: unknown
  project?: string
  environment?: string
  version?: string
}

/** The report is shared by native dialogs and the browser editor. */
export function redactErrorReport(text: string, secrets: readonly string[] = []) {
  let result = text
    .replace(/(\bBearer\s+)[\w.+~/-]+/giu, '$1[redacted]')
    .replace(/((?:advjs-token|access[_-]?token|api[_-]?key|password|authorization|token)["']?\s*[:=]\s*["']?)[^\s"'&,}]+/giu, '$1[redacted]')
  for (const secret of secrets.filter(Boolean))
    result = result.replaceAll(secret, '[redacted]')
  return result
}

export function describeReportValue(value: unknown): string {
  if (typeof value === 'string')
    return value
  if (value === undefined)
    return ''
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(value, (key, item) => {
      if (/^(?:token|authorization|password|secret|api[_-]?key|access[_-]?token)$/iu.test(key))
        return '[redacted]'
      if (typeof item === 'bigint')
        return String(item)
      if (item && typeof item === 'object') {
        if (seen.has(item))
          return '[Circular]'
        seen.add(item)
        if (item instanceof Error)
          return { ...item, name: item.name, message: item.message, stack: item.stack, cause: item.cause }
      }
      return item
    }, 2) ?? String(value)
  }
  catch {
    return String(value)
  }
}

export function formatEditorErrorReport(report: EditorErrorReport, secrets: readonly string[] = []) {
  const sections = [
    'ADV.JS Editor — error report',
    'Please diagnose the cause and suggest a fix with verification steps.',
    `Source: ${report.source}`,
    ...(report.version ? [`Version: ${report.version}`] : []),
    ...(report.project ? [`Project: ${report.project}`] : []),
    ...(report.environment ? [`Environment: ${report.environment}`] : []),
    ...(report.error !== undefined ? ['\nError:', describeReportValue(report.error)] : []),
    ...(report.details !== undefined ? ['\nContext:', describeReportValue(report.details)] : []),
    ...(report.logs !== undefined ? ['\nRecent logs:', describeReportValue(report.logs).slice(-24_000)] : []),
  ]
  return redactErrorReport(sections.join('\n'), secrets)
}
