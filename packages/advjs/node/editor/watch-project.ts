import type { FSWatcher } from 'node:fs'
import { watch } from 'node:fs'
import { lstat, readdir, realpath } from 'node:fs/promises'
import { relative, resolve } from 'pathe'

/** Watch directories, not file inodes: atomic saves replace the latter. */
export async function watchEditorProject(root: string, onChange: (event: string, path: string) => void) {
  root = resolve(await realpath(root))
  async function directoryIdentity(directory: string) {
    const info = await lstat(directory).catch(() => undefined)
    if (!info?.isDirectory() || info.isSymbolicLink())
      return
    // Reject symlinks in ancestors as well as the final directory.
    const actual = await realpath(directory).catch(() => undefined)
    if (!actual || resolve(actual) !== directory)
      return
    return `${info.dev}:${info.ino}`
  }
  const watchers = new Map<string, { watcher: FSWatcher, identity: string }>()
  let closed = false
  let scans: Promise<void> | undefined
  let scanAgain = false
  async function scan() {
    if (closed)
      return
    const seen = new Set<string>()
    async function visit(directory: string) {
      if (closed)
        return
      const identity = await directoryIdentity(directory)
      if (!identity || closed)
        return
      seen.add(directory)
      if (watchers.get(directory)?.identity !== identity) {
        watchers.get(directory)?.watcher.close()
        watchers.delete(directory)
        try {
          const watcher = watch(directory, (event, filename) => {
            if (closed)
              return
            const name = filename?.toString() ?? ''
            if (name === '.git' || name === 'node_modules')
              return
            const path = relative(root, name ? resolve(directory, name) : directory)
            void (async () => {
              // Install new directory watchers before announcing the change.
              // A refresh then includes files created before registration.
              if (event === 'rename')
                await rescan()
              // A removed/replaced watched directory must not leak later events.
              if (!closed && await directoryIdentity(directory) === identity && !closed)
                onChange(event, path)
            })().catch(() => {})
          })
          watcher.on('error', () => {
            watcher.close()
            if (watchers.get(directory)?.watcher === watcher)
              watchers.delete(directory)
            if (!closed)
              void rescan().catch(() => {})
          })
          watchers.set(directory, { watcher, identity })
        }
        catch (error) {
          if (directory === root)
            throw error
          // A parent watcher will report directories recreated during a scan.
          return
        }
      }
      const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
      if (closed || await directoryIdentity(directory) !== identity) {
        watchers.get(directory)?.watcher.close()
        watchers.delete(directory)
        return
      }
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== '.git' && entry.name !== 'node_modules')
          await visit(resolve(directory, entry.name))
      }
    }
    await visit(root)
    for (const [directory, entry] of watchers) {
      if (!seen.has(directory)) {
        entry.watcher.close()
        watchers.delete(directory)
      }
    }
  }
  function rescan() {
    scanAgain = true
    scans ??= (async () => {
      do {
        scanAgain = false
        await scan()
        if (closed)
          break
      } while (scanAgain)
    })().finally(() => { scans = undefined })
    return scans
  }
  try {
    await rescan()
  }
  catch (error) {
    closed = true
    for (const { watcher } of watchers.values())
      watcher.close()
    watchers.clear()
    throw error
  }
  return {
    close() {
      closed = true
      for (const { watcher } of watchers.values())
        watcher.close()
      watchers.clear()
    },
  }
}
