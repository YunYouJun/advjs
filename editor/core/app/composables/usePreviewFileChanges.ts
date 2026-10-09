import { shallowRef, watch } from 'vue'

async function optionalEntry<T>(read: () => Promise<T>) {
  try {
    return await read()
  }
  catch (error) {
    if (!error || typeof error !== 'object' || !('name' in error) || error.name !== 'NotFoundError')
      throw error
  }
}

async function fileTimestamps(root: FileSystemDirectoryHandle) {
  const timestamps = new Map<string, number>()
  const directory = await optionalEntry(() => root.getDirectoryHandle('adv')) ?? root
  const index = await optionalEntry(async () => (await directory.getFileHandle('index.adv.json')).getFile())
  if (index)
    timestamps.set('index.adv.json', index.lastModified)
  const chapters = await optionalEntry(() => directory.getDirectoryHandle('chapters'))
  if (chapters) {
    for await (const entry of chapters.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.adv.md'))
        timestamps.set(`chapters/${entry.name}`, (await entry.getFile()).lastModified)
    }
  }
  return timestamps
}

/** Retained browser previews poll only while visible, within the current workspace. */
export function usePreviewFileChanges(options: {
  visible: () => boolean
  directory: () => FileSystemDirectoryHandle | undefined
}) {
  const hasFileChanges = shallowRef(false)
  let previousDirectory: FileSystemDirectoryHandle | undefined
  let timestamps: Map<string, number> | undefined

  watch([options.visible, options.directory], ([visible, directory], _previous, onCleanup) => {
    if (directory !== previousDirectory) {
      previousDirectory = directory
      timestamps = undefined
      hasFileChanges.value = false
    }
    if (!visible || !directory)
      return

    const root = directory
    let active = true
    let pending = false
    async function check() {
      if (pending)
        return
      pending = true
      try {
        const current = await fileTimestamps(root)
        if (!active)
          return
        const previous = timestamps
        if (previous && (current.size !== previous.size || [...current].some(([name, time]) => previous.get(name) !== time)))
          hasFileChanges.value = true
        timestamps = current
      }
      catch {
        // A failed scan keeps the last successful baseline for the next attempt.
      }
      finally {
        pending = false
      }
    }

    void check()
    const interval = setInterval(() => void check(), 5000)
    onCleanup(() => {
      active = false
      clearInterval(interval)
    })
  }, { immediate: true, flush: 'sync' })

  return { hasFileChanges }
}
