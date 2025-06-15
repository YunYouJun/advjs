import type * as m from 'monaco-editor'

declare global {
  // extend the window
  interface Window {
    outputEditor: m.editor.IStandaloneCodeEditor
    MonacoEnvironment: {
      getWorker: (_: any, label: string) => Worker
    }
  }
}
