import type { RuntimeStorage } from '@advjs/core'
import type {
  AdvGameRecordMeta,
  AdvGameSaveKind,
  AdvGameSaveSlot,
  AutoSaveOptions,
  GameSaveController,
} from '../runtime'
import type { AdvGameRecord } from './useAdvStore'
import { AdvGameLoadStatusEnum } from '@advjs/client'
import { createMemoryRuntimeStorage } from '@advjs/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { createBrowserRuntimeStorage, createGameSaveController } from '../runtime'

const RECORDS_STORAGE_PREFIX = 'advjs:records:'

function createRecordsStorage(namespace?: string): RuntimeStorage {
  const prefix = namespace
    ? `${RECORDS_STORAGE_PREFIX}${encodeURIComponent(namespace)}:`
    : RECORDS_STORAGE_PREFIX

  return typeof window === 'undefined'
    ? createMemoryRuntimeStorage()
    : createBrowserRuntimeStorage({ prefix })
}

/** Browser save slots backed by the shared RuntimeStorage contract. */
export const useGameStore = defineStore('@advjs/client:game', () => {
  const loadStatus = shallowRef<AdvGameLoadStatusEnum>(AdvGameLoadStatusEnum.IDLE)
  const isLoading = computed(() => {
    return ![AdvGameLoadStatusEnum.SUCCESS, AdvGameLoadStatusEnum.FAIL].includes(loadStatus.value)
  })

  const startChapter = shallowRef<string>()
  const startNode = shallowRef<string>()
  const recordNamespace = shallowRef<string>()
  const controllersByNamespace = new Map<string, GameSaveController>()

  function setRecordNamespace(namespace?: string) {
    recordNamespace.value = namespace || undefined
  }

  function getController() {
    const namespace = recordNamespace.value
    const key = namespace ?? ''
    let controller = controllersByNamespace.get(key)
    if (!controller) {
      controller = createGameSaveController({ storage: createRecordsStorage(namespace) })
      controllersByNamespace.set(key, controller)
    }
    return controller
  }

  function save(slot: AdvGameSaveSlot, snapshot: AdvGameRecord, meta?: Partial<AdvGameRecordMeta>) {
    return getController().save(slot, snapshot, meta)
  }

  function read(slot: AdvGameSaveSlot) {
    return getController().read(slot)
  }

  function updateMeta(slot: AdvGameSaveSlot, meta: Partial<AdvGameRecordMeta>) {
    return getController().updateMeta(slot, meta)
  }

  function remove(slot: AdvGameSaveSlot) {
    return getController().remove(slot)
  }

  function list(kind?: AdvGameSaveKind) {
    return getController().list(kind)
  }

  function autoSave(snapshot: AdvGameRecord, options?: AutoSaveOptions) {
    return getController().autoSave(snapshot, options)
  }

  return {
    loadStatus,
    isLoading,
    startChapter,
    startNode,
    recordNamespace,
    setRecordNamespace,
    save,
    read,
    updateMeta,
    remove,
    list,
    autoSave,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
