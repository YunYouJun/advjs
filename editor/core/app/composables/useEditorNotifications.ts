import type { EditorErrorReport } from '../../../../apps/desktop/src/error-report'
import { Toast } from '@advjs/gui'

export interface ErrorToastData { kind: 'editor-error', report: string }
export function useEditorNotifications() {
  const { formatReport } = useEditorErrorReport()
  function notifyError(report: EditorErrorReport, id?: string, formatted?: string) {
    Toast({
      id,
      title: report.source,
      description: report.error instanceof Error ? report.error.message : String(report.error ?? ''),
      type: 'error',
      duration: Number.POSITIVE_INFINITY,
      data: { kind: 'editor-error', report: formatted ?? formatReport(report) } satisfies ErrorToastData,
    })
  }
  return { notifyError }
}
