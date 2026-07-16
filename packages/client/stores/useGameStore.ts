import type { AdvGameRecord, AdvGameRecordMeta } from '@advjs/client'
import type { RuntimeStorage } from '@advjs/core'
import type { JsonObject } from '@advjs/types'
import { AdvGameLoadStatusEnum } from '@advjs/client'
import { createMemoryRuntimeStorage } from '@advjs/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createBrowserRuntimeStorage } from '../runtime'

function createRecordsStorage(): RuntimeStorage {
  return typeof window === 'undefined'
    ? createMemoryRuntimeStorage()
    : createBrowserRuntimeStorage({ prefix: 'advjs:records:' })
}

function readMetadata(metadata?: JsonObject): AdvGameRecordMeta {
  return {
    createdAt: typeof metadata?.createdAt === 'number' ? metadata.createdAt : 0,
    thumbnail: typeof metadata?.thumbnail === 'string' ? metadata.thumbnail : undefined,
    memo: typeof metadata?.memo === 'string' ? metadata.memo : undefined,
  }
}

/** Browser save slots backed by the shared RuntimeStorage contract. */
export const useGameStore = defineStore('@advjs/client:game', () => {
  const loadStatus = ref<AdvGameLoadStatusEnum>(AdvGameLoadStatusEnum.IDLE)
  const isLoading = computed(() => {
    return ![AdvGameLoadStatusEnum.SUCCESS, AdvGameLoadStatusEnum.FAIL].includes(loadStatus.value)
  })

  const startChapter = ref<string>()
  const startNode = ref<string>()
  const recordsStorage = createRecordsStorage()

  async function saveRecord(index: number, snapshot: AdvGameRecord) {
    const id = index.toString()
    const previous = await recordsStorage.get(id)
    const updatedAt = Date.now()
    await recordsStorage.set({
      id,
      snapshot,
      updatedAt,
      metadata: {
        ...previous?.metadata,
        createdAt: previous?.metadata?.createdAt ?? updatedAt,
      },
    })
  }

  async function saveRecordMeta(index: number, meta: Partial<AdvGameRecordMeta>) {
    const id = index.toString()
    const previous = await recordsStorage.get(id)
    if (!previous)
      return
    const metadata: JsonObject = {
      ...previous.metadata,
      createdAt: meta.createdAt ?? previous.metadata?.createdAt ?? previous.updatedAt,
    }
    if (meta.thumbnail !== undefined)
      metadata.thumbnail = meta.thumbnail
    if (meta.memo !== undefined)
      metadata.memo = meta.memo
    await recordsStorage.set({
      ...previous,
      metadata,
      updatedAt: Date.now(),
    })
  }

  async function readRecord(index: number) {
    return (await recordsStorage.get(index.toString()))?.snapshot
  }

  async function readRecordMeta(index: number) {
    const record = await recordsStorage.get(index.toString())
    return readMetadata(record?.metadata)
  }

  function deleteRecord(index: number) {
    return recordsStorage.remove(index.toString())
  }

  return {
    loadStatus,
    isLoading,
    startChapter,
    startNode,
    readRecord,
    readRecordMeta,
    saveRecord,
    saveRecordMeta,
    deleteRecord,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
