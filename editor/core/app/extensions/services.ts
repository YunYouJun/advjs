import type { EditorProjectSnapshot } from '@advjs/editor-sdk'
import type { Ref } from 'vue'
import type { EditorProjectModel } from '../adapters/browser/project'
import type { EditorHostServices } from './registry'
import { readonly, shallowRef, watch } from 'vue'

export function projectSnapshot(model: EditorProjectModel, name: string, sessionId: string, revision: number): EditorProjectSnapshot {
  const { project, diagnostics } = model.compilation
  return Object.freeze({
    sessionId,
    revision,
    name,
    files: Object.freeze({ ...model.files }),
    diagnostics: Object.freeze(diagnostics.map(({ code, severity, message, path, line }) => Object.freeze({ code, severity, message, path, line }))),
    counts: Object.freeze({ chapters: project.chapters.length, characters: project.characters.length, scenes: project.scenes.length }),
  })
}

/** Both local and browser workspaces publish the same compiled project model. */
export function createEditorHostServices(options: {
  project: () => EditorProjectModel | undefined
  workspace: () => object | undefined
  name: () => string
  refresh: () => Promise<unknown>
  locale: Ref<string>
  writeClipboard: (text: string) => Promise<void>
  notify: (text: string) => void
}) {
  const current = shallowRef<EditorProjectSnapshot | null>(null)
  let previousWorkspace: object | undefined
  let session = 0
  let revision = 0
  const stop = watch([options.project, options.workspace], ([model, workspace]) => {
    if (workspace !== previousWorkspace) {
      previousWorkspace = workspace
      session++
      revision = 0
    }
    current.value = model && workspace ? projectSnapshot(model, options.name(), String(session), ++revision) : null
  }, { immediate: true })
  const services: EditorHostServices = {
    locale: readonly(options.locale),
    project: {
      current: readonly(current),
      async refresh() {
        const workspace = options.workspace()
        if (!workspace)
          throw new Error('No project is open')
        await options.refresh()
        if (options.workspace() !== workspace)
          throw new Error('Project changed while refreshing')
      },
      subscribe: listener => watch(current, listener),
    },
    clipboard: { writeText: options.writeClipboard },
    notifications: { info: options.notify },
  }
  return { services, dispose: stop }
}
