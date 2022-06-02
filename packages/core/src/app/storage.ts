import { namespace } from '@advjs/shared/utils'
import { createStorage, prefixStorage } from 'unstorage'
// @ts-expect-error no type
import localStorageDriver from 'unstorage/drivers/localstorage'

export const storage = createStorage({
  driver: localStorageDriver({ base: `${namespace}:` }),
})

export const recordsKey = 'records'
export const recordsStorage = prefixStorage(storage, recordsKey)
