import type { OrthographicCamera, PerspectiveCamera } from 'three'
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, OrthographicCamera as Ortho, PerspectiveCamera as Perspective, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { frameThreeObjects } from '../src'

function objects() {
  const root = new Group()
  root.position.set(200, 5, -40)
  root.rotation.y = 0.6
  for (const [x, z] of [[-30, -5], [20, 12]]) {
    const mesh = new Mesh(new BoxGeometry(3, 5, 2), new MeshBasicMaterial())
    mesh.position.set(x, 0, z)
    root.add(mesh)
  }
  return root
}

function expectInside(camera: OrthographicCamera | PerspectiveCamera, bounds: Box3) {
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new Vector3(x, y, z).project(camera)
        expect(Math.abs(point.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(point.y)).toBeLessThanOrEqual(1)
        expect(Math.abs(point.z)).toBeLessThanOrEqual(1)
      }
    }
  }
}

describe('three.js object framing', () => {
  it.each([0.5, 2.5])('fits transformed objects into an orthographic viewport with aspect %s', (aspect) => {
    const camera = new Ortho(-8 * aspect, 8 * aspect, 8, -8, 0.1, 100)
    camera.position.set(9, 15, 12)
    camera.lookAt(0, 0, 0)
    const orientation = camera.quaternion.clone()
    const invalidate = vi.fn()
    const root = objects()
    expect(frameThreeObjects({ camera, controls: undefined, invalidate }, [root])).toBe(true)
    expectInside(camera, new Box3().setFromObject(root))
    expect(camera.quaternion.equals(orientation)).toBe(true)
    expect(invalidate).toHaveBeenCalledOnce()
  })

  it.each([0.5, 2.5])('fits transformed objects and depth into a perspective viewport with aspect %s', (aspect) => {
    const camera = new Perspective(45, aspect, 0.1, 100)
    camera.position.set(9, 15, 12)
    camera.lookAt(0, 0, 0)
    const root = objects()
    frameThreeObjects({ camera, controls: undefined, invalidate: vi.fn() }, [root])
    expectInside(camera, new Box3().setFromObject(root))
  })

  it('supports parented cameras and leaves empty scenes unchanged', () => {
    const parent = new Group()
    parent.position.set(-10, 8, 30)
    parent.rotation.y = 0.4
    const camera = new Perspective(45, 1, 0.1, 100)
    camera.position.set(9, 15, 12)
    camera.lookAt(0, 0, 0)
    parent.add(camera)
    const root = objects()
    const viewport = { camera, controls: undefined, invalidate: vi.fn() }
    frameThreeObjects(viewport, [root])
    expectInside(camera, new Box3().setFromObject(root))
    const position = camera.position.clone()
    viewport.invalidate.mockClear()
    expect(frameThreeObjects(viewport, [new Group()])).toBe(false)
    expect(camera.position.equals(position)).toBe(true)
    expect(viewport.invalidate).not.toHaveBeenCalled()
    expect(() => frameThreeObjects(viewport, [root], { padding: 0 })).toThrow('padding')
  })
})
