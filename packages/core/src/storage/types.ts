import type { JsonObject, RuntimeSnapshot } from '@advjs/types'

export interface RuntimeSaveRecord {
  id: string
  snapshot: RuntimeSnapshot
  metadata?: JsonObject
  updatedAt: number
}

export interface RuntimeStorage {
  list: () => Promise<RuntimeSaveRecord[]>
  get: (id: string) => Promise<RuntimeSaveRecord | undefined>
  set: (record: RuntimeSaveRecord) => Promise<void>
  remove: (id: string) => Promise<void>
}
