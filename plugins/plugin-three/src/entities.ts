import type { Intersection, Object3D } from 'three'

export interface ThreeEntityRegistry {
  /** One entity may have multiple roots; each root has exactly one binding. */
  register: (id: string, root: Object3D) => () => void
  /** Resolve the nearest registered ancestor of a raycast hit or object. */
  resolve: (hit: Intersection | Object3D | undefined) => string | undefined
  getObjects: (id?: string) => Object3D[]
  /** Drops references, without disposing caller-owned objects. */
  clear: () => void
}

/** Connect transient render objects to stable game IDs without mutating userData. */
export function createThreeEntityRegistry(): ThreeEntityRegistry {
  const bindings = new Map<Object3D, { id: string }>()
  return {
    register(id, root) {
      if (!id.trim())
        throw new Error('Three.js entity ID must not be empty')
      if (bindings.has(root))
        throw new Error('Three.js object already belongs to an entity')
      const binding = { id }
      bindings.set(root, binding)
      return () => {
        if (bindings.get(root) === binding)
          bindings.delete(root)
      }
    },
    resolve(hit) {
      let object = hit && 'object' in hit ? hit.object : hit
      while (object) {
        const binding = bindings.get(object)
        if (binding)
          return binding.id
        object = object.parent ?? undefined
      }
      return undefined
    },
    getObjects(id) {
      return [...bindings].filter(([, binding]) => id === undefined || binding.id === id).map(([object]) => object)
    },
    clear() {
      bindings.clear()
    },
  }
}
