import type { IFileSystem } from './fs'
import type { WorkspaceFileEntry, WorkspacePrivateDraft } from './workspaceFileSnapshot'
import type { WorkspaceMutationRecord } from './workspaceMutationJournal'
import { runStudioProjectWrite, setStudioProjectWriteBarrier } from './projectWriteQueue'
import { validateWorkspaceEntries } from './workspaceFileSnapshot'
import { persistWorkspaceMutationRecord, removeWorkspaceMutationRecord } from './workspaceMutationJournal'

export interface StudioFileTransfer { source: string, target: string, move: boolean }
interface Entry { path: string, kind: 'file' | 'directory', blob?: Blob, hash?: string }
interface Transfer { intent: StudioFileTransfer, entries: Entry[] }

const conflict = (path: string) => new Error(`ADV_STUDIO_SOURCE_CONFLICT: ${path}`)
const contains = (parent: string, path: string) => path === parent || path.startsWith(`${parent}/`)
function assertPath(path: string) {
  if (!path || /^(?:[a-z]+:|\/)/i.test(path) || path.includes('\\') || Array.from(path).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    || path.split('/').some(part => ['', '.', '..', '.git', 'node_modules'].includes(part.toLowerCase()))) {
    throw new Error('ADV_STUDIO_CONTENT_PATH_INVALID')
  }
}
async function digest(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Finite, exact-byte transfers. A move always leaves a complete verified copy before removing any source. */
export async function transferStudioProjectFiles(fs: IFileSystem, prepare: () => Promise<readonly StudioFileTransfer[]>, options: {
  assertCurrent: () => void
  applied?: (transfers: readonly StudioFileTransfer[]) => void
  rollbackApplied?: () => void
  journal?: { projectId: string, root: FileSystemDirectoryHandle, drafts: () => readonly WorkspacePrivateDraft[] }
}) {
  return runStudioProjectWrite(fs, async () => {
    const check = options.assertCurrent
    check()
    await fs.refresh?.()
    check()
    const intents = (await prepare()).map(intent => ({ ...intent }))
    check()
    if (!intents.length || intents.length > 100)
      throw new Error('ADV_STUDIO_TRANSFER_INVALID')
    const roots = intents.flatMap(intent => [intent.source, intent.target])
    roots.forEach(assertPath)
    // Overlapping roots make ownership and compensation ambiguous, including
    // copying a directory into itself or selecting both a parent and its child.
    if (roots.some((path, index) => roots.some((other, j) => j !== index && contains(other, path))))
      throw new Error('ADV_STUDIO_TRANSFER_OVERLAP')
    for (const intent of intents) {
      if (await fs.exists(intent.target))
        throw conflict(intent.target)
      const parent = intent.target.split('/').slice(0, -1).join('/')
      if ((await fs.stat(parent)).type !== 'directory')
        throw conflict(parent)
      check()
    }
    let bytes = 0
    let count = 0
    async function capture(path: string, output: Entry[]): Promise<void> {
      check()
      assertPath(path)
      if (++count > 1024)
        throw new Error('ADV_STUDIO_TRANSFER_TOO_LARGE')
      const stat = await fs.stat(path)
      check()
      if (stat.type === 'file') {
        bytes += stat.size
        if (bytes > 64 * 1024 * 1024)
          throw new Error('ADV_STUDIO_TRANSFER_TOO_LARGE')
        // File objects from native handles may become unreadable when the source
        // changes. Own an immutable byte copy before creating any destination.
        const blob = new Blob([await (await fs.readBlob(path)).arrayBuffer()])
        bytes += blob.size - stat.size
        if (bytes > 64 * 1024 * 1024)
          throw new Error('ADV_STUDIO_TRANSFER_TOO_LARGE')
        output.push({ path, kind: 'file', blob, hash: await digest(blob) })
      }
      else {
        output.push({ path, kind: 'directory' })
        for (const child of (await fs.readdir(path)).sort((a, b) => a.path.localeCompare(b.path))) {
          if (child.path !== `${path}/${child.name}` || child.name.includes('/'))
            throw new Error('ADV_STUDIO_CONTENT_PATH_INVALID')
          await capture(child.path, output)
        }
      }
      check()
    }
    const transfers: Transfer[] = []
    for (const intent of intents) {
      const entries: Entry[] = []
      await capture(intent.source, entries)
      transfers.push({ intent, entries })
    }
    const targetPath = (transfer: Transfer, entry: Entry) => transfer.intent.target + entry.path.slice(transfer.intent.source.length)
    async function matches(entry: Entry, path = entry.path) {
      if (!await fs.exists(path))
        return false
      const stat = await fs.stat(path)
      return stat.type === entry.kind && (entry.kind === 'directory' || (stat.size === entry.blob!.size && await digest(await fs.readBlob(path)) === entry.hash))
    }
    async function verifyTree(transfer: Transfer, target = false, removed = new Set<string>()) {
      for (const entry of transfer.entries) {
        const path = target ? targetPath(transfer, entry) : entry.path
        if (removed.has(path)) {
          if (await fs.exists(path))
            throw conflict(path)
          continue
        }
        if (!await matches(entry, path))
          throw conflict(path)
        if (entry.kind === 'directory') {
          const expected = transfer.entries.filter(child => child.path.slice(0, child.path.lastIndexOf('/')) === entry.path)
            .map(child => target ? targetPath(transfer, child) : child.path)
            .filter(child => !removed.has(child))
            .sort()
          const actual = (await fs.readdir(path)).map(child => child.path).sort()
          if (JSON.stringify(expected) !== JSON.stringify(actual))
            throw conflict(path)
        }
      }
    }
    // Validate the complete saved baseline again after all asynchronous reads.
    for (const transfer of transfers) {
      await verifyTree(transfer)
      if (await fs.exists(transfer.intent.target))
        throw conflict(transfer.intent.target)
      check()
    }
    const created: { entry: Entry, path: string }[] = []
    const removed = new Set<string>()
    let record: WorkspaceMutationRecord | undefined
    let receiptApplied = false
    if (options.journal) {
      const before: WorkspaceFileEntry[] = []
      for (const transfer of transfers) {
        for (const entry of transfer.entries)
          before.push(entry.kind === 'directory' ? { path: entry.path, kind: 'directory' } : { path: entry.path, kind: 'file', data: await entry.blob!.arrayBuffer(), sha256: entry.hash })
      }
      const drafts = options.journal.drafts().map(draft => ({ ...draft }))
      record = { id: crypto.randomUUID(), projectId: options.journal.projectId, root: options.journal.root, kind: 'transfer', roots, before, after: [], drafts, transfers: intents, createdAt: Date.now(), bytes: await validateWorkspaceEntries(intents.map(intent => intent.source), before, drafts) }
      await persistWorkspaceMutationRecord(record)
      setStudioProjectWriteBarrier(fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    }
    try {
      // Journal persistence yields to other writers; reconfirm before the first I/O.
      for (const transfer of transfers) {
        await verifyTree(transfer)
        if (await fs.exists(transfer.intent.target))
          throw conflict(transfer.intent.target)
        check()
      }
      for (const transfer of transfers) {
        for (const entry of transfer.entries) {
          check()
          if (!await matches(entry))
            throw conflict(entry.path)
          const path = targetPath(transfer, entry)
          if (await fs.exists(path))
            throw conflict(path)
          const parent = path.split('/').slice(0, -1).join('/')
          if ((await fs.stat(parent)).type !== 'directory')
            throw conflict(parent)
          check()
          created.push({ entry, path })
          if (entry.kind === 'file')
            await fs.writeBlob(path, entry.blob!)
          else
            await fs.mkdir(path)
          check()
          if (!await matches(entry, path))
            throw conflict(path)
        }
        await verifyTree(transfer, true)
      }
      for (const transfer of transfers)
        await verifyTree(transfer)
      for (const transfer of transfers) {
        if (!transfer.intent.move)
          continue
        for (const entry of [...transfer.entries].reverse()) {
          check()
          // Never delete the last verified copy, or a source that changed while
          // copying. Rechecking child names also protects newly added files.
          if (!await matches(entry, targetPath(transfer, entry)) || !await matches(entry))
            throw conflict(entry.path)
          if (entry.kind === 'directory' && (await fs.readdir(entry.path)).length)
            throw conflict(entry.path)
          check()
          removed.add(entry.path)
          if (entry.kind === 'file')
            await fs.deleteFile(entry.path)
          else
            await fs.rmdir(entry.path, { recursive: false })
        }
      }
      await fs.flush?.()
      check()
      for (const transfer of transfers) {
        await verifyTree(transfer, true)
        await verifyTree(transfer, false, removed)
      }
      check()
      receiptApplied = Boolean(options.applied)
      options.applied?.(intents)
      if (record) {
        await removeWorkspaceMutationRecord(record.id)
        setStudioProjectWriteBarrier(fs)
      }
    }
    catch (cause) {
      const failures: unknown[] = []
      // Restore missing source entries only; independently changed author files
      // always win. If restoration is uncertain, keep every destination copy.
      for (const transfer of created.length || removed.size ? transfers : []) {
        for (const entry of transfer.entries) {
          if (!removed.has(entry.path))
            continue
          try {
            if (await fs.exists(entry.path)) {
              if (!await matches(entry))
                throw conflict(entry.path)
            }
            else if (entry.kind === 'directory') {
              await fs.mkdir(entry.path)
            }
            else {
              await fs.writeBlob(entry.path, entry.blob!)
            }
          }
          catch (error) {
            failures.push(error)
          }
        }
        try {
          await verifyTree(transfer)
        }
        catch (error) {
          failures.push(error)
        }
      }
      if (!failures.length) {
        for (const { entry, path } of [...created].reverse()) {
          try {
            if (!await fs.exists(path))
              continue
            if (!await matches(entry, path))
              throw conflict(path)
            if (entry.kind === 'file')
              await fs.deleteFile(path)
            else
              await fs.rmdir(path, { recursive: false })
          }
          catch (error) {
            failures.push(error)
          }
        }
      }
      try {
        await fs.flush?.()
      }
      catch (error) {
        failures.push(error)
      }
      if (receiptApplied) {
        try {
          options.rollbackApplied?.()
        }
        catch (error) { failures.push(error) }
      }
      if (!failures.length && record) {
        try {
          await removeWorkspaceMutationRecord(record.id)
          setStudioProjectWriteBarrier(fs)
        }
        catch (error) { failures.push(error) }
      }
      if (failures.length)
        throw new AggregateError(failures, `ADV_STUDIO_TRANSFER_RECOVERY_REQUIRED: ${intents.map(intent => intent.target).join(', ')}`, { cause })
      throw cause
    }
  })
}
