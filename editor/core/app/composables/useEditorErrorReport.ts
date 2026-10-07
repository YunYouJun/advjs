import type { EditorErrorReport } from '../../../../apps/desktop/src/error-report'
import { formatEditorErrorReport } from '../../../../apps/desktop/src/error-report'
import pkg from '../../package.json'

export function useEditorErrorReport() {
  const project = useProjectStore()
  const console = useConsoleStore()

  function formatReport(report: EditorErrorReport) {
    return formatEditorErrorReport({
      version: pkg.version,
      project: project.projectLocation || project.rootDir?.name || project.pendingProject,
      environment: `${window.advDesktop ? 'Desktop' : 'Browser'} / ${navigator.userAgent}`,
      ...report,
      details: { route: window.location.pathname, workspace: project.projectLocation ? 'local' : project.workspaceMode, context: report.details },
      logs: report.logs ?? console.logList.slice(-20),
    })
  }

  async function copyReport(report: string) {
    if (window.advDesktop) {
      await window.advDesktop.copyErrorReport(report)
      return
    }
    await navigator.clipboard.writeText(report)
  }

  return { formatReport, copyReport }
}
