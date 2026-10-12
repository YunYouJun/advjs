import { watchEditorProject as watchProjectDirectories } from './watch-project'

export interface EditorProjectChange {
  event: 'change' | 'rename'
  path: string
}

/** Keep the bridge event API while guarding replaced directories and symlinks. */
export function watchEditorProject(root: string, onChange: (change: EditorProjectChange) => void) {
  return watchProjectDirectories(root, (event, path) => {
    onChange({ event: event === 'change' ? 'change' : 'rename', path })
  })
}
