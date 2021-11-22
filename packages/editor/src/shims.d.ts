import type * as m from 'monaco-editor'

declare module 'v-tooltip';

declare global {
  // extend the window
  interface Window {
    outputEditor: m.editor.IStandaloneCodeEditor
  }
}
