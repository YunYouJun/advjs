import type { RuntimeDebugReport } from '@advjs/client/runtime'

export const RUNTIME_REPORT_FILENAME = 'advjs-runtime-report.json'
export const RUNTIME_REPORT_MIME_TYPE = 'application/json'

export interface RuntimeReportPayload {
  filename: typeof RUNTIME_REPORT_FILENAME
  mimeType: typeof RUNTIME_REPORT_MIME_TYPE
  text: string
  blob: Blob
}

export function createRuntimeReportPayload(report: RuntimeDebugReport): RuntimeReportPayload {
  const text = `${JSON.stringify(report, null, 2)}\n`

  return {
    filename: RUNTIME_REPORT_FILENAME,
    mimeType: RUNTIME_REPORT_MIME_TYPE,
    text,
    blob: new Blob([text], { type: RUNTIME_REPORT_MIME_TYPE }),
  }
}
