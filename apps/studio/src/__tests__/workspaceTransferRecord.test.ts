import type { WorkspaceMutationRecord } from '../utils/workspaceMutationJournal'
import { webcrypto } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { workspaceBytesHash } from '../utils/workspaceFileSnapshot'
import { validateWorkspaceMutationRecord } from '../utils/workspaceMutationJournal'
import { workspaceMutationAfter } from '../utils/workspaceTransferRecord'

beforeAll(() => vi.stubGlobal('crypto', webcrypto))
afterAll(() => vi.unstubAllGlobals())
async function transfer(move = true): Promise<WorkspaceMutationRecord> {
  const data = new Uint8Array([0, 255, 128, 37]).buffer
  return { id: 'transfer', projectId: 'project', root: {} as FileSystemDirectoryHandle, kind: 'transfer', roots: ['adv', 'story'], before: [{ path: 'adv', kind: 'directory' }, { path: 'adv/empty', kind: 'directory' }, { path: 'adv/master.bin', kind: 'file', data, sha256: await workspaceBytesHash(data) }], after: [], drafts: [], bytes: data.byteLength, transfers: [{ source: 'adv', target: 'story', move }], createdAt: 1 }
}
describe('durable transfer snapshots', () => {
  it('stores original binary bytes once and derives moved destinations and empty directories', async () => {
    const record = await transfer()
    await validateWorkspaceMutationRecord(record)
    const after = workspaceMutationAfter(record)
    expect(after.map(entry => entry.path)).toEqual(['story', 'story/empty', 'story/master.bin'])
    expect(after[2]!.data).toBe(record.before[2]!.data)
    expect(record.bytes).toBe(4)
    expect(record.after).toEqual([])
  })

  it('retains source files in a copy result without duplicating durable media payloads', async () => {
    const record = await transfer(false)
    await validateWorkspaceMutationRecord(record)
    const after = workspaceMutationAfter(record)
    expect(after.map(entry => entry.path)).toEqual(['adv', 'story', 'adv/empty', 'story/empty', 'adv/master.bin', 'story/master.bin'])
    expect(after.filter(entry => entry.kind === 'file').every(entry => entry.data === record.before[2]!.data)).toBe(true)
    expect(record.bytes).toBe(4)
  })

  it('preserves the existing 100-transfer limit with 200 independent recovery roots', async () => {
    const record = await transfer()
    record.transfers = Array.from({ length: 100 }, (_, i) => ({ source: `source-${i}`, target: `target-${i}`, move: i % 2 === 0 }))
    record.roots = record.transfers.flatMap(intent => [intent.source, intent.target])
    record.before = record.transfers.map(intent => ({ path: intent.source, kind: 'directory' }))
    record.bytes = 0
    await expect(validateWorkspaceMutationRecord(record)).resolves.toBeUndefined()
    expect(workspaceMutationAfter(record)).toHaveLength(150)
  })

  it.each(['adv/child', '../outside', 'file:outside', 'adv', '.git/config'])('rejects overlapping or unsafe destination %s', async (target) => {
    const record = await transfer()
    record.transfers = [{ source: 'adv', target, move: true }]
    record.roots = ['adv', target]
    await expect(validateWorkspaceMutationRecord(record)).rejects.toThrow()
  })

  it('rejects mismatched roots, missing original roots and unverified destination payloads', async () => {
    const record = await transfer()
    await expect(validateWorkspaceMutationRecord({ ...record, roots: ['adv', 'other'] })).rejects.toThrow('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
    await expect(validateWorkspaceMutationRecord({ ...record, before: record.before.slice(1) })).rejects.toThrow('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
    await expect(validateWorkspaceMutationRecord({ ...record, after: workspaceMutationAfter(record) })).rejects.toThrow('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
  })

  it('checks exact original bytes and private draft storage against the durable record amount', async () => {
    const record = await transfer()
    await expect(validateWorkspaceMutationRecord({ ...record, bytes: 0 })).rejects.toThrow('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
    await expect(validateWorkspaceMutationRecord({ ...record, drafts: [{ path: 'adv/world.md', source: 'Saved', content: 'Private' }] })).rejects.toThrow('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
    record.before[2]!.data = new Uint8Array([0, 0, 0, 0]).buffer
    await expect(validateWorkspaceMutationRecord(record)).rejects.toThrow('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
  })

  it('rejects source trees whose child would be restored without its original directory', async () => {
    const record = await transfer()
    record.before[2]!.path = 'adv/missing/master.bin'
    await expect(validateWorkspaceMutationRecord(record)).rejects.toThrow('ADV_STUDIO_WORKSPACE_JOURNAL_INVALID')
  })
})
