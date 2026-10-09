import type { RuntimeProgram } from '@advjs/types'

/** Host-side allowlist and Program cache; each conversation creates its own Runtime. */
export function createProgramCatalog<Key extends string>(loaders: Record<Key, () => Promise<RuntimeProgram>>) {
  const cache = new Map<Key, Promise<RuntimeProgram>>()
  return {
    load(id: Key): Promise<RuntimeProgram> {
      if (!Object.hasOwn(loaders, id))
        return Promise.reject(new Error(`Unknown story: ${id}`))
      const cached = cache.get(id)
      if (cached)
        return cached
      const request = Promise.resolve().then(loaders[id]).catch((error) => {
        cache.delete(id)
        throw error
      })
      cache.set(id, request)
      return request
    },
  }
}
