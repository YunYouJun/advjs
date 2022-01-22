import type { AdvGameRecord } from '@advjs/core'
import { recordsStorage } from '@advjs/core/app'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useGameStore = defineStore('game', () => {
  // 0 for temp save
  // const recordsMap = useStorage<boolean[]>(`${namespace}::records`, [])

  /**
   * 存储记录
   * @param index
   * @param data
   */
  const saveRecord = (index: number, data: AdvGameRecord) => {
    return recordsStorage.setItem(index.toString(), data)
  }

  /**
   * 读取记录
   * @param index
   */
  const readRecord = async(index: number) => {
    return recordsStorage.getItem(index.toString()) as Promise<AdvGameRecord>
  }

  /**
   * 删除记录
   * @param index
   */
  const deleteRecord = (index: number) => {
    return recordsStorage.removeItem(index.toString())
  }

  return {
    readRecord,
    saveRecord,
    deleteRecord,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
