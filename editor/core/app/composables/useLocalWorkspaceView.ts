import type { LocalFileHandle } from '../adapters/local'
import { parseCharacterMd } from '@advjs/parser'
import { shallowRef, watch } from 'vue'
import { getEditorSessionStorage } from '../adapters/local/session'

interface WorkspaceView {
  tab: string
  kind?: 'file' | 'character'
  path?: string
  draft?: { content: string, base: string }
}

/** Restore authoring selection and source drafts after the live workspace reconnects. */
export function useLocalWorkspaceView() {
  const project = useProjectStore()
  const app = useAppStore()
  const files = useFileStore()
  const characters = useCharacterStore()
  const monaco = useMonacoStore()
  const ready = shallowRef(false)
  const storage = getEditorSessionStorage()
  const key = () => `advjs:editor:view:${project.workspaceIdentity}`

  function currentView(): WorkspaceView {
    const view: WorkspaceView = { tab: app.inspectorTab }
    if (app.activeInspector === 'file' && files.openedFilePath) {
      view.kind = 'file'
      view.path = files.openedFilePath
      if (files.isDirty)
        view.draft = { content: monaco.fileContent, base: files.savedFileContent }
    }
    else if (app.activeInspector === 'character') {
      view.kind = 'character'
      view.path = (characters.selectedCharacterHandle as unknown as LocalFileHandle | undefined)?.path
    }
    return view
  }

  watch(currentView, (view) => {
    if (!ready.value || project.workspaceMode !== 'local' || !project.workspaceIdentity)
      return
    try {
      storage?.setItem(key(), JSON.stringify(view))
    }
    catch {
      // Storage restrictions must not interrupt editing or write to project files.
    }
  }, { deep: true })

  async function restore() {
    ready.value = false
    try {
      if (project.workspaceMode !== 'local' || !project.workspaceIdentity)
        return
      const view: WorkspaceView | null = JSON.parse(storage?.getItem(key()) ?? 'null')
      if (!view)
        return
      if (typeof view.path === 'string' && Object.hasOwn(project.project?.files ?? {}, view.path)) {
        const handle = await project.getLocalFileHandle(view.path)
        if (view.kind === 'character' && view.path.endsWith('.character.md')) {
          characters.selectedCharacter = parseCharacterMd(await handle.getFile().then(file => file.text()))
          characters.selectedCharacterHandle = handle as unknown as FileSystemFileHandle
          app.activeInspector = 'character'
        }
        else if (view.kind === 'file') {
          await files.setOpenedFileHandle(handle as unknown as FileSystemFileHandle, view.path)
          if (typeof view.draft?.content === 'string' && typeof view.draft.base === 'string')
            files.restoreDraft(view.draft.content, view.draft.base)
        }
      }
      app.inspectorTab = view.tab === 'context' ? 'context' : 'inspector'
    }
    catch {
      // Deleted or malformed selections cannot prevent the project from opening.
    }
    finally {
      ready.value = true
    }
  }

  return { restore }
}
