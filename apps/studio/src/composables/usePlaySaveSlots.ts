import type { RuntimeSnapshot } from '@advjs/types'
import type { DbPlaySaveSlot } from '../utils/db'
import { computed, ref } from 'vue'
import { db } from '../utils/db'

const SLOT_NAME_RE = /^[\w-]{1,40}$/

export function isValidSlotName(slot: string): boolean {
  return SLOT_NAME_RE.test(slot)
}

export interface PlaySaveSnapshot {
  runtime: RuntimeSnapshot
  chapterFile: string
  order: number
  totalNodes: number
  chapterTitle?: string
  previewText?: string
  background: string
  tachies: Map<string, { status: string }>
  visitedOrders: number[]
  history: number[]
  unlockedCGs: string[]
}

function snapshotToRow(projectId: string, slot: string, snapshot: PlaySaveSnapshot, note?: string): DbPlaySaveSlot {
  return {
    projectId,
    slot,
    chapterFile: snapshot.chapterFile,
    order: snapshot.order,
    totalNodes: snapshot.totalNodes,
    chapterTitle: snapshot.chapterTitle,
    previewText: snapshot.previewText,
    note,
    savedAt: Date.now(),
    snapshot: structuredClone(snapshot.runtime),
    background: snapshot.background,
    tachies: Array.from(snapshot.tachies.entries()),
    visitedOrders: [...snapshot.visitedOrders],
    history: [...snapshot.history],
    unlockedCGs: [...snapshot.unlockedCGs],
  }
}

function rowToSnapshot(row: DbPlaySaveSlot): PlaySaveSnapshot {
  return {
    runtime: structuredClone(row.snapshot),
    chapterFile: row.chapterFile,
    order: row.order,
    totalNodes: row.totalNodes,
    chapterTitle: row.chapterTitle,
    previewText: row.previewText,
    background: row.background,
    tachies: new Map(row.tachies),
    visitedOrders: [...row.visitedOrders],
    history: [...row.history],
    unlockedCGs: [...row.unlockedCGs],
  }
}

/**
 * Save / load named slots for the Studio Play Tab, scoped per project.
 *
 * Slots are persisted in Dexie (`playSaveSlots` table) and embed a frozen
 * snapshot of the player's chapter position, stage state, and unlocked CGs.
 */
export function usePlaySaveSlots(projectId: () => string | undefined) {
  const slots = ref<DbPlaySaveSlot[]>([])

  function pid(): string | null {
    return projectId() ?? null
  }

  async function refresh(): Promise<void> {
    const id = pid()
    if (!id) {
      slots.value = []
      return
    }
    const rows = await db.playSaveSlots.where('projectId').equals(id).toArray()
    slots.value = rows.sort((a, b) => b.savedAt - a.savedAt)
  }

  async function save(slot: string, snapshot: PlaySaveSnapshot, note?: string): Promise<DbPlaySaveSlot> {
    if (!isValidSlotName(slot))
      throw new Error(`Invalid slot name "${slot}" — use letters/digits/_/- (max 40 chars)`)
    const id = pid()
    if (!id)
      throw new Error('No project context')
    const row = snapshotToRow(id, slot, snapshot, note)
    await db.playSaveSlots.put(row)
    await refresh()
    return row
  }

  async function load(slot: string): Promise<PlaySaveSnapshot | null> {
    const id = pid()
    if (!id)
      return null
    const row = await db.playSaveSlots.get([id, slot])
    return row ? rowToSnapshot(row) : null
  }

  async function remove(slot: string): Promise<boolean> {
    const id = pid()
    if (!id)
      return false
    const existing = await db.playSaveSlots.get([id, slot])
    if (!existing)
      return false
    await db.playSaveSlots.delete([id, slot])
    await refresh()
    return true
  }

  const hasSlots = computed(() => slots.value.length > 0)

  return {
    slots,
    hasSlots,
    refresh,
    save,
    load,
    remove,
  }
}
