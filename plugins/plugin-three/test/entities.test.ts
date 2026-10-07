import { Group, Mesh, Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createThreeEntityRegistry } from '../src'

describe('three.js entity bindings', () => {
  it('resolves model submeshes through the nearest registered ancestor', () => {
    const entities = createThreeEntityRegistry()
    const city = new Group()
    const building = new Group()
    const surface = new Mesh()
    city.userData = { authored: true }
    city.add(building)
    building.add(surface)
    entities.register('city', city)
    expect(entities.resolve(surface)).toBe('city')
    const unbind = entities.register('building', building)
    expect(entities.resolve(surface)).toBe('building')
    unbind()
    expect(entities.resolve(surface)).toBe('city')
    expect(entities.resolve(new Object3D())).toBeUndefined()
    expect(entities.resolve(undefined)).toBeUndefined()
    expect(city.userData).toEqual({ authored: true })
  })

  it('allows multiple roots per ID and does not dispose externally owned objects', () => {
    const entities = createThreeEntityRegistry()
    const first = new Mesh()
    const second = new Mesh()
    const dispose = vi.spyOn(first.geometry, 'dispose')
    entities.register('army', first)
    entities.register('army', second)
    expect(entities.getObjects('army')).toEqual([first, second])
    expect(() => entities.register('other', first)).toThrow('already belongs')
    expect(() => entities.register(' ', new Group())).toThrow('must not be empty')
    entities.clear()
    expect(entities.getObjects()).toEqual([])
    expect(entities.resolve(first)).toBeUndefined()
    expect(dispose).not.toHaveBeenCalled()
  })

  it('keeps a new binding intact when a stale cleanup runs after clear and reuse', () => {
    const entities = createThreeEntityRegistry()
    const object = new Group()
    const oldCleanup = entities.register('old', object)
    entities.clear()
    entities.register('new', object)
    oldCleanup()
    expect(entities.resolve(object)).toBe('new')
  })
})
