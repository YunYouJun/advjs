import type { RuntimeSaveRecord, RuntimeStorage } from '@advjs/core'
import { validateRuntimeSaveRecord } from '@advjs/core'

export interface BrowserRuntimeStorageOptions {
  storage?: Storage
  prefix?: string
}

function compareRecords(left: RuntimeSaveRecord, right: RuntimeSaveRecord): number {
  if (left.updatedAt !== right.updatedAt)
    return right.updatedAt - left.updatedAt
  if (left.id < right.id)
    return -1
  if (left.id > right.id)
    return 1
  return 0
}

export function createBrowserRuntimeStorage(
  options: BrowserRuntimeStorageOptions = {},
): RuntimeStorage {
  const storage = options.storage ?? globalThis.localStorage
  const prefix = options.prefix ?? 'advjs:runtime-save:'
  const keyForId = (id: string) => `${prefix}${encodeURIComponent(id)}`

  return {
    async list() {
      const records: RuntimeSaveRecord[] = []
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index)
        if (!key?.startsWith(prefix))
          continue
        const value = storage.getItem(key)
        if (value)
          records.push(validateRuntimeSaveRecord(JSON.parse(value)))
      }
      return records.sort(compareRecords)
    },
    async get(id) {
      const value = storage.getItem(keyForId(id))
      return value ? validateRuntimeSaveRecord(JSON.parse(value)) : undefined
    },
    async set(record) {
      const valid = validateRuntimeSaveRecord(record)
      storage.setItem(keyForId(valid.id), JSON.stringify(valid))
    },
    async remove(id) {
      storage.removeItem(keyForId(id))
    },
  }
}
