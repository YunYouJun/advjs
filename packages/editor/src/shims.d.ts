import type * as m from 'monaco-editor'

declare module 'v-tooltip';

declare interface Window {
  // extend the window
  outputEditor: m.editor.IStandaloneCodeEditor
}
