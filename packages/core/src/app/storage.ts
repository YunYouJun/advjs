import { namespace } from '@advjs/shared/utils'
import { createStorage, prefixStorage } from 'unstorage'
import localStorageDriver from 'unstorage/drivers/localstorage'

export const storage = createStorage({
  driver: localStorageDriver({ base: `${namespace}:` }),
})

export const recordsKey = 'records'
export const recordsStorage = prefixStorage(storage, recordsKey)
