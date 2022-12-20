import { createStorage, prefixStorage } from 'unstorage'
// @ts-expect-error no type
import localStorageDriver from 'unstorage/drivers/localstorage'
import { namespace } from '../utils'

export const createRecordsStorage = (recordsKey = 'records') => {
  const storage = createStorage({
    driver: localStorageDriver({ base: `${namespace}:` }),
  })
  return prefixStorage(storage, recordsKey)
}
