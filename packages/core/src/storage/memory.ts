import type { RuntimeSaveRecord, RuntimeStorage } from './types'
import { validateRuntimeSaveRecord } from './validate'

function compareRecords(left: RuntimeSaveRecord, right: RuntimeSaveRecord): number {
  if (left.updatedAt !== right.updatedAt)
    return right.updatedAt - left.updatedAt
  if (left.id < right.id)
    return -1
  if (left.id > right.id)
    return 1
  return 0
}

export function createMemoryRuntimeStorage(initial: RuntimeSaveRecord[] = []): RuntimeStorage {
  const records = new Map<string, RuntimeSaveRecord>()
  for (const record of initial) {
    const valid = validateRuntimeSaveRecord(record)
    records.set(valid.id, valid)
  }

  return {
    async list() {
      return Array.from(records.values(), record => structuredClone(record)).sort(compareRecords)
    },
    async get(id) {
      const record = records.get(id)
      return record ? structuredClone(record) : undefined
    },
    async set(record) {
      const valid = validateRuntimeSaveRecord(record)
      records.set(valid.id, valid)
    },
    async remove(id) {
      records.delete(id)
    },
  }
}
