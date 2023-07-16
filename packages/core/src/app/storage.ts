import { createStorage, prefixStorage } from 'unstorage'
import localStorageDriver from 'unstorage/drivers/localstorage'
import { namespace } from '../utils'

export function createRecordsStorage(recordsKey = 'records') {
  const storage = createStorage({
    driver: localStorageDriver({ base: `${namespace}:` }),
  })
  return prefixStorage(storage, recordsKey)
}
