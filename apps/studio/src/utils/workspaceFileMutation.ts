import type { IFileSystem } from './fs'
import type { WorkspaceFileEntry } from './workspaceFileSnapshot'
import type { WorkspaceMutationRecord } from './workspaceMutationJournal'
import { notifyStudioFileSystemRefresh } from './fs/mutations'
import { runStudioProjectWrite, setStudioProjectWriteBarrier } from './projectWriteQueue'
import { readWorkspaceEntry, workspaceEntryEqual, workspaceSnapshotsEqual } from './workspaceFileSnapshot'
import { assertWorkspaceMutationRecorded, persistWorkspaceMutationRecord, removeWorkspaceMutationRecord, validateWorkspaceMutationRecord } from './workspaceMutationJournal'
import { snapshotWorkspaceMutation, workspaceMutationAfter } from './workspaceTransferRecord'

function conflict(path: string) {
  return new Error(`ADV_STUDIO_SOURCE_CONFLICT: ${path}`)
}
async function verify(fs: IFileSystem, record: WorkspaceMutationRecord, entries: WorkspaceFileEntry[], check: () => void) {
  if (!workspaceSnapshotsEqual(await snapshotWorkspaceMutation(fs, record, check), entries))
    throw conflict(record.roots.join(', '))
  check()
}
async function writeEntry(fs: IFileSystem, entry: WorkspaceFileEntry, check: () => void) {
  const parent = entry.path.split('/').slice(0, -1).join('/')
  if ((await fs.stat(parent)).type !== 'directory')
    throw conflict(parent)
  check()
  if (entry.kind === 'directory')
    await fs.mkdir(entry.path)
  else
    await fs.writeBlob(entry.path, new Blob([entry.data!]))
}
async function removeEntry(fs: IFileSystem, entry: WorkspaceFileEntry) {
  if (entry.kind === 'directory')
    await fs.rmdir(entry.path, { recursive: false })
  else
    await fs.deleteFile(entry.path)
}

/** Best-effort conditional restoration; never overwrite another author's file. */
async function restoreBefore(fs: IFileSystem, record: WorkspaceMutationRecord, check: () => void) {
  const failures: unknown[] = []
  for (const entry of [...record.before].sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
    try {
      check()
      const actual = await readWorkspaceEntry(fs, entry.path)
      if (!actual)
        await writeEntry(fs, entry, check)
      else if (!workspaceEntryEqual(actual, entry))
        throw conflict(entry.path)
    }
    catch (error) { failures.push(error) }
  }
  // Unexpected or changed files may reference imported copies. Keep all copies
  // until their ownership and the original tree can be established again.
  const actual = await snapshotWorkspaceMutation(fs, record, check)
  const after = workspaceMutationAfter(record)
  const originals = new Set(record.before.map(entry => entry.path))
  const allowed = new Map([...record.before, ...after].map(entry => [entry.path, entry]))
  if (actual.some(entry => !workspaceEntryEqual(entry, allowed.get(entry.path))))
    failures.push(conflict(record.roots.join(', ')))
  if (!failures.length) {
    for (const entry of [...after].filter(entry => !originals.has(entry.path)).sort((a, b) => b.path.split('/').length - a.path.split('/').length)) {
      try {
        check()
        const current = await readWorkspaceEntry(fs, entry.path)
        if (current) {
          if (!workspaceEntryEqual(current, entry))
            throw conflict(entry.path)
          check()
          await removeEntry(fs, entry)
        }
      }
      catch (error) { failures.push(error) }
    }
  }
  await fs.flush?.()
  await verify(fs, record, record.before, check)
  if (failures.length)
    throw new AggregateError(failures, 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
}

/** The durable intent precedes all project writes, including empty native files. */
export async function commitWorkspaceFileMutation(fs: IFileSystem, prepare: () => Promise<WorkspaceMutationRecord>, options: {
  check: () => void
  applied?: () => void
  rollbackApplied?: () => void
}) {
  return runStudioProjectWrite(fs, async () => {
    options.check()
    const record = await prepare()
    await validateWorkspaceMutationRecord(record)
    await verify(fs, record, record.before, options.check)
    await persistWorkspaceMutationRecord(record)
    setStudioProjectWriteBarrier(fs, 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED')
    let receiptApplied = false
    let attempted = false
    try {
      // Persisting the journal is asynchronous; reconfirm the entire source before I/O.
      await verify(fs, record, record.before, options.check)
      const after = workspaceMutationAfter(record)
      const original = new Map(record.before.map(entry => [entry.path, entry]))
      const retained = new Set(after.map(entry => entry.path))
      for (const entry of [...after].sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
        if (original.has(entry.path)) {
          if (!workspaceEntryEqual(original.get(entry.path), entry))
            throw conflict(entry.path)
          continue
        }
        if (await fs.exists(entry.path))
          throw conflict(entry.path)
        options.check()
        attempted = true
        await writeEntry(fs, entry, options.check)
        if (!workspaceEntryEqual(await readWorkspaceEntry(fs, entry.path), entry))
          throw conflict(entry.path)
      }
      for (const entry of [...record.before].sort((a, b) => b.path.split('/').length - a.path.split('/').length)) {
        if (retained.has(entry.path))
          continue
        if (!workspaceEntryEqual(await readWorkspaceEntry(fs, entry.path), entry))
          throw conflict(entry.path)
        options.check()
        attempted = true
        await removeEntry(fs, entry)
      }
      await fs.flush?.()
      await verify(fs, record, after, options.check)
      receiptApplied = Boolean(options.applied)
      options.applied?.()
      await removeWorkspaceMutationRecord(record.id)
      setStudioProjectWriteBarrier(fs)
      return record
    }
    catch (cause) {
      try {
        // A scope switch stops new writes but must not stop restoration of the
        // original project's owned bytes. Conflicting author files still win.
        if (attempted)
          await restoreBefore(fs, record, () => {})
        if (receiptApplied)
          options.rollbackApplied?.()
        await removeWorkspaceMutationRecord(record.id)
        setStudioProjectWriteBarrier(fs)
      }
      catch (error) {
        throw new AggregateError([error], 'ADV_STUDIO_WORKSPACE_RECOVERY_REQUIRED', { cause })
      }
      throw cause
    }
  })
}

/** Review is an exact native snapshot, not a stale status flag from the journal. */
export async function reviewWorkspaceMutation(fs: IFileSystem, record: WorkspaceMutationRecord, check: () => void) {
  await assertWorkspaceMutationRecorded(record)
  await validateWorkspaceMutationRecord(record)
  return snapshotWorkspaceMutation(fs, record, check)
}
export async function recoverWorkspaceFileMutation(fs: IFileSystem, record: WorkspaceMutationRecord, reviewed: WorkspaceFileEntry[], mode: 'restore' | 'keep', options: {
  check: () => void
  applied?: () => void
}) {
  return runStudioProjectWrite(fs, async () => {
    options.check()
    await assertWorkspaceMutationRecorded(record)
    await validateWorkspaceMutationRecord(record)
    await verify(fs, record, reviewed, options.check)
    if (mode === 'restore') {
      await restoreBefore(fs, record, options.check)
      options.applied?.()
    }
    else {
      // The separate author confirmation explicitly discards the recovery copy.
      await verify(fs, record, reviewed, options.check)
    }
    options.check()
    await removeWorkspaceMutationRecord(record.id)
    setStudioProjectWriteBarrier(fs)
    notifyStudioFileSystemRefresh(fs)
  }, { recovery: true })
}
