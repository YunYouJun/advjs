import type { FSWatcher } from 'chokidar'
import { watch } from 'chokidar'

export interface EditorProjectChange {
  event: 'change' | 'rename'
  path: string
}

/** Keep observing a source path when atomic saves replace its underlying inode. */
export async function watchEditorProject(root: string, onChange: (change: EditorProjectChange) => void): Promise<FSWatcher> {
  const watcher = watch(root, {
    cwd: root,
    ignoreInitial: true,
    followSymlinks: false,
    ignored: /(?:^|[/\\])(?:\.git|node_modules)(?:[/\\]|$)/u,
  })
  watcher.on('all', (event, path) => onChange({ event: event === 'change' ? 'change' : 'rename', path: path.replaceAll('\\', '/') }))
  // Retain the bridge's existing runtime error handling after initial scanning.
  watcher.on('error', () => {})
  try {
    await new Promise<void>((resolveReady, rejectReady) => {
      watcher.once('error', rejectReady)
      watcher.once('ready', () => {
        watcher.off('error', rejectReady)
        resolveReady()
      })
    })
    return watcher
  }
  catch (error) {
    await watcher.close()
    throw error
  }
}
