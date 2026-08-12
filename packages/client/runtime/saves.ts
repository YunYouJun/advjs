import type { RuntimeSaveRecord, RuntimeStorage } from '@advjs/core'
import type { JsonObject, RuntimeSnapshot, RuntimeTraceEntry } from '@advjs/types'

export const AUTO_SAVE_SLOT_COUNT = 5
export const MANUAL_SAVE_SLOT_COUNT = 60
export const SAVE_SLOTS_PER_PAGE = 6

export type AdvGameSaveKind = 'manual' | 'auto' | 'quick'

export type AdvGameSaveSlot
  = | { readonly kind: 'manual', readonly index: number }
    | { readonly kind: 'auto', readonly index: number }
    | { readonly kind: 'quick' }

export interface AdvGameRecordMeta {
  createdAt: number
  thumbnail?: string
  memo?: string
}

export interface AdvGameSaveRecord {
  slot: AdvGameSaveSlot
  snapshot: RuntimeSnapshot
  meta: AdvGameRecordMeta
  updatedAt: number
}

export interface AutoSaveOptions {
  slots?: number
  meta?: Partial<AdvGameRecordMeta>
}

export interface CreateGameSaveControllerOptions {
  storage: RuntimeStorage
  now?: () => number
}

export interface GameSaveController {
  save: (
    slot: AdvGameSaveSlot,
    snapshot: RuntimeSnapshot,
    meta?: Partial<AdvGameRecordMeta>,
  ) => Promise<AdvGameSaveRecord>
  read: (slot: AdvGameSaveSlot) => Promise<AdvGameSaveRecord | undefined>
  updateMeta: (
    slot: AdvGameSaveSlot,
    meta: Partial<AdvGameRecordMeta>,
  ) => Promise<AdvGameSaveRecord | undefined>
  remove: (slot: AdvGameSaveSlot) => Promise<void>
  list: (kind?: AdvGameSaveKind) => Promise<AdvGameSaveRecord[]>
  autoSave: (
    snapshot: RuntimeSnapshot,
    options?: AutoSaveOptions,
  ) => Promise<AdvGameSaveRecord>
}

export const QUICK_SAVE_SLOT: AdvGameSaveSlot = Object.freeze({ kind: 'quick' })

export function createManualSaveSlot(index: number): AdvGameSaveSlot {
  assertSlotIndex(index)
  return { kind: 'manual', index }
}

export function createAutoSaveSlot(index: number): AdvGameSaveSlot {
  assertSlotIndex(index)
  return { kind: 'auto', index }
}

function assertSlotIndex(index: number): void {
  if (!Number.isInteger(index) || index < 1)
    throw new TypeError('ADV_GAME_SAVE_INVALID_SLOT: Slot index must be a positive integer')
}

function slotId(slot: AdvGameSaveSlot): string {
  if (slot.kind === 'quick')
    return 'quick'
  assertSlotIndex(slot.index)
  return slot.kind === 'manual' ? slot.index.toString() : `auto:${slot.index}`
}

function parseSlotId(id: string): AdvGameSaveSlot | undefined {
  if (id === 'quick')
    return QUICK_SAVE_SLOT
  if (/^[1-9]\d*$/.test(id))
    return createManualSaveSlot(Number(id))
  const auto = /^auto:([1-9]\d*)$/.exec(id)
  return auto ? createAutoSaveSlot(Number(auto[1])) : undefined
}

function readMetadata(metadata: JsonObject | undefined, fallback: number): AdvGameRecordMeta {
  return {
    createdAt: typeof metadata?.createdAt === 'number' ? metadata.createdAt : fallback,
    thumbnail: typeof metadata?.thumbnail === 'string' ? metadata.thumbnail : undefined,
    memo: typeof metadata?.memo === 'string' ? metadata.memo : undefined,
  }
}

function mergeMetadata(
  previous: JsonObject | undefined,
  patch: Partial<AdvGameRecordMeta>,
  timestamp: number,
): JsonObject {
  const metadata: JsonObject = {
    ...previous,
    createdAt: patch.createdAt ?? previous?.createdAt ?? timestamp,
  }
  if (patch.thumbnail !== undefined)
    metadata.thumbnail = patch.thumbnail
  if (patch.memo !== undefined)
    metadata.memo = patch.memo
  return metadata
}

function validateTimestamp(timestamp: number): number {
  if (!Number.isFinite(timestamp))
    throw new TypeError('ADV_GAME_SAVE_INVALID_TIME: now() must return a finite number')
  return timestamp
}

export function shouldCreateAutoSave(entry: Readonly<RuntimeTraceEntry>): boolean {
  if (entry.command === 'restore' || entry.command === 'back' || entry.command === 'forward')
    return false
  return entry.command === 'start'
    || entry.command === 'go'
    || entry.command === 'complete-activity'
    || entry.from.chapterId !== entry.to.chapterId
    || entry.status === 'waiting-choice'
    || entry.status === 'waiting-activity'
    || entry.status === 'ended'
}

export function createGameSaveController(
  options: CreateGameSaveControllerOptions,
): GameSaveController {
  const now = options.now ?? Date.now
  let autoSaveQueue: Promise<void> = Promise.resolve()

  const toGameRecord = (
    record: RuntimeSaveRecord,
    slot: AdvGameSaveSlot,
  ): AdvGameSaveRecord => ({
    slot,
    snapshot: record.snapshot,
    meta: readMetadata(record.metadata, record.updatedAt),
    updatedAt: record.updatedAt,
  })

  async function read(slot: AdvGameSaveSlot) {
    const record = await options.storage.get(slotId(slot))
    return record ? toGameRecord(record, slot) : undefined
  }

  async function save(
    slot: AdvGameSaveSlot,
    snapshot: RuntimeSnapshot,
    meta: Partial<AdvGameRecordMeta> = {},
  ) {
    const id = slotId(slot)
    const previous = await options.storage.get(id)
    const updatedAt = validateTimestamp(now())
    const previousMetadata = previous?.metadata ? { ...previous.metadata } : undefined
    if (previousMetadata)
      delete previousMetadata.thumbnail
    const metadata = mergeMetadata(previousMetadata, meta, updatedAt)
    const record = {
      id,
      snapshot,
      metadata,
      updatedAt,
    }
    await options.storage.set(record)
    return toGameRecord(record, slot)
  }

  async function updateMeta(slot: AdvGameSaveSlot, meta: Partial<AdvGameRecordMeta>) {
    const id = slotId(slot)
    const previous = await options.storage.get(id)
    if (!previous)
      return undefined
    const updatedAt = validateTimestamp(now())
    const record = {
      ...previous,
      metadata: mergeMetadata(previous.metadata, meta, previous.updatedAt),
      updatedAt,
    }
    await options.storage.set(record)
    return toGameRecord(record, slot)
  }

  async function list(kind?: AdvGameSaveKind) {
    const records = await options.storage.list()
    return records.flatMap((record) => {
      const slot = parseSlotId(record.id)
      if (!slot || (kind && slot.kind !== kind))
        return []
      return [toGameRecord(record, slot)]
    })
  }

  async function writeAutoSave(snapshot: RuntimeSnapshot, options: AutoSaveOptions) {
    const slots = options.slots ?? AUTO_SAVE_SLOT_COUNT
    assertSlotIndex(slots)
    const records = await list('auto')
    const occupied = new Set(records.map(record => record.slot.kind === 'auto' ? record.slot.index : 0))
    let slot = Array.from({ length: slots }, (_, index) => index + 1)
      .find(index => !occupied.has(index))
    if (!slot) {
      const oldest = records
        .filter(record => record.slot.kind === 'auto' && record.slot.index <= slots)
        .sort((left, right) => left.updatedAt - right.updatedAt)[0]
      slot = oldest?.slot.kind === 'auto' ? oldest.slot.index : 1
    }
    return save(createAutoSaveSlot(slot), snapshot, options.meta)
  }

  function autoSave(snapshot: RuntimeSnapshot, options: AutoSaveOptions = {}) {
    const operation = autoSaveQueue.then(() => writeAutoSave(snapshot, options))
    autoSaveQueue = operation.then(() => undefined, () => undefined)
    return operation
  }

  return {
    save,
    read,
    updateMeta,
    remove: slot => options.storage.remove(slotId(slot)),
    list,
    autoSave,
  }
}
