import type { Object3D } from 'three'
import type { ThreeViewport } from './types'
import { Box3, MathUtils, Quaternion, Vector3 } from 'three'

export interface ThreeFrameOptions {
  /** Space around projected bounds; must be finite and >= 1. Defaults to 1.2. */
  padding?: number
}

/** Fit world bounds in the current camera orientation. Empty lists are a no-op. */
export function frameThreeObjects(viewport: Pick<ThreeViewport, 'camera' | 'controls' | 'invalidate'>, objects: readonly Object3D[], options: ThreeFrameOptions = {}): boolean {
  const padding = options.padding ?? 1.2
  if (!Number.isFinite(padding) || padding < 1)
    throw new Error('Three.js framing padding must be finite and >= 1')
  const { camera, controls } = viewport
  const bounds = new Box3()
  for (const object of objects) {
    object.updateWorldMatrix(true, true)
    bounds.expandByObject(object)
  }
  if (bounds.isEmpty())
    return false
  if (![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite))
    throw new Error('Three.js framing bounds must be finite')

  const center = bounds.getCenter(new Vector3())
  const orientation = camera.getWorldQuaternion(new Quaternion())
  const inverse = orientation.clone().invert()
  const projected = new Box3()
  const corners: Vector3[] = []
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new Vector3(x, y, z).sub(center).applyQuaternion(inverse)
        corners.push(corner)
        projected.expandByPoint(corner)
      }
    }
  }
  let distance: number
  if ('isOrthographicCamera' in camera) {
    const width = camera.right - camera.left
    const height = camera.top - camera.bottom
    const size = projected.getSize(new Vector3())
    // Center asymmetric frusta as well as symmetric map cameras.
    camera.left = -width / 2
    camera.right = width / 2
    camera.top = height / 2
    camera.bottom = -height / 2
    camera.zoom = Math.min(width / Math.max(size.x, 0.01), height / Math.max(size.y, 0.01)) / padding
    distance = Math.max(bounds.getSize(new Vector3()).length(), 1)
  }
  else {
    const vertical = Math.tan(MathUtils.degToRad(camera.getEffectiveFOV()) / 2)
    const horizontal = vertical * camera.aspect
    distance = Math.max(...corners.map(corner => corner.z + padding * Math.max(Math.abs(corner.x) / horizontal, Math.abs(corner.y) / vertical)), projected.max.z + 0.1)
  }
  const position = center.clone().add(new Vector3(0, 0, distance).applyQuaternion(orientation))
  if (camera.parent)
    camera.parent.worldToLocal(position)
  camera.position.copy(position)
  camera.near = Math.max(0.01, (distance - projected.max.z) / 2)
  camera.far = Math.max(camera.near * 2, (distance - projected.min.z) * 1.5)
  camera.updateProjectionMatrix()
  camera.updateWorldMatrix(true, false)
  if (controls) {
    controls.target.copy(center)
    controls.update()
  }
  viewport.invalidate()
  return true
}
