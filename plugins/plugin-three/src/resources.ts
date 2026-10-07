import type { BufferGeometry, Material, Object3D, Scene, Texture } from 'three'

/** Dispose resources owned by this tree once, even when meshes share them. */
export function disposeThreeResources(root: Object3D) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  function collectTexture(value: unknown) {
    if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture)
      textures.add(value as Texture)
    else if (Array.isArray(value))
      value.forEach(collectTexture)
  }
  root.traverse((object) => {
    const mesh = object as Object3D & { geometry?: BufferGeometry, material?: Material | Material[] }
    if (mesh.geometry)
      geometries.add(mesh.geometry)
    for (const material of mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : []) {
      materials.add(material)
      Object.values(material).forEach(collectTexture)
      if ('uniforms' in material) {
        for (const uniform of Object.values(material.uniforms as Record<string, { value: unknown }>))
          collectTexture(uniform.value)
      }
    }
  })
  const scene = root as Scene
  collectTexture(scene.background)
  collectTexture(scene.environment)
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
  textures.forEach(texture => texture.dispose())
}
