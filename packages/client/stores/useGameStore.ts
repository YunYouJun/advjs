import type { AdvGameRecord, AdvGameRecordMeta } from '@advjs/client'
import { AdvGameLoadStatusEnum } from '@advjs/client'
import { createRecordsStorage } from '@advjs/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * runtime game store
 */
export const useGameStore = defineStore('@advjs/client:game', () => {
  /**
   * 游戏加载状态
   * Load game from JSON file
   */
  const loadStatus = ref<AdvGameLoadStatusEnum>(AdvGameLoadStatusEnum.IDLE)
  /**
   * 正在加载
   */
  const isLoading = computed(() => {
    return ![AdvGameLoadStatusEnum.SUCCESS, AdvGameLoadStatusEnum.FAIL].includes(loadStatus.value)
  })

  /**
   * 游戏开始章节
   */
  const startChapter = ref()
  /**
   * 游戏开始节点
   */
  const startNode = ref()

  const recordsStorage = createRecordsStorage()
  // 0 for temp save
  // const recordsMap = useStorage<boolean[]>(`${namespace}::records`, [])

  /**
   * init game map
   */

  /**
   * 存储记录
   * @param index
   * @param data
   */
  const saveRecord = (index: number, data: AdvGameRecord) => {
    const key = index.toString()
    recordsStorage.setMeta(key, { createdAt: (new Date()).valueOf() })
    return recordsStorage.setItem(key, data)
  }

  const saveRecordMeta = async (index: number, meta: Partial<AdvGameRecordMeta>) => {
    const key = index.toString()
    return await recordsStorage.setMeta(key, Object.assign({ createdAt: (new Date()).valueOf() }, meta))
  }

  /**
   * 读取记录
   * @param index
   */
  const readRecord = async (index: number) => {
    const key = index.toString()
    const data = (await recordsStorage.getItem(key)) as AdvGameRecord
    return data
  }

  const readRecordMeta = async (index: number) => {
    const key = index.toString()
    const meta = (await recordsStorage.getMeta(key)) as AdvGameRecordMeta
    return meta
  }

  /**
   * 删除记录
   * @param index
   */
  const deleteRecord = (index: number) => {
    const key = index.toString()
    // default remove meta
    return recordsStorage.removeItem(key)
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
