import { isClient } from '@vueuse/core'
import { createStorage, prefixStorage } from 'unstorage'
import localStorageDriver from 'unstorage/drivers/localstorage'
import { namespace } from '../utils'

/**
 * create game records storage
 * by localStorage
 * @param recordsKey
 */
export function createRecordsStorage(recordsKey = 'records') {
  const storage = createStorage({
    driver: isClient ? localStorageDriver({ base: `${namespace}:` }) : undefined,
  })
  return prefixStorage(storage, recordsKey)
}
