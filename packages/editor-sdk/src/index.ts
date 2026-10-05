import type { Component, InjectionKey, Ref } from 'vue'
import { inject } from 'vue'

export type EditorRegion = 'navigation' | 'main' | 'bottom' | 'inspector'
export type EditorText = Readonly<Record<string, string>>
export type EditorService = 'project.read' | 'project.refresh' | 'clipboard.write'
export type EditorCleanup = () => void

export interface EditorDiagnostic {
  readonly code: string
  readonly severity: 'error' | 'warning'
  readonly message: string
  readonly path?: string
  readonly line?: number
}

export interface EditorProjectSnapshot {
  readonly sessionId: string
  readonly revision: number
  readonly name: string
  readonly files: Readonly<Record<string, string>>
  readonly diagnostics: readonly EditorDiagnostic[]
  readonly counts: Readonly<{ chapters: number, characters: number, scenes: number }>
}

export interface EditorPluginContext {
  readonly locale: Readonly<Ref<string>>
  readonly signal: AbortSignal
  readonly project: {
    readonly current: Readonly<Ref<EditorProjectSnapshot | null>>
    refresh: () => Promise<void>
    subscribe: (listener: (project: EditorProjectSnapshot | null) => void) => EditorCleanup
  }
  readonly clipboard: { writeText: (text: string) => Promise<void> }
  readonly notifications: { info: (message: string) => void }
  onDispose: (cleanup: EditorCleanup) => EditorCleanup
}

export interface EditorView {
  id: string
  title: EditorText
  region: EditorRegion
  icon?: string
  order?: number
  retention?: 'unmount' | 'keep-alive'
  load: () => Promise<{ default: Component }>
}

export interface EditorCommand {
  id: string
  title: EditorText
  enabled?: (context: EditorPluginContext) => boolean
  run: (context: EditorPluginContext) => unknown | Promise<unknown>
}

export interface EditorAction {
  location: 'editor.toolbar' | { view: string, area: 'title' }
  command: string
  icon?: string
}

export interface EditorPlugin {
  id: string
  version: string
  apiVersion: 1
  title: EditorText
  description?: EditorText
  requires?: readonly EditorService[]
  views?: readonly EditorView[]
  commands?: readonly EditorCommand[]
  actions?: readonly EditorAction[]
  activate?: (context: EditorPluginContext) => void | EditorCleanup | Promise<void | EditorCleanup>
}

export function defineEditorPlugin<const T extends EditorPlugin>(plugin: T): T {
  return plugin
}

export function editorText(text: EditorText | undefined, locale: string, fallback = ''): string {
  return text?.[locale] ?? text?.en ?? fallback
}

export const editorPluginContextKey: InjectionKey<EditorPluginContext> = Symbol('advjs.editor.plugin')

export function useEditorPluginContext(): EditorPluginContext {
  const context = inject(editorPluginContextKey)
  if (!context)
    throw new Error('Editor plugin views must be rendered by the editor view host')
  return context
}
